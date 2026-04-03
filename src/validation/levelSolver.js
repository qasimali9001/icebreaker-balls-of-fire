import { TileType, tileTypeFromCode } from "../grid/TileTypes.js";

/**
 * @param {unknown} levelData
 * @returns {{
 *   rows: number,
 *   cols: number,
 *   types: TileType[][],
 *   iceIndex: Map<string, number>,
 *   iceCount: number,
 *   deepIndex: Map<string, number>,
 *   deepCount: number,
 *   start: { r: number; c: number },
 *   exit: { r: number; c: number },
 *   hasKeyTile: boolean,
 * }}
 */
function parseLevel(levelData) {
  const grid = Array.isArray(levelData) ? levelData : levelData?.grid;
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0])) {
    throw new Error("Level must be a 2D array or { grid: 2D array }.");
  }
  const rows = grid.length;
  const cols = grid[0].length;
  /** @type {TileType[][]} */
  const types = [];
  for (let r = 0; r < rows; r++) {
    types[r] = [];
    for (let c = 0; c < cols; c++) {
      types[r][c] = tileTypeFromCode(grid[r][c]);
    }
  }

  let start = null;
  let exit = null;
  /** @type {Map<string, number>} */
  const iceIndex = new Map();
  let iceCount = 0;
  /** @type {Map<string, number>} */
  const deepIndex = new Map();
  let deepCount = 0;
  let hasKeyTile = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = types[r][c];
      if (t === TileType.START) start = { r, c };
      if (t === TileType.EXIT) exit = { r, c };
      if (t === TileType.ICE) {
        iceIndex.set(`${r},${c}`, iceCount++);
      }
      if (t === TileType.DEEP_ICE) {
        deepIndex.set(`${r},${c}`, deepCount++);
      }
      if (t === TileType.KEY) hasKeyTile = true;
    }
  }

  if (!start) throw new Error("No start (S) tile.");
  if (!exit) throw new Error("No exit (E) tile.");
  if (iceCount === 0 && deepCount === 0) throw new Error("No ice (I) or deep ice (D) tiles.");

  return { rows, cols, types, iceIndex, iceCount, deepIndex, deepCount, start, exit, hasKeyTile };
}

const DR = [-1, 1, 0, 0];
const DC = [0, 0, -1, 1];

/**
 * Win: stand on EXIT with every normal ice melted and every deep ice fully cleared (two leaves).
 * Matches InputHandler: non-deep cells at most one visit; deep ice at most two visits; key before locks.
 *
 * State: position, iceMask, deepGoneMask, deepCrackedMask, hasKey, onceVis, twiceVis
 */
export function validateLevelSolvability(levelData) {
  let parsed;
  try {
    parsed = parseLevel(levelData);
  } catch (e) {
    return { solvable: false, reason: String(e?.message || e) };
  }

  const { rows, cols, types, iceIndex, iceCount, deepIndex, deepCount, start, exit } = parsed;
  const fullIce = iceCount > 0 ? 2 ** iceCount - 1 : 0;
  const fullDeepGone = deepCount > 0 ? 2 ** deepCount - 1 : 0;
  const cells = rows * cols;
  const useBigVis = cells > 30;

  /**
   * @param {number} r
   * @param {number} c
   */
  function cellVisitBit(r, c) {
    const i = r * cols + c;
    if (useBigVis) {
      return 1n << BigInt(i);
    }
    return 2 ** i;
  }

  /**
   * @param {number | bigint} vis
   * @param {number} r
   * @param {number} c
   */
  function hasVisited(vis, r, c) {
    const b = cellVisitBit(r, c);
    if (useBigVis) {
      return (/** @type {bigint} */ (vis) & /** @type {bigint} */ (b)) !== 0n;
    }
    return (/** @type {number} */ (vis) & /** @type {number} */ (b)) !== 0;
  }

  /**
   * @param {number | bigint} vis
   * @param {number} r
   * @param {number} c
   */
  function withVisited(vis, r, c) {
    const b = cellVisitBit(r, c);
    if (useBigVis) {
      return /** @type {bigint} */ (vis) | /** @type {bigint} */ (b);
    }
    return /** @type {number} */ (vis) | /** @type {number} */ (b);
  }

  const zVis = useBigVis ? 0n : 0;
  const startVisit = withVisited(zVis, start.r, start.c);

  /**
   * @param {number} r
   * @param {number} c
   * @param {number} iceMask
   * @param {number} goneDeep
   * @param {number} crackedDeep
   * @param {boolean} hasKey
   * @param {number | bigint} onceVis
   * @param {number | bigint} twiceVis
   */
  function canEnter(r, c, iceMask, goneDeep, crackedDeep, hasKey, onceVis, twiceVis) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const t = types[r][c];
    if (t === TileType.WALL || t === TileType.VOID) return false;

    if (t === TileType.ICE) {
      const idx = iceIndex.get(`${r},${c}`);
      if (idx === undefined) return false;
      if ((iceMask & 2 ** idx) !== 0) return false;
      if (hasVisited(onceVis, r, c)) return false;
      return true;
    }

    if (t === TileType.DEEP_ICE) {
      const di = deepIndex.get(`${r},${c}`);
      if (di === undefined) return false;
      if ((goneDeep & 2 ** di) !== 0) return false;
      const cracked = (crackedDeep & 2 ** di) !== 0;
      if (!hasVisited(onceVis, r, c)) return true;
      if (hasVisited(onceVis, r, c) && !hasVisited(twiceVis, r, c) && cracked) return true;
      return false;
    }

    if (t === TileType.KEY) {
      if (hasKey) return false;
      if (hasVisited(onceVis, r, c)) return false;
      return true;
    }

    if (t === TileType.LOCKED) {
      if (!hasKey) return false;
      if (hasVisited(onceVis, r, c)) return false;
      return true;
    }

    if (t === TileType.START) {
      if (hasVisited(onceVis, r, c)) return false;
      return true;
    }

    if (t === TileType.EXIT) {
      if (hasVisited(onceVis, r, c)) return false;
      return true;
    }

    return false;
  }

  /**
   * @param {number} r
   * @param {number} c
   * @param {number} iceMask
   */
  function iceMaskAfterLeaving(r, c, iceMask) {
    if (types[r][c] !== TileType.ICE) return iceMask;
    const idx = iceIndex.get(`${r},${c}`);
    if (idx === undefined) return iceMask;
    return iceMask | 2 ** idx;
  }

  /**
   * @param {number} r
   * @param {number} c
   * @param {number} goneDeep
   * @param {number} crackedDeep
   */
  function deepMasksAfterLeaving(r, c, goneDeep, crackedDeep) {
    if (types[r][c] !== TileType.DEEP_ICE) {
      return { goneDeep, crackedDeep };
    }
    const di = deepIndex.get(`${r},${c}`);
    if (di === undefined) return { goneDeep, crackedDeep };
    const bit = 2 ** di;
    if ((goneDeep & bit) !== 0) return { goneDeep, crackedDeep };
    if ((crackedDeep & bit) === 0) {
      return { goneDeep, crackedDeep: crackedDeep | bit };
    }
    return { goneDeep: goneDeep | bit, crackedDeep: crackedDeep & ~bit };
  }

  const queue = [
    {
      r: start.r,
      c: start.c,
      iceMask: 0,
      goneDeep: 0,
      crackedDeep: 0,
      hasKey: false,
      onceVis: startVisit,
      twiceVis: zVis,
    },
  ];
  const seen = new Set();
  const sk0 = `${start.r},${start.c},0,0,0,0,${String(startVisit)},${String(zVis)}`;
  seen.add(sk0);

  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const { r, c, iceMask, goneDeep, crackedDeep, hasKey, onceVis, twiceVis } = cur;

    if (
      types[r][c] === TileType.EXIT &&
      iceMask === fullIce &&
      goneDeep === fullDeepGone
    ) {
      return { solvable: true, iceCount, deepCount };
    }

    for (let i = 0; i < 4; i++) {
      const nr = r + DR[i];
      const nc = c + DC[i];
      if (!canEnter(nr, nc, iceMask, goneDeep, crackedDeep, hasKey, onceVis, twiceVis)) continue;

      let nextIce = iceMaskAfterLeaving(r, c, iceMask);
      const deepOut = deepMasksAfterLeaving(r, c, goneDeep, crackedDeep);
      let nextGone = deepOut.goneDeep;
      let nextCracked = deepOut.crackedDeep;

      const tDest = types[nr][nc];
      let nextHasKey = hasKey;
      if (tDest === TileType.KEY) nextHasKey = true;

      let nextOnce = onceVis;
      let nextTwice = twiceVis;

      if (tDest === TileType.DEEP_ICE) {
        const di = deepIndex.get(`${nr},${nc}`);
        if (di !== undefined && hasVisited(onceVis, nr, nc) && !hasVisited(twiceVis, nr, nc)) {
          nextTwice = withVisited(twiceVis, nr, nc);
        }
      }
      nextOnce = withVisited(nextOnce, nr, nc);

      const sk = `${nr},${nc},${nextIce},${nextGone},${nextCracked},${nextHasKey ? 1 : 0},${String(nextOnce)},${String(nextTwice)}`;
      if (seen.has(sk)) continue;
      seen.add(sk);
      queue.push({
        r: nr,
        c: nc,
        iceMask: nextIce,
        goneDeep: nextGone,
        crackedDeep: nextCracked,
        hasKey: nextHasKey,
        onceVis: nextOnce,
        twiceVis: nextTwice,
      });
    }
  }

  return {
    solvable: false,
    reason: `No valid path (rules: no illegal revisits, key before locks, deep ice cleared twice, all ice melted, reach exit). Ice: ${iceCount}, deep: ${deepCount}.`,
    iceCount,
    deepCount,
  };
}

/**
 * @param {unknown} levelData
 * @param {string} [label]
 */
export function assertLevelSolvable(levelData, label = "Level") {
  const res = validateLevelSolvability(levelData);
  if (!res.solvable) {
    throw new Error(`${label} is not solvable: ${res.reason || "unknown"}`);
  }
}
