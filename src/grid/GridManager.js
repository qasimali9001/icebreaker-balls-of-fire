import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { Tile } from "./Tile.js";
import { TileState, TileType, tileTypeFromCode } from "./TileTypes.js";
import {
  createIceTileTexture,
  createDeepIceTileTexture,
  createKeyTileTexture,
  createConcreteTileTexture,
  createLockedTopTexture,
  createStartTileTexture,
  createExitTileTexture,
  createWallTileTexture,
} from "../rendering/proceduralTextures.js";

export class GridManager {
  /**
   * @param {{scene: import('../rendering/SceneManager.js').SceneManager}} opts
   */
  constructor(opts) {
    this.sceneManager = opts.scene;
    this.scene = this.sceneManager.scene;

    this.tileSize = 1;
    /** @type {Tile[][]} */
    this.tiles = [];
    this.rows = 0;
    this.cols = 0;

    this.startCell = { row: 0, col: 0 };
    this.exitCell = { row: 0, col: 0 };

    this.totalIce = 0;
    this.goneIce = 0;
    this.totalDeepIce = 0;
    this.deepIceFullyGone = 0;

    /** Player holds key until level reset / fail. */
    this.hasKey = false;

    this.group = new THREE.Group();
    this.group.name = "Grid";
    this.scene.add(this.group);

    this._materials = this._createMaterials();
    /** Unit wall block: width 1, height ~glacier, depth 1 — scaled by tileSize in mesh. */
    this._wallHeight = 0.62;
    this._geometries = {
      tile: new THREE.PlaneGeometry(1, 1),
      wall: new THREE.BoxGeometry(1, this._wallHeight, 1),
    };
  }

  _createMaterials() {
    const iceMap = createIceTileTexture();
    const deepIceMap = createDeepIceTileTexture();
    const keyMap = createKeyTileTexture();
    const concreteMap = createConcreteTileTexture();
    const lockedTopMap = createLockedTopTexture();
    const startMap = createStartTileTexture();
    const exitMap = createExitTileTexture();
    const wallMap = createWallTileTexture();
    const sideMat = new THREE.MeshBasicMaterial({ map: concreteMap, color: 0xffffff });
    const lockedTopMat = new THREE.MeshBasicMaterial({ map: lockedTopMap, color: 0xffffff });
    /** BoxGeometry: +X,-X,+Y,-Y,+Z,-Z — bird’s-eye sees +Y (index 2). */
    const lockedWallMats = [sideMat, sideMat, lockedTopMat, sideMat, sideMat, sideMat];
    return {
      ice: new THREE.MeshBasicMaterial({ map: iceMap, color: 0xffffff }),
      deepIce: new THREE.MeshBasicMaterial({ map: deepIceMap, color: 0xffffff }),
      start: new THREE.MeshBasicMaterial({ map: startMap, color: 0xffffff }),
      exit: new THREE.MeshBasicMaterial({ map: exitMap, color: 0xffffff }),
      key: new THREE.MeshBasicMaterial({ map: keyMap, color: 0xffffff }),
      wall: new THREE.MeshBasicMaterial({
        map: wallMap,
        color: 0xe8f6ff,
      }),
      lockedWallMats,
      lockedFloor: new THREE.MeshBasicMaterial({ map: iceMap, color: 0xffffff }),
      void: new THREE.MeshBasicMaterial({ color: 0x05060b }),
    };
  }

  clear() {
    while (this.group.children.length) {
      const child = this.group.children.pop();
      if (child) this.group.remove(child);
    }
    this.tiles = [];
    this.rows = 0;
    this.cols = 0;
    this.totalIce = 0;
    this.goneIce = 0;
    this.totalDeepIce = 0;
    this.deepIceFullyGone = 0;
    this.hasKey = false;
  }

  /**
   * @param {any} levelData
   */
  loadLevel(levelData) {
    this.clear();

    const grid = Array.isArray(levelData) ? levelData : levelData?.grid;
    if (!Array.isArray(grid) || !Array.isArray(grid[0])) {
      throw new Error("Level must be a 2D array or {grid: 2D array}.");
    }

    this.tileSize = Number(levelData?.tileSize ?? 1) || 1;
    this.rows = grid.length;
    this.cols = grid[0].length;

    this.tiles = new Array(this.rows);
    this.totalIce = 0;
    this.goneIce = 0;
    this.totalDeepIce = 0;
    this.deepIceFullyGone = 0;
    this.hasKey = false;

    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = new Array(this.cols);
      for (let c = 0; c < this.cols; c++) {
        const code = grid[r][c];
        const type = tileTypeFromCode(code);
        const state = TileState.SOLID;
        const tile = new Tile({ row: r, col: c, type, state });
        this.tiles[r][c] = tile;

        if (type === TileType.START) this.startCell = { row: r, col: c };
        if (type === TileType.EXIT) this.exitCell = { row: r, col: c };
        if (type === TileType.ICE) this.totalIce++;
        if (type === TileType.DEEP_ICE) this.totalDeepIce++;

        const mesh = this._createMeshForTile(tile);
        tile.mesh = mesh;
        if (mesh) this.group.add(mesh);
      }
    }

    const bounds = this.getWorldBounds();
    this.sceneManager.setCameraToFitBounds(bounds);
  }

  _createMeshForTile(tile) {
    if (tile.type === TileType.VOID) return null;

    const isWall = tile.type === TileType.WALL;
    const isLocked = tile.type === TileType.LOCKED;
    const geo = isWall || isLocked ? this._geometries.wall : this._geometries.tile;
    const mat = isLocked
      ? /** @type {any} */ (this._materials.lockedWallMats)
      : this._materialForType(tile.type, isLocked);
    const mesh = new THREE.Mesh(geo, mat);

    const world = this.cellToWorld({ row: tile.row, col: tile.col });

    if (isWall || isLocked) {
      mesh.scale.set(this.tileSize, this.tileSize, this.tileSize);
      const h = this._wallHeight * this.tileSize;
      mesh.position.set(world.x, h * 0.5, world.z);
      mesh.userData.isWallStyle = true;
    } else {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(world.x, 0.001, world.z);
      mesh.scale.set(this.tileSize, this.tileSize, 1);
    }

    mesh.userData.row = tile.row;
    mesh.userData.col = tile.col;
    return mesh;
  }

  /**
   * @param {string} type
   * @param {boolean} lockedAsWall
   */
  _materialForType(type, lockedAsWall = true) {
    switch (type) {
      case TileType.ICE:
        return this._materials.ice;
      case TileType.DEEP_ICE:
        return this._materials.deepIce;
      case TileType.START:
        return this._materials.start;
      case TileType.EXIT:
        return this._materials.exit;
      case TileType.KEY:
        return this._materials.key;
      case TileType.WALL:
        return this._materials.wall;
      case TileType.LOCKED:
        return lockedAsWall ? this._materials.wall : this._materials.lockedFloor;
      default:
        return this._materials.void;
    }
  }

  /** After key pickup: locked cells become walkable floor tiles. */
  _openAllLockedTiles() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.tiles[r][c];
        if (tile.type !== TileType.LOCKED || !tile.mesh) continue;

        const world = this.cellToWorld({ row: r, col: c });
        const old = tile.mesh;
        this.group.remove(old);
        old.geometry?.dispose?.();

        const mesh = new THREE.Mesh(this._geometries.tile, this._materials.lockedFloor);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(world.x, 0.001, world.z);
        mesh.scale.set(this.tileSize, this.tileSize, 1);
        mesh.userData.row = r;
        mesh.userData.col = c;
        tile.mesh = mesh;
        this.group.add(mesh);
      }
    }
  }

  getStartCell() {
    return { ...this.startCell };
  }

  getExitCell() {
    return { ...this.exitCell };
  }

  isInBounds(cell) {
    return cell.row >= 0 && cell.row < this.rows && cell.col >= 0 && cell.col < this.cols;
  }

  getTile(cell) {
    if (!this.isInBounds(cell)) return null;
    return this.tiles[cell.row][cell.col];
  }

  /**
   * @param {{row:number,col:number}} cell
   * @param {boolean} [virtualHasKey] — for path planning before pickup executes
   */
  canEnter(cell, virtualHasKey) {
    const tile = this.getTile(cell);
    if (!tile) return false;
    const keyOk = virtualHasKey !== undefined ? virtualHasKey : this.hasKey;
    if (tile.type === TileType.LOCKED && !keyOk) return false;
    if (tile.type === TileType.WALL || tile.type === TileType.VOID) return false;
    if (tile.state === TileState.GONE) return false;
    return true;
  }

  /**
   * Virtual key simulation for queued path validation (PlayerController).
   * @param {{row:number,col:number}} cell
   * @param {boolean} virtualHasKey
   */
  canEnterWithVirtualKey(cell, virtualHasKey) {
    return this.canEnter(cell, virtualHasKey);
  }

  meltCell(cell) {
    const tile = this.getTile(cell);
    if (!tile) return;
    if (!tile.canMelt()) return;

    if (tile.type === TileType.ICE) {
      tile.setGone();
      this.goneIce++;
      return;
    }

    if (tile.type === TileType.DEEP_ICE) {
      if (tile.state === TileState.SOLID) {
        // After first crossing, match normal ice so it reads as “thinned” like regular ice.
        tile.setDeepCracked(this._materials.ice);
        return;
      }
      if (tile.state === TileState.CRACKED) {
        tile.setGone();
        this.deepIceFullyGone++;
      }
    }
  }

  /**
   * Call when the player lands on a cell (after move).
   * @param {{row:number,col:number}} cell
   */
  tryCollectKey(cell) {
    const tile = this.getTile(cell);
    if (!tile || tile.type !== TileType.KEY) return;
    if (tile.state === TileState.GONE) return;

    this.hasKey = true;
    tile.setGone();
    this._openAllLockedTiles();
  }

  checkWin(playerCell) {
    const onExit =
      playerCell && playerCell.row === this.exitCell.row && playerCell.col === this.exitCell.col;
    const normalDone = this.goneIce >= this.totalIce;
    const deepDone = this.deepIceFullyGone >= this.totalDeepIce;
    return Boolean(onExit && normalDone && deepDone);
  }

  cellToWorld(cell) {
    const originX = -((this.cols - 1) * this.tileSize) / 2;
    const originZ = -((this.rows - 1) * this.tileSize) / 2;
    const x = originX + cell.col * this.tileSize;
    const z = originZ + cell.row * this.tileSize;
    return { x, z };
  }

  worldToCell(worldX, worldZ) {
    const originX = -((this.cols - 1) * this.tileSize) / 2;
    const originZ = -((this.rows - 1) * this.tileSize) / 2;
    const col = Math.round((worldX - originX) / this.tileSize);
    const row = Math.round((worldZ - originZ) / this.tileSize);
    return { row, col };
  }

  getWorldBounds() {
    const originX = -((this.cols - 1) * this.tileSize) / 2;
    const originZ = -((this.rows - 1) * this.tileSize) / 2;
    return {
      minX: originX - this.tileSize,
      maxX: originX + (this.cols - 1) * this.tileSize + this.tileSize,
      minZ: originZ - this.tileSize,
      maxZ: originZ + (this.rows - 1) * this.tileSize + this.tileSize,
    };
  }
}
