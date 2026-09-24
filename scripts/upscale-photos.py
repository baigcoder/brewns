"""
Sharpens photos with Real-ESRGAN (realesr-general-x4v3, BSD-3-Clause, by
Xintao Wang et al.), a small network made for real-world photos: soft focus,
upscaling blur and compression artefacts.

Used at full strength it paints: faces smear and textures turn to flat
patches. So its weights are blended with the no-denoise variant
(realesr-general-wdn-x4v3) at DENOISE, as Real-ESRGAN's own
--denoise_strength does, and only MIX of its output is laid over a plain
Lanczos resize of the original. Edges get crisper, the photo stays a photo.

It needs no PyTorch: the weights are read straight from the .pth file, the
network (SRVGGNetCompact) is rebuilt as an ONNX graph, and ONNX Runtime runs
it on the CPU.

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
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
WEIGHTS_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/{}.pth"
CACHE = ROOT / "tools" / "upscale"
SIZES = {"": 1400, "@2x": 2400}
DENOISE = 0.3  # 1 = realesr-general-x4v3 alone (painterly), 0 = the wdn model alone
MIX = 0.35  # share of the network's output over the Lanczos resize
TILE, PAD = 192, 12


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


def build_onnx(sd, upscale=4):
    """SRVGGNetCompact: conv + PReLU layers, pixel shuffle, plus a nearest-neighbour skip."""
    convs = sorted({int(k.split(".")[1]) for k in sd if k.endswith(".weight") and sd[k].ndim == 4})
    nodes, inits = [], []
    x = "input"
    for i in convs:
        w, b = f"body.{i}.weight", f"body.{i}.bias"
        inits += [numpy_helper.from_array(sd[w].astype(np.float32), w), numpy_helper.from_array(sd[b].astype(np.float32), b)]
        nodes.append(helper.make_node("Conv", [x, w, b], [f"c{i}"], pads=[1, 1, 1, 1]))
        x = f"c{i}"
        slope = f"body.{i + 1}.weight"
        if slope in sd:
            inits.append(numpy_helper.from_array(sd[slope].astype(np.float32).reshape(-1, 1, 1), slope))
            nodes.append(helper.make_node("PRelu", [x, slope], [f"a{i}"]))
            x = f"a{i}"
    nodes.append(helper.make_node("DepthToSpace", [x], ["up"], blocksize=upscale, mode="CRD"))
    inits.append(numpy_helper.from_array(np.array([1, 1, upscale, upscale], np.float32), "scales"))
    nodes.append(helper.make_node("Resize", ["input", "", "scales"], ["base"], mode="nearest"))
    nodes.append(helper.make_node("Add", ["up", "base"], ["output"]))
    graph = helper.make_graph(
        nodes, "srvgg", [helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 3, None, None])],
        [helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 3, None, None])], inits,
    )
    # IR 8 / opset 17: readable by any ONNX Runtime from 1.14 on
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)], ir_version=8)
    onnx.checker.check_model(model)
    return model


def session():
    CACHE.mkdir(parents=True, exist_ok=True)
    onx = CACHE / f"realesr-general-x4v3-dn{DENOISE}.onnx"
    if not onx.exists():
        weights = []
        for name in ("realesr-general-x4v3", "realesr-general-wdn-x4v3"):
            pth = CACHE / f"{name}.pth"
            if not pth.exists():
                print(f"downloading {name} (5 MB)…")
                urllib.request.urlretrieve(WEIGHTS_URL.format(name), pth)
            weights.append(load_pth(pth))
        full, wdn = weights
        onnx.save(build_onnx({k: DENOISE * full[k] + (1 - DENOISE) * wdn[k] for k in full}), onx)
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
            im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=30, threshold=2))
            dest = folder / f"{p.stem}{suffix}.webp"
            im.save(dest, "WEBP", quality=88, method=6)
            print(f"{dest.relative_to(ROOT)}  {width}x{h}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
