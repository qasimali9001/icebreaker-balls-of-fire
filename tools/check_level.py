"""Solvability check matching game + InputHandler: no tile may appear twice in the path (incl. S/E)."""
import json
import sys
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
    full = 2**ice_count - 1 if ice_count else 0
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
            return (mask & (2**i)) == 0
        return True

    def leave_mask(r, c, mask):
        if types[r][c] != "ICE":
            return mask
        i = ice_index[(r, c)]
        return mask | (2**i)

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


def main():
    base = Path(__file__).resolve().parent.parent / "src" / "levels"
    failed = False
    for name in sorted(base.glob("*.json")):
        data = json.loads(name.read_text(encoding="utf-8"))
        g = data.get("grid", data)
        ok = solvable(g)
        print(("OK " if ok else "FAIL ") + name.name)
        if not ok:
            failed = True
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
