"""
Each level: inner puzzle wrapped in exactly one tile of W on all sides (no extra outer padding).

Run: python tools/build_levels.py && python tools/check_level.py
"""
import json
import time
from collections import deque
from pathlib import Path

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


def solvable(grid):
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
    q = deque([(start[0], start[1], 0, start_vis)])
    seen = {(start[0], start[1], 0, start_vis)}

    while q:
        r, c, mask, vis = q.popleft()
        if types[r][c] == "EXIT" and mask == full:
            return True
        for i in range(4):
            nr, nc = r + DR[i], c + DC[i]
            if not can_enter(nr, nc, mask):
                continue
            if vis & (1 << idx(nr, nc)):
                continue
            nm = leave_mask(r, c, mask)
            nvis = vis | (1 << idx(nr, nc))
            key = (nr, nc, nm, nvis)
            if key in seen:
                continue
            seen.add(key)
            q.append(key)
    return False


def add_single_border(inner):
    rows, cols = len(inner), len(inner[0])
    R, C = rows + 2, cols + 2
    g = [["W"] * C for _ in range(R)]
    for r in range(rows):
        for c in range(cols):
            g[r + 1][c + 1] = inner[r][c]
    return g


def main():
    base = Path(__file__).resolve().parent.parent / "src" / "levels"

    inner1 = [
        ["S", "I", "I", "I"],
        ["I", "I", "I", "I"],
        ["I", "I", "I", "E"],
    ]
    inner2 = [
        ["S", "I", "I", "I"],
        ["I", "I", "W", "I"],
        ["I", "I", "I", "I"],
        ["I", "I", "I", "E"],
    ]

    # Interior walls only; S top-left, E bottom-right where noted.
    inner3 = [
        ["S", "I", "I", "I", "I"],
        ["I", "I", "W", "I", "I"],
        ["I", "I", "I", "I", "I"],
        ["I", "W", "I", "I", "I"],
        ["I", "I", "I", "I", "E"],
    ]
    inner4 = [
        ["S", "I", "I", "I", "I", "I"],
        ["I", "I", "I", "W", "I", "I"],
        ["I", "W", "I", "I", "I", "I"],
        ["I", "I", "I", "I", "W", "I"],
        ["I", "I", "I", "I", "I", "I"],
        ["I", "I", "I", "I", "I", "E"],
    ]
    inner5 = [
        ["S", "I", "I", "I", "I", "I", "I"],
        ["I", "I", "W", "I", "I", "I", "I"],
        ["I", "I", "I", "I", "W", "I", "I"],
        ["I", "W", "I", "I", "I", "I", "I"],
        ["I", "I", "I", "W", "I", "I", "I"],
        ["I", "I", "I", "I", "I", "I", "E"],
    ]
    inner6 = [
        ["S", "I", "I", "I", "I", "I"],
        ["I", "I", "W", "I", "I", "I"],
        ["I", "I", "I", "I", "W", "I"],
        ["I", "W", "I", "I", "I", "I"],
        ["I", "I", "I", "W", "I", "I"],
        ["I", "I", "I", "I", "I", "I"],
        ["I", "I", "I", "I", "I", "E"],
    ]

    specs = [
        ("level1.json", add_single_border(inner1)),
        ("level2.json", add_single_border(inner2)),
        ("level3.json", add_single_border(inner3)),
        ("level4.json", add_single_border(inner4)),
        ("level5.json", add_single_border(inner5)),
        ("level6.json", add_single_border(inner6)),
    ]

    for name, g in specs:
        ice = parse(g)[4]
        t0 = time.perf_counter()
        ok = solvable(g)
        dt = time.perf_counter() - t0
        print(name, "size", len(g), "x", len(g[0]), "ice", ice, "OK" if ok else "FAIL", f"{dt:.3f}s")
        if not ok:
            raise SystemExit(f"Fix inner layout for {name} (not strictly solvable).")

    for name, g in specs:
        (base / name).write_text(
            json.dumps({"tileSize": 1, "grid": g}, indent=2) + "\n",
            encoding="utf-8",
        )
    print("Wrote", len(specs), "files.")


if __name__ == "__main__":
    main()
