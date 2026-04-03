"""
Solve each level with the same strict rules as the game, then save a PNG of the grid + path.

Requires: pip install pillow

Usage: python tools/render_solution_images.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    raise SystemExit(1)

CODE = {"S": "START", "I": "ICE", "W": "WALL", "E": "EXIT"}


def parse(grid):
    rows, cols = len(grid), len(grid[0])
    types = [[CODE.get(grid[r][c], "VOID") for c in range(cols)] for r in range(rows)]
    start = exit = None
    ice_index = {}
    ice_count = 0
    for r in range(rows):
        for c in range(cols):
            t = types[r][c]
            if t == "START":
                start = (r, c)
            elif t == "EXIT":
                exit = (r, c)
            elif t == "ICE":
                ice_index[(r, c)] = ice_count
                ice_count += 1
    return types, start, exit, ice_index, ice_count


def coords_from_key(key: str) -> tuple[int, int]:
    m = re.match(r"^(\d+),(\d+),", key)
    if not m:
        return 0, 0
    return int(m.group(1)), int(m.group(2))


def find_path(grid):
    types, start, exit, ice_index, ice_count = parse(grid)
    rows, cols = len(types), len(types[0])
    full = (1 << ice_count) - 1 if ice_count else 0
    DR, DC = (-1, 1, 0, 0), (0, 0, -1, 1)

    def idx(r, c):
        return r * cols + c

    def can_enter(r, c, mask):
        if r < 0 or r >= rows or c < 0 or c >= cols:
            return False
        t = types[r][c]
        if t in ("WALL", "VOID"):
            return False
        if t == "ICE":
            i = ice_index[(r, c)]
            return (mask & (1 << i)) == 0
        return True

    def leave_mask(r, c, mask):
        if types[r][c] != "ICE":
            return mask
        i = ice_index[(r, c)]
        return mask | (1 << i)

    start_vis = 1 << idx(start[0], start[1])
    sk0 = f"{start[0]},{start[1]},0,{start_vis}"
    q = deque([(start[0], start[1], 0, start_vis)])
    seen = {sk0}
    parent = {sk0: None}
    goal_key = None

    while q:
        r, c, mask, vis = q.popleft()
        cur_key = f"{r},{c},{mask},{vis}"
        if types[r][c] == "EXIT" and mask == full:
            goal_key = cur_key
            break
        for i in range(4):
            nr, nc = r + DR[i], c + DC[i]
            if not can_enter(nr, nc, mask):
                continue
            if vis & (1 << idx(nr, nc)):
                continue
            nm = leave_mask(r, c, mask)
            nvis = vis | (1 << idx(nr, nc))
            sk = f"{nr},{nc},{nm},{nvis}"
            if sk in seen:
                continue
            seen.add(sk)
            parent[sk] = cur_key
            q.append((nr, nc, nm, nvis))

    if not goal_key:
        return None

    path_rev = []
    k = goal_key
    while k:
        path_rev.append(coords_from_key(k))
        k = parent[k]
    path_rev.reverse()
    return path_rev


def render_png(out_path: Path, grid, path: list[tuple[int, int]]) -> None:
    rows, cols = len(grid), len(grid[0])
    max_dim = max(rows, cols)
    cell = max(18, min(40, 900 // max_dim))
    pad = 8

    w = cols * cell + pad * 2
    h = rows * cell + pad * 2
    img = Image.new("RGB", (w, h), (7, 10, 18))
    draw = ImageDraw.Draw(img)

    colors = {
        "W": (40, 48, 72),
        "S": (55, 145, 105),
        "E": (195, 150, 65),
        "I": (165, 220, 245),
    }
    outline = (22, 28, 45)

    for r in range(rows):
        for c in range(cols):
            x0 = pad + c * cell
            y0 = pad + r * cell
            ch = grid[r][c]
            fill = colors.get(ch, (30, 35, 50))
            draw.rectangle([x0, y0, x0 + cell - 1, y0 + cell - 1], fill=fill, outline=outline)

    centers = [(pad + c * cell + cell // 2, pad + r * cell + cell // 2) for r, c in path]
    if len(centers) >= 2:
        draw.line(centers, fill=(57, 255, 181), width=max(2, cell // 10))

    try:
        font = ImageFont.truetype("arial.ttf", max(10, cell // 2 - 2))
    except OSError:
        try:
            font = ImageFont.truetype("DejaVuSans.ttf", max(10, cell // 2 - 2))
        except OSError:
            font = ImageFont.load_default()

    for i, (r, c) in enumerate(path):
        cx = pad + c * cell + cell // 2
        cy = pad + r * cell + cell // 2
        t = str(i + 1)
        if hasattr(draw, "textbbox"):
            bbox = draw.textbbox((0, 0), t, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
        else:
            tw, th = draw.textsize(t, font=font)
        # shadow for readability
        for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            draw.text((cx - tw // 2 + dx, cy - th // 2 + dy), t, fill=(0, 0, 0), font=font)
        draw.text((cx - tw // 2, cy - th // 2), t, fill=(230, 255, 248), font=font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "PNG", optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    levels_dir = root / "src" / "levels"
    out_dir = root / "solutions"
    failed = False
    for jf in sorted(levels_dir.glob("level*.json")):
        data = json.loads(jf.read_text(encoding="utf-8"))
        grid = data.get("grid", data)
        path = find_path(grid)
        name = jf.stem
        png = out_dir / f"{name}.png"
        if not path:
            print(f"FAIL {name} — no solution")
            failed = True
            continue
        render_png(png, grid, path)
        print(f"OK   {name}.png  ({len(path)} steps)")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
