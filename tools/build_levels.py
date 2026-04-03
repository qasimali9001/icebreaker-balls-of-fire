"""
Levels are authored in src/levels/level*.json (single outer wall ring).

This script only validates solvability — it does not overwrite level files.

Run: python tools/build_levels.py
     python tools/check_level.py
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_level import solvable  # noqa: E402


def main():
    base = Path(__file__).resolve().parent.parent / "src" / "levels"
    files = sorted(base.glob("level*.json"))
    if not files:
        print("No levels found.")
        return
    for fp in files:
        data = json.loads(fp.read_text(encoding="utf-8"))
        g = data.get("grid", data)
        t0 = time.perf_counter()
        ok = solvable(g)
        dt = time.perf_counter() - t0
        rows, cols = len(g), len(g[0])
        print(fp.name, f"{rows}x{cols}", "OK" if ok else "FAIL", f"{dt:.3f}s")
        if not ok:
            raise SystemExit(f"{fp.name} is not solvable.")
    print("Validated", len(files), "levels.")


if __name__ == "__main__":
    main()
