import { TileType, tileTypeFromCode } from "../grid/TileTypes.js";

/**
 * @param {unknown} levelData
 * @returns {{ rows: number, cols: number, types: TileType[][], iceIndex: Map<string, number>, iceCount: number, start: {r:number,c:number}, exit: {r:number,c:number} }}
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

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = types[r][c];
      if (t === TileType.START) start = { r, c };
      if (t === TileType.EXIT) exit = { r, c };
      if (t === TileType.ICE) {
        iceIndex.set(`${r},${c}`, iceCount++);
      }
    }
  }

  if (!start) throw new Error("No start (S) tile.");
  if (!exit) throw new Error("No exit (E) tile.");
  if (iceCount === 0) throw new Error("No ice (I) tiles.");

  return { rows, cols, types, iceIndex, iceCount, start, exit };
}

const DR = [-1, 1, 0, 0];
const DC = [0, 0, -1, 1];

/**
 * Win: stand on EXIT with every ice tile melted.
 * Ice cannot be re-entered after melting.
 *
 * **Important (matches `InputHandler`):** the drawn path cannot visit **any** cell twice —
 * including **start** and **exit**. So this search uses a visited-cell bitmask in addition to
 * the ice-melt mask. A graph-only solver that allows revisiting S would mark some levels
 * “solvable” when they are not playable in-game.
 *
 * State: (r, c, iceMask, visitedMask)
 */
export function validateLevelSolvability(levelData) {
  let parsed;
  try {
    parsed = parseLevel(levelData);
  } catch (e) {
    return { solvable: false, reason: String(e?.message || e) };
  }

  const { rows, cols, types, iceIndex, iceCount, start, exit } = parsed;
  const fullIce = iceCount > 0 ? 2 ** iceCount - 1 : 0;
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

  const startVisit = withVisited(useBigVis ? 0n : 0, start.r, start.c);

  /**
   * @param {number} r
   * @param {number} c
   * @param {number} iceMask
   */
  function canEnter(r, c, iceMask) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const t = types[r][c];
    if (t === TileType.WALL || t === TileType.VOID) return false;
    if (t === TileType.ICE) {
      const idx = iceIndex.get(`${r},${c}`);
      if (idx === undefined) return false;
      return (iceMask & 2 ** idx) === 0;
    }
    return true;
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

  const queue = [{ r: start.r, c: start.c, iceMask: 0, visitedMask: startVisit }];
  const seen = new Set();
  const sk0 = `${start.r},${start.c},0,${String(startVisit)}`;
  seen.add(sk0);

  let qi = 0;
  while (qi < queue.length) {
    const { r, c, iceMask, visitedMask } = queue[qi++];

    if (types[r][c] === TileType.EXIT && iceMask === fullIce) {
      return { solvable: true, iceCount };
    }

    for (let i = 0; i < 4; i++) {
      const nr = r + DR[i];
      const nc = c + DC[i];
      if (!canEnter(nr, nc, iceMask)) continue;
      if (hasVisited(visitedMask, nr, nc)) continue;

      const nextIce = iceMaskAfterLeaving(r, c, iceMask);
      const nextVis = withVisited(visitedMask, nr, nc);
      const sk = `${nr},${nc},${nextIce},${String(nextVis)}`;
      if (seen.has(sk)) continue;
      seen.add(sk);
      queue.push({ r: nr, c: nc, iceMask: nextIce, visitedMask: nextVis });
    }
  }

  return {
    solvable: false,
    reason: `No valid path (no tile revisit, all ice melted, reach exit). Ice tiles: ${iceCount}.`,
    iceCount,
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
