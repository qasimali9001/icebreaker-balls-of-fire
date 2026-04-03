import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { TileState, TileType } from "./TileTypes.js";

export class Tile {
  /**
   * @param {{row:number,col:number,type:string,state:string}} opts
   */
  constructor(opts) {
    this.row = opts.row;
    this.col = opts.col;
    this.type = opts.type;
    this.state = opts.state;

    /** @type {THREE.Mesh | null} */
    this.mesh = null;
  }

  isWalkable() {
    if (this.type === TileType.WALL) return false;
    if (this.type === TileType.VOID) return false;
    if (this.state === TileState.GONE) return false;
    return true;
  }

  canMelt() {
    return this.type === TileType.ICE && this.state !== TileState.GONE;
  }

  setGone() {
    this.state = TileState.GONE;
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }
}

