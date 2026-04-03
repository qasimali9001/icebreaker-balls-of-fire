import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { Tile } from "./Tile.js";
import { TileState, TileType, tileTypeFromCode } from "./TileTypes.js";
import {
  createIceTileTexture,
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
    const startMap = createStartTileTexture();
    const exitMap = createExitTileTexture();
    const wallMap = createWallTileTexture();
    return {
      ice: new THREE.MeshBasicMaterial({ map: iceMap, color: 0xffffff }),
      start: new THREE.MeshBasicMaterial({ map: startMap, color: 0xffffff }),
      exit: new THREE.MeshBasicMaterial({ map: exitMap, color: 0xffffff }),
      // MeshBasic: same texture read, no PBR lighting — much cheaper on mobile than StandardMaterial.
      wall: new THREE.MeshBasicMaterial({
        map: wallMap,
        color: 0xe8f6ff,
      }),
      void: new THREE.MeshBasicMaterial({ color: 0x05060b }),
    };
  }

  clear() {
    // We intentionally keep shared geometries/materials alive across restarts.
    // (Disposing them here would break subsequent level loads.)
    while (this.group.children.length) {
      const child = this.group.children.pop();
      if (child) this.group.remove(child);
    }
    this.tiles = [];
    this.rows = 0;
    this.cols = 0;
    this.totalIce = 0;
    this.goneIce = 0;
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

    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = new Array(this.cols);
      for (let c = 0; c < this.cols; c++) {
        const code = grid[r][c];
        const type = tileTypeFromCode(code);
        const state = type === TileType.ICE ? TileState.SOLID : TileState.SOLID;
        const tile = new Tile({ row: r, col: c, type, state });
        this.tiles[r][c] = tile;

        if (type === TileType.START) this.startCell = { row: r, col: c };
        if (type === TileType.EXIT) this.exitCell = { row: r, col: c };
        if (type === TileType.ICE) this.totalIce++;

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
    const geo = isWall ? this._geometries.wall : this._geometries.tile;
    const mat = this._materialForType(tile.type);
    const mesh = new THREE.Mesh(geo, mat);

    const world = this.cellToWorld({ row: tile.row, col: tile.col });

    if (isWall) {
      mesh.scale.set(this.tileSize, this.tileSize, this.tileSize);
      const h = this._wallHeight * this.tileSize;
      mesh.position.set(world.x, h * 0.5, world.z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    } else {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(world.x, 0.001, world.z);
      mesh.scale.set(this.tileSize, this.tileSize, 1);
    }

    mesh.userData = { row: tile.row, col: tile.col };
    return mesh;
  }

  _materialForType(type) {
    switch (type) {
      case TileType.ICE:
        return this._materials.ice;
      case TileType.START:
        return this._materials.start;
      case TileType.EXIT:
        return this._materials.exit;
      case TileType.WALL:
        return this._materials.wall;
      default:
        return this._materials.void;
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

  canEnter(cell) {
    const tile = this.getTile(cell);
    if (!tile) return false;
    return tile.isWalkable();
  }

  meltCell(cell) {
    const tile = this.getTile(cell);
    if (!tile) return;
    if (!tile.canMelt()) return;

    tile.setGone();
    this.goneIce++;
  }

  checkWin(playerCell) {
    const onExit = playerCell && playerCell.row === this.exitCell.row && playerCell.col === this.exitCell.col;
    const allIceGone = this.goneIce >= this.totalIce;
    return Boolean(onExit && allIceGone);
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

