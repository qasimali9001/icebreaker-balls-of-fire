import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { TileState, TileType } from "../grid/TileTypes.js";
import { createFireballCoreTexture, createFireballHaloTexture } from "../rendering/proceduralTextures.js";

export class PlayerController {
  /**
   * @param {{scene: import('../rendering/SceneManager.js').SceneManager, grid: import('../grid/GridManager.js').GridManager}} opts
   */
  constructor(opts) {
    this.sceneManager = opts.scene;
    this.scene = this.sceneManager.scene;
    this.grid = opts.grid;

    this.enabled = true;

    /** @type {{row:number,col:number} | null} */
    this.currentCell = null;

    this.speedTilesPerSecond = 8;

    /** @type {{row:number,col:number}[]} */
    this._queue = [];
    this._isMoving = false;
    this._moveT = 0;
    this._moveDuration = 0;
    this._fromWorld = new THREE.Vector3();
    this._toWorld = new THREE.Vector3();
    this._lerpPos = new THREE.Vector3();
    this._fromCell = null;
    this._toCell = null;
    this._callbacks = null;

    this._time = 0;
    const coreTex = createFireballCoreTexture();
    const haloTex = createFireballHaloTexture();

    this.mesh = new THREE.Group();
    this.mesh.name = "Player";

    const ringSeg = 32;
    const haloGeo = new THREE.CircleGeometry(0.44, ringSeg);
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this._halo = new THREE.Mesh(haloGeo, haloMat);
    this._halo.rotation.x = -Math.PI / 2;
    this._halo.position.y = 0.004;

    const coreGeo = new THREE.CircleGeometry(0.3, ringSeg);
    const coreMat = new THREE.MeshBasicMaterial({
      map: coreTex,
      transparent: true,
      depthTest: true,
      depthWrite: true,
    });
    this._core = new THREE.Mesh(coreGeo, coreMat);
    this._core.rotation.x = -Math.PI / 2;
    this._core.position.y = 0.014;

    this.mesh.add(this._halo);
    this.mesh.add(this._core);
    this.scene.add(this.mesh);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  spawnAt(cell) {
    this.currentCell = { ...cell };
    const world = this.grid.cellToWorld(cell);
    this.mesh.position.set(world.x, 0.01, world.z);

    this._queue = [];
    this._callbacks = null;
    this._isMoving = false;
    this._toCell = null;
    this._fromCell = null;
  }

  /**
   * Queue cells to move through, in order.
   * @param {{row:number,col:number}[]} cells
   * @param {{
   *  onStepInvalid?: () => void,
   *  onStepLeftCell?: (cell:{row:number,col:number}) => void,
   *  onArrived?: () => void
   * }} callbacks
   */
  queueCells(cells, callbacks) {
    if (!this.enabled) return;
    if (!this.currentCell) return;
    if (!Array.isArray(cells) || cells.length === 0) return;

    // Chain new steps from where the path will be *after* pending moves — not only currentCell.
    // If we only used currentCell while mid-move (A→B), a fast follow-up segment [C] would
    // validate A→C and fail; it must chain from B (the move already in progress).
    const last = this._getPathTailForQueueing();

    let prev = last;
    let virtualKey = this.grid.hasKey;
    for (const next of cells) {
      const dr = Math.abs(prev.row - next.row);
      const dc = Math.abs(prev.col - next.col);
      if (dr + dc !== 1) {
        callbacks?.onStepInvalid?.();
        return;
      }
      if (!this.grid.canEnterWithVirtualKey(next, virtualKey)) {
        callbacks?.onStepInvalid?.();
        return;
      }
      const t = this.grid.getTile(next);
      if (t && t.type === TileType.KEY && t.state !== TileState.GONE) {
        virtualKey = true;
      }
      prev = next;
    }

    // Merge callbacks (latest wins).
    this._callbacks = { ...(this._callbacks || {}), ...(callbacks || {}) };
    this._queue.push(...cells.map((c) => ({ ...c })));

    if (!this._isMoving) this._beginNextStep();
  }

  /**
   * Cell that the next queued step should connect to: end of queue, else destination of
   * the active move (if any), else logical position.
   * @returns {{row:number,col:number}}
   */
  _getPathTailForQueueing() {
    if (this._queue.length) return this._queue[this._queue.length - 1];
    if (this._isMoving && this._toCell) return this._toCell;
    return this.currentCell;
  }

  _beginNextStep() {
    if (!this.currentCell) return;
    if (!this._queue.length) {
      this._callbacks = null;
      return;
    }

    const fromCell = this.currentCell;
    const toCell = this._queue.shift();

    // Re-check legality at execution time (in case a tile has melted).
    if (!this.grid.canEnter(toCell)) {
      this._callbacks?.onStepInvalid?.();
      this._callbacks = null;
      return;
    }

    this._fromCell = { ...fromCell };
    this._toCell = { ...toCell };

    const fromWorld = this.grid.cellToWorld(fromCell);
    const toWorld = this.grid.cellToWorld(toCell);
    this._fromWorld.set(fromWorld.x, 0.01, fromWorld.z);
    this._toWorld.set(toWorld.x, 0.01, toWorld.z);

    this._moveT = 0;
    this._moveDuration = 1 / Math.max(1, this.speedTilesPerSecond);
    this._isMoving = true;

    // Leaving a tile triggers melting.
    this._callbacks?.onStepLeftCell?.(this._fromCell);
  }

  update(dt) {
    this._time += dt;
    if (this._halo) {
      const pulse = 1 + Math.sin(this._time * 7) * 0.045;
      this._halo.scale.setScalar(pulse);
    }

    if (!this.enabled) return;
    if (!this._isMoving) return;

    this._moveT += dt;
    const t = Math.min(1, this._moveT / this._moveDuration);

    // Smoothstep.
    const tt = t * t * (3 - 2 * t);
    this._lerpPos.lerpVectors(this._fromWorld, this._toWorld, tt);
    this.mesh.position.copy(this._lerpPos);

    if (t >= 1) {
      this._isMoving = false;
      if (this._toCell) this.currentCell = { ...this._toCell };
      this._callbacks?.onArrived?.();
      this._beginNextStep();
    }
  }
}

