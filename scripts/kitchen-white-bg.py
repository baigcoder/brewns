"""
Puts the kitchen photos on a clean white background, like the coffee shots:
the dish is cut out, centred on a white square with a soft shadow under it.

  pip install rembg onnxruntime pillow
  python scripts/kitchen-white-bg.py            # every photo in public/assets/kitchen/
  python scripts/kitchen-white-bg.py smash-burger.jpg

The untouched originals are kept in assets-src/kitchen/ (not served), so a
photo can be redone from its original at any time.
"""
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public/assets/kitchen"
ORIGINALS = ROOT / "assets-src/kitchen"
SIZE = 1000  # output square, px
MARGIN = 0.1  # space around the dish, share of the side
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def studio(photo: Image.Image, session) -> Image.Image:
    cut = remove(photo.convert("RGB"), session=session, post_process_mask=True)
    box = cut.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    if box:
        cut = cut.crop(box)
    scale = SIZE * (1 - 2 * MARGIN) / max(cut.size)
    cut = cut.resize((max(1, round(cut.width * scale)), max(1, round(cut.height * scale))), Image.LANCZOS)
    x, y = (SIZE - cut.width) // 2, (SIZE - cut.height) // 2 + round(SIZE * 0.02)

    out = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    # a soft contact shadow under the dish, then the dish itself
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    w, h = round(cut.width * 0.8), round(cut.height * 0.1)
    ellipse = Image.new("L", (w, max(h, 8)), 0)
    from PIL import ImageDraw

    ImageDraw.Draw(ellipse).ellipse((0, 0, w - 1, max(h, 8) - 1), fill=70)
    shadow.paste((60, 45, 35, 255), (x + (cut.width - w) // 2, y + cut.height - h // 2), ellipse)
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(SIZE * 0.02)))
    out.alpha_composite(cut, (x, y))
    return out.convert("RGB")


def main():
    names = sys.argv[1:] or sorted(p.name for p in PUBLIC.iterdir() if p.suffix.lower() in EXTS)
    if not names:
        print(f"No photos in {PUBLIC}")
        return
    ORIGINALS.mkdir(parents=True, exist_ok=True)
    session = new_session("isnet-general-use")
    for name in names:
        src = PUBLIC / name
        original = ORIGINALS / name
        if not original.exists():
            shutil.copy2(src, original)  # keep the untouched photo once
        result = studio(Image.open(original), session)
        dest = PUBLIC / f"{Path(name).stem}.jpg"
        if src != dest:
            src.unlink()
        result.save(dest, quality=88, optimize=True, progressive=True)
        print(f"{name} -> {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
