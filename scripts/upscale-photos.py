"""
Sharpens photos with 4xNomos8kSC (CC BY 4.0, by Philip Hofmann), an ESRGAN
network trained on real photos that were blurred, resized and compressed.
It restores edges, text and texture without the painted look of
Real-ESRGAN's general model, which smeared faces and flattened textures.
MIX of its output is laid over a plain Lanczos resize, which calms the few
places it invents detail (tiny faces far away).

It needs no PyTorch: the weights are read straight from the .pth file, the
network (RRDBNet) is rebuilt as an ONNX graph, and ONNX Runtime runs it on
the CPU, about a minute per photo.

  pip install onnx onnxruntime pillow numpy
  python scripts/upscale-photos.py public/assets/locations/inside

For every photo it writes two sizes next to the original, from one 4x pass:
  <name>.webp     1400 px wide, for the page
  <name>@2x.webp  2400 px wide, for the full-screen viewer and big screens
The untouched original is kept in assets-src/<folder>/ the first time.
"""
import io
import pickle
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper, numpy_helper
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MODEL = "4xNomos8kSC"
WEIGHTS_URL = f"https://github.com/Phhofm/models/releases/download/{MODEL}/{MODEL}.pth"
CACHE = ROOT / "tools" / "upscale"
SIZES = {"": 1400, "@2x": 2400}
MIX = 0.85  # share of the network's output over the Lanczos resize
TILE, PAD = 192, 24


def load_pth(path):
    """A PyTorch state dict as numpy arrays, without PyTorch."""
    z = zipfile.ZipFile(path)
    prefix = z.namelist()[0].split("/")[0]
    kinds = {"FloatStorage": np.float32, "HalfStorage": np.float16}

    class Unpickler(pickle.Unpickler):
        def find_class(self, mod, name):
            if name == "_rebuild_tensor_v2":
                def rebuild(storage, offset, size, stride, *_):
                    if not size:
                        return storage[offset:offset + 1].reshape(())
                    return np.lib.stride_tricks.as_strided(
                        storage[offset:], shape=size, strides=[s * storage.itemsize for s in stride]
                    ).copy()
                return rebuild
            if name in kinds:
                return kinds[name]
            if mod == "collections" and name == "OrderedDict":
                import collections
                return collections.OrderedDict
            return super().find_class(mod, name)

        def persistent_load(self, pid):
            _, dtype, key, _loc, _n = pid
            return np.frombuffer(z.read(f"{prefix}/data/{key}"), dtype=dtype)

    obj = Unpickler(io.BytesIO(z.read(f"{prefix}/data.pkl"))).load()
    return obj.get("params_ema") or obj.get("params") or obj


def build_onnx(sd):
    """RRDBNet (ESRGAN, old key names): 23 residual-in-residual dense blocks, then 2x, 2x."""
    nodes, inits, count = [], [], [0]

    def out(prefix):
        count[0] += 1
        return f"{prefix}{count[0]}"

    def op(kind, inputs, **attrs):
        y = out(kind)
        nodes.append(helper.make_node(kind, inputs, [y], **attrs))
        return y

    def conv(x, key):
        for part in ("weight", "bias"):
            inits.append(numpy_helper.from_array(sd[f"{key}.{part}"].astype(np.float32), f"{key}.{part}"))
        return op("Conv", [x, f"{key}.weight", f"{key}.bias"], pads=[1, 1, 1, 1])

    def lrelu(x):
        return op("LeakyRelu", [x], alpha=0.2)

    def scaled_add(x, skip):
        return op("Add", [op("Mul", [x, "k0.2"]), skip])

    def rdb(x, key):
        feats = [x]
        for i in range(1, 5):
            feats.append(lrelu(conv(op("Concat", feats, axis=1) if i > 1 else x, f"{key}.conv{i}.0")))
        return scaled_add(conv(op("Concat", feats, axis=1), f"{key}.conv5.0"), x)

    inits += [numpy_helper.from_array(np.array(0.2, np.float32), "k0.2"),
              numpy_helper.from_array(np.array([1, 1, 2, 2], np.float32), "x2")]
    fea = conv("input", "model.0")
    blocks = sorted({int(k.split(".")[3]) for k in sd if k.startswith("model.1.sub.") and ".RDB" in k})
    t = fea
    for b in blocks:
        key = f"model.1.sub.{b}"
        t = scaled_add(rdb(rdb(rdb(t, f"{key}.RDB1"), f"{key}.RDB2"), f"{key}.RDB3"), t)
    t = op("Add", [fea, conv(t, f"model.1.sub.{len(blocks)}")])
    t = lrelu(conv(op("Resize", [t, "", "x2"], mode="nearest"), "model.3"))
    t = lrelu(conv(op("Resize", [t, "", "x2"], mode="nearest"), "model.6"))
    nodes.append(helper.make_node("Identity", [conv(lrelu(conv(t, "model.8")), "model.10")], ["output"]))
    graph = helper.make_graph(
        nodes, "rrdbnet", [helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 3, None, None])],
        [helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 3, None, None])], inits,
    )
    # IR 8 / opset 17: readable by any ONNX Runtime from 1.14 on
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)], ir_version=8)
    onnx.checker.check_model(model)
    return model


def session():
    CACHE.mkdir(parents=True, exist_ok=True)
    pth, onx = CACHE / f"{MODEL}.pth", CACHE / f"{MODEL}.onnx"
    if not onx.exists():
        if not pth.exists():
            print(f"downloading {MODEL} (64 MB)…")
            urllib.request.urlretrieve(WEIGHTS_URL, pth)
        onnx.save(build_onnx(load_pth(pth)), onx)
    return ort.InferenceSession(str(onx), providers=["CPUExecutionProvider"])


def upscale(sess, img):
    """4x, in overlapping tiles so memory stays small."""
    a = np.asarray(img.convert("RGB"), np.float32) / 255.0
    h, w, _ = a.shape
    out = np.zeros((h * 4, w * 4, 3), np.float32)
    for y in range(0, h, TILE):
        for x in range(0, w, TILE):
            y0, x0 = max(0, y - PAD), max(0, x - PAD)
            y1, x1 = min(h, y + TILE + PAD), min(w, x + TILE + PAD)
            tile = a[y0:y1, x0:x1].transpose(2, 0, 1)[None]
            res = sess.run(None, {"input": tile})[0][0].transpose(1, 2, 0)
            ty, tx = (y - y0) * 4, (x - x0) * 4
            th, tw = min(TILE, h - y) * 4, min(TILE, w - x) * 4
            out[y * 4:y * 4 + th, x * 4:x * 4 + tw] = res[ty:ty + th, tx:tx + tw]
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))


def main():
    folder = Path(sys.argv[1]).resolve()
    originals = ROOT / "assets-src" / folder.relative_to(ROOT / "public" / "assets")
    originals.mkdir(parents=True, exist_ok=True)
    sess = session()
    photos = [p for p in sorted(folder.iterdir()) if p.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"} and "@2x" not in p.stem]
    for p in photos:
        keep = originals / p.name
        if not keep.exists():
            shutil.copy2(p, keep)
        src = Image.open(keep).convert("RGB")
        big = upscale(sess, src)
        for suffix, width in SIZES.items():
            h = round(big.height * width / big.width)
            plain = src.resize((width, h), Image.LANCZOS)
            im = Image.blend(plain, big.resize((width, h), Image.LANCZOS), MIX)
            dest = folder / f"{p.stem}{suffix}.webp"
            im.save(dest, "WEBP", quality=88, method=6)
            print(f"{dest.relative_to(ROOT)}  {width}x{h}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
