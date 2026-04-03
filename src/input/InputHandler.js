export class InputHandler {
  /**
   * @param {{
   *  canvas: HTMLCanvasElement,
   *  scene: import('../rendering/SceneManager.js').SceneManager,
   *  grid: import('../grid/GridManager.js').GridManager,
   *  getAnchorCell: () => {row:number,col:number} | null,
 *  onPathCommitted?: (path: {row:number,col:number}[]) => void,
 *  onPathExtended?: (segment: {row:number,col:number}[]) => void
   * }} opts
   */
  constructor(opts) {
    this.canvas = opts.canvas;
    this.scene = opts.scene;
    this.grid = opts.grid;
    this.getAnchorCell = opts.getAnchorCell;
    this.onPathCommitted = opts.onPathCommitted;
    this.onPathExtended = opts.onPathExtended;

    this.enabled = true;

    // How far outside the grid (in tiles) we still "snap" to the nearest edge tile.
    // This avoids janky resets when a player drifts slightly past the board boundary.
    this.boundaryDeadzoneTiles = 0.9;

    this._pointerId = null;
    this._isDown = false;
    /** @type {{ x: number, z: number } | null} */
    this._gestureStartWorld = null;
    /** @type {Array<{row:number,col:number}>} */
    this._path = [];
    /** @type {Set<string>} */
    this._pathSet = new Set();

    this._onPointerDown = (e) => this._handlePointerDown(e);
    this._onPointerMove = (e) => this._handlePointerMove(e);
    this._onPointerUp = (e) => this._handlePointerUp(e);
    this._onPointerCancel = (e) => this._handlePointerUp(e);

    this.canvas.addEventListener("pointerdown", this._onPointerDown, { passive: false });
    this.canvas.addEventListener("pointermove", this._onPointerMove, { passive: false });
    this.canvas.addEventListener("pointerup", this._onPointerUp, { passive: false });
    this.canvas.addEventListener("pointercancel", this._onPointerCancel, { passive: false });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this._resetGesture();
    }
  }

  _resetGesture() {
    this._pointerId = null;
    this._isDown = false;
    this._gestureStartWorld = null;
    this._path = [];
    this._pathSet.clear();
  }

  _handlePointerDown(e) {
    if (!this.enabled) return;
    if (this._isDown) return;

    e.preventDefault();

    const anchor = this.getAnchorCell?.();
    if (!anchor) return;

    this._pointerId = e.pointerId;
    this._isDown = true;
    this.canvas.setPointerCapture?.(e.pointerId);

    // Always anchor the path at the player's current tile.
    this._path = [{ ...anchor }];
    this._pathSet = new Set([this._key(anchor)]);

    const w = this.scene.worldFromPointer(e.clientX, e.clientY);
    this._gestureStartWorld = { x: w.x, z: w.z };

    // Immediately sample the pointer cell so fast gestures don't miss the first step.
    const cell = this._cellFromEvent(e);
    if (cell) this._tryAppendTowardCell(cell);
  }

  _handlePointerMove(e) {
    if (!this.enabled) return;
    if (!this._isDown) return;
    if (this._pointerId !== e.pointerId) return;

    e.preventDefault();

    const cell = this._cellFromEvent(e);
    if (!cell) return;

    const last = this._path[this._path.length - 1];
    if (cell.row === last.row && cell.col === last.col) return;

    this._tryAppendTowardCell(cell);
  }

  _handlePointerUp(e) {
    if (!this._isDown) return;
    if (this._pointerId !== e.pointerId) return;

    e.preventDefault();

    const path = this._path.slice();
    this._resetGesture();

    if (path.length >= 2) {
      this.onPathCommitted?.(path);
    }
  }

  _cellFromEvent(e) {
    const world = this.scene.worldFromPointer(e.clientX, e.clientY);
    return this._worldToCellWithInference(world.x, world.z);
  }

  /**
   * When the cursor stays over tiles, use the natural cell. When it drifts outside (e.g. arcs
   * above the board), infer the intended grid line — horizontal vs vertical — from the stroke so
   * the ball keeps moving along the row/column (brown line) instead of snapping to the nearest
   * corner cell (pink arc).
   */
  _worldToCellWithInference(wx, wz) {
    const raw = this.grid.worldToCell(wx, wz);
    if (this.grid.isInBounds(raw)) return raw;

    const last = this._path.length ? this._path[this._path.length - 1] : this.getAnchorCell?.();
    if (last && this._gestureStartWorld) {
      const gdx = wx - this._gestureStartWorld.x;
      const gdz = wz - this._gestureStartWorld.z;
      const ax = Math.abs(gdx);
      const az = Math.abs(gdz);

      let horizontalDominant = ax >= az;

      // Near 45°, use the last committed segment to break ties (continues straight corridors).
      const m = Math.max(ax, az);
      if (this._path.length >= 2 && m > 1e-6) {
        const ratio = Math.abs(ax - az) / m;
        if (ratio < 0.28) {
          const a = this._path[this._path.length - 2];
          const b = this._path[this._path.length - 1];
          if (a.row === b.row && a.col !== b.col) horizontalDominant = true;
          else if (a.col === b.col && a.row !== b.row) horizontalDominant = false;
        }
      }

      let inferred;
      if (horizontalDominant) {
        inferred = { row: last.row, col: this._colFromWorldX(wx) };
      } else {
        inferred = { col: last.col, row: this._rowFromWorldZ(wz) };
      }

      if (this.grid.isInBounds(inferred)) return inferred;
    }

    return this._deadzoneClampToCell(wx, wz);
  }

  _colFromWorldX(wx) {
    const ts = this.grid.tileSize || 1;
    const cols = this.grid.cols || 0;
    const originX = (-(cols - 1) * ts) / 2;
    const col = Math.round((wx - originX) / ts);
    return Math.max(0, Math.min(cols - 1, col));
  }

  _rowFromWorldZ(wz) {
    const ts = this.grid.tileSize || 1;
    const rows = this.grid.rows || 0;
    const originZ = (-(rows - 1) * ts) / 2;
    const row = Math.round((wz - originZ) / ts);
    return Math.max(0, Math.min(rows - 1, row));
  }

  /** Nearest edge tile when slightly outside the padded bounds (legacy deadzone). */
  _deadzoneClampToCell(wx, wz) {
    const bounds = this.grid.getWorldBounds();
    const dx = wx < bounds.minX ? bounds.minX - wx : wx > bounds.maxX ? wx - bounds.maxX : 0;
    const dz = wz < bounds.minZ ? bounds.minZ - wz : wz > bounds.maxZ ? wz - bounds.maxZ : 0;
    const outsideDist = Math.hypot(dx, dz);

    const deadzoneWorld = (this.grid.tileSize || 1) * this.boundaryDeadzoneTiles;
    if (outsideDist > deadzoneWorld) return null;

    const clampedX = Math.min(bounds.maxX, Math.max(bounds.minX, wx));
    const clampedZ = Math.min(bounds.maxZ, Math.max(bounds.minZ, wz));
    const clampedCell = this.grid.worldToCell(clampedX, clampedZ);
    if (!this.grid.isInBounds(clampedCell)) return null;
    return clampedCell;
  }

  _key(cell) {
    return `${cell.row},${cell.col}`;
  }

  _isCardinalAdjacent(a, b) {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return dr + dc === 1;
  }

  _tryAppendCell(next) {
    const last = this._path[this._path.length - 1];

    // Only cardinal steps.
    if (!this._isCardinalAdjacent(last, next)) return false;

    // Respect "cannot revisit" at the input level for clarity.
    const k = this._key(next);
    if (this._pathSet.has(k)) return false;

    // Must be enterable at time of drawing (walls/void blocked).
    if (!this.grid.canEnter(next)) return false;

    this._path.push(next);
    this._pathSet.add(k);
    return true;
  }

  _tryAppendTowardCell(target) {
    // If the pointer jumps multiple tiles (common on mobile), walk step-by-step
    // only when it's a straight-line move. Diagonal jumps are ignored.
    let last = this._path[this._path.length - 1];
    const dr = target.row - last.row;
    const dc = target.col - last.col;

    // Adjacent: normal case.
    if (Math.abs(dr) + Math.abs(dc) === 1) {
      const did = this._tryAppendCell(target);
      if (did) this.onPathExtended?.([target]);
      return did;
    }

    // Straight-line only: fill intermediate steps.
    if (dr !== 0 && dc !== 0) return false;

    const stepRow = dr === 0 ? 0 : dr > 0 ? 1 : -1;
    const stepCol = dc === 0 ? 0 : dc > 0 ? 1 : -1;

    /** @type {{row:number,col:number}[]} */
    const segment = [];

    while (!(last.row === target.row && last.col === target.col)) {
      const next = { row: last.row + stepRow, col: last.col + stepCol };
      if (!this._tryAppendCell(next)) return false;
      last = next;
      segment.push(next);
    }
    if (segment.length) this.onPathExtended?.(segment);
    return true;
  }
}

