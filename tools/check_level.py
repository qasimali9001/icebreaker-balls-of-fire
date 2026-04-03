"""Solvability check matching game + InputHandler (incl. deep ice, key, lock)."""
import json
import sys
from collections import deque
from pathlib import Path

CODE = {
    "S": "START",
    "I": "ICE",
    "D": "DEEP_ICE",
    "W": "WALL",
    "E": "EXIT",
    "K": "KEY",
    "L": "LOCKED",
}


def parse(grid):
    rows, cols = len(grid), len(grid[0])
    types = [[CODE.get(grid[r][c], "VOID") for c in range(cols)] for r in range(rows)]
    start = exit = None
    ice_index = {}
    ice_count = 0
    deep_index = {}
    deep_count = 0
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
            elif t == "DEEP_ICE":
                deep_index[(r, c)] = deep_count
                deep_count += 1
    if not start or not exit:
        raise ValueError("Missing S or E")
    if ice_count == 0 and deep_count == 0:
        raise ValueError("No I or D tiles")
    return types, start, exit, ice_index, ice_count, deep_index, deep_count


def solvable(grid):
    """True iff find_solution_path returns a winning route."""
    return find_solution_path(grid) is not None


def find_solution_path(grid):
    """
    Return a list of (row, col) cells along one winning path, or None if unsolvable.
    Matches the same rules as solvable().
    """
    types, start, exit, ice_index, ice_count, deep_index, deep_count = parse(grid)
    rows, cols = len(types), len(types[0])
    full_ice = 2**ice_count - 1 if ice_count else 0
    full_deep_gone = 2**deep_count - 1 if deep_count else 0
    DR, DC = (-1, 1, 0, 0), (0, 0, -1, 1)

    cells = rows * cols
    use_big = cells > 30

    def bit(r, c):
        i = r * cols + c
        if use_big:
            return 1 << i
        return 2**i

    def has_vis(vis, r, c):
        b = bit(r, c)
        return (vis & b) != 0

    def with_vis(vis, r, c):
        return vis | bit(r, c)

    z = 0
    start_vis = with_vis(z, start[0], start[1])

    def can_enter(r, c, ice_mask, gone_deep, cracked_deep, has_key, once_vis, twice_vis):
        if r < 0 or r >= rows or c < 0 or c >= cols:
            return False
        t = types[r][c]
        if t in ("WALL", "VOID"):
            return False
        if t == "ICE":
            if (r, c) not in ice_index:
                return False
            i = ice_index[(r, c)]
            if (ice_mask & (2**i)) != 0:
                return False
            if has_vis(once_vis, r, c):
                return False
            return True
        if t == "DEEP_ICE":
            if (r, c) not in deep_index:
                return False
            di = deep_index[(r, c)]
            if (gone_deep & (2**di)) != 0:
                return False
            cracked = (cracked_deep & (2**di)) != 0
            if not has_vis(once_vis, r, c):
                return True
            if has_vis(once_vis, r, c) and not has_vis(twice_vis, r, c) and cracked:
                return True
            return False
        if t == "KEY":
            if has_key:
                return False
            if has_vis(once_vis, r, c):
                return False
            return True
        if t == "LOCKED":
            if not has_key:
                return False
            if has_vis(once_vis, r, c):
                return False
            return True
        if t == "START":
            if has_vis(once_vis, r, c):
                return False
            return True
        if t == "EXIT":
            if has_vis(once_vis, r, c):
                return False
            return True
        return False

    def leave_ice(r, c, ice_mask):
        if types[r][c] != "ICE":
            return ice_mask
        i = ice_index[(r, c)]
        return ice_mask | (2**i)

    def leave_deep(r, c, gone_deep, cracked_deep):
        if types[r][c] != "DEEP_ICE":
            return gone_deep, cracked_deep
        di = deep_index[(r, c)]
        b = 2**di
        if (gone_deep & b) != 0:
            return gone_deep, cracked_deep
        if (cracked_deep & b) == 0:
            return gone_deep, cracked_deep | b
        return gone_deep | b, cracked_deep & ~b

    start_key = (start[0], start[1], 0, 0, 0, False, start_vis, z)
    q = deque(
        [
            {
                "r": start[0],
                "c": start[1],
                "ice": 0,
                "gone_deep": 0,
                "cracked_deep": 0,
                "has_key": False,
                "once": start_vis,
                "twice": z,
            }
        ]
    )
    seen = {start_key}
    parent = {start_key: None}

    while q:
        cur = q.popleft()
        r, c = cur["r"], cur["c"]
        ice_mask = cur["ice"]
        gone_deep = cur["gone_deep"]
        cracked_deep = cur["cracked_deep"]
        has_key = cur["has_key"]
        once_vis = cur["once"]
        twice_vis = cur["twice"]
        cur_key = (r, c, ice_mask, gone_deep, cracked_deep, has_key, once_vis, twice_vis)

        if types[r][c] == "EXIT" and ice_mask == full_ice and gone_deep == full_deep_gone:
            path = []
            k = cur_key
            while k is not None:
                path.append((k[0], k[1]))
                k = parent[k]
            path.reverse()
            return path

        for i in range(4):
            nr, nc = r + DR[i], c + DC[i]
            if not can_enter(
                nr,
                nc,
                ice_mask,
                gone_deep,
                cracked_deep,
                has_key,
                once_vis,
                twice_vis,
            ):
                continue

            next_ice = leave_ice(r, c, ice_mask)
            ng, nc_ = leave_deep(r, c, gone_deep, cracked_deep)
            next_gone, next_cracked = ng, nc_
            next_key_flag = has_key
            if types[nr][nc] == "KEY":
                next_key_flag = True

            next_once = once_vis
            next_twice = twice_vis
            if types[nr][nc] == "DEEP_ICE" and (nr, nc) in deep_index:
                if has_vis(once_vis, nr, nc) and not has_vis(twice_vis, nr, nc):
                    next_twice = with_vis(twice_vis, nr, nc)
            next_once = with_vis(next_once, nr, nc)

            next_key = (nr, nc, next_ice, next_gone, next_cracked, next_key_flag, next_once, next_twice)
            if next_key in seen:
                continue
            seen.add(next_key)
            parent[next_key] = cur_key
            q.append(
                {
                    "r": nr,
                    "c": nc,
                    "ice": next_ice,
                    "gone_deep": next_gone,
                    "cracked_deep": next_cracked,
                    "has_key": next_key_flag,
                    "once": next_once,
                    "twice": next_twice,
                }
            )
    return None


def main():
    base = Path(__file__).resolve().parent.parent / "src" / "levels"
    failed = False
    for name in sorted(base.glob("*.json")):
        data = json.loads(name.read_text(encoding="utf-8"))
        g = data.get("grid", data)
        try:
            ok = solvable(g)
        except Exception as e:
            print(f"FAIL {name.name}  — {e}")
            failed = True
            continue
        print(("OK " if ok else "FAIL ") + name.name)
        if not ok:
            failed = True
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
