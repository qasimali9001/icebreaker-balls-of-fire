"""
Render reference solution PNGs for each level (grid + winning path from find_solution_path).

Requires: pip install pillow
Run from repo root: python tools/render_solutions.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_level import find_solution_path, parse  # noqa: E402

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
LEVELS = ROOT / "src" / "levels"
OUT = ROOT / "solutions"

# Tile colours (fill per cell type)
COL = {
    "WALL": (45, 52, 72),
    "VOID": (20, 22, 30),
    "ICE": (165, 220, 245),
    "DEEP_ICE": (80, 165, 195),
    "START": (90, 210, 150),
    "EXIT": (255, 200, 100),
    "KEY": (230, 210, 120),
    "LOCKED": (130, 125, 118),
}


def cell_colour(t):
    return COL.get(t, (100, 100, 110))


def render_level(grid, path, out_path, cell=22, pad=2):
    types, start, exit, *_ = parse(grid)
    rows, cols = len(types), len(types[0])
    w = pad * 2 + cols * cell
    h = pad * 2 + rows * cell
    im = Image.new("RGB", (w, h), (12, 14, 22))
    dr = ImageDraw.Draw(im)

    for r in range(rows):
        for c in range(cols):
            t = types[r][c]
            x0 = pad + c * cell
            y0 = pad + r * cell
            dr.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], fill=cell_colour(t))
            dr.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], outline=(30, 34, 48))

    if path and len(path) >= 2:
        pts = [((pad + c * cell + cell // 2), (pad + r * cell + cell // 2)) for r, c in path]
        dr.line(pts, fill=(255, 95, 45), width=max(3, cell // 7))
        for r, c in path:
            x0 = pad + c * cell + cell // 2 - 3
            y0 = pad + r * cell + cell // 2 - 3
            dr.ellipse([x0, y0, x0 + 6, y0 + 6], fill=(255, 200, 80))

    im.save(out_path, "PNG")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(LEVELS.glob("level*.json"))
    if not files:
        print("No levels found", file=sys.stderr)
        sys.exit(1)

    for fp in files:
        data = json.loads(fp.read_text(encoding="utf-8"))
        grid = data.get("grid", data)
        path = find_solution_path(grid)
        n = fp.stem.replace("level", "")
        out = OUT / f"level{n}.png"
        if path is None:
            print(f"SKIP {fp.name} — no solution path (unsolvable?)")
            continue
        render_level(grid, path, out)
        print(f"Wrote {out.relative_to(ROOT)} ({len(path)} steps)")

    print("Done.")


if __name__ == "__main__":
    main()
