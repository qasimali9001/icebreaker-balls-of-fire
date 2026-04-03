export const TileType = Object.freeze({
  START: "START",
  ICE: "ICE",
  DEEP_ICE: "DEEP_ICE",
  WALL: "WALL",
  EXIT: "EXIT",
  KEY: "KEY",
  LOCKED: "LOCKED",
  VOID: "VOID",
});

export const TileState = Object.freeze({
  SOLID: "solid",
  /** Deep ice: crossed once — still walkable for second crossing. */
  CRACKED: "cracked",
  GONE: "gone",
});

export const TileCode = Object.freeze({
  S: "S",
  I: "I",
  D: "D",
  W: "W",
  E: "E",
  K: "K",
  L: "L",
  _: "_",
});

export function tileTypeFromCode(code) {
  switch (code) {
    case TileCode.S:
      return TileType.START;
    case TileCode.I:
      return TileType.ICE;
    case TileCode.D:
      return TileType.DEEP_ICE;
    case TileCode.W:
      return TileType.WALL;
    case TileCode.E:
      return TileType.EXIT;
    case TileCode.K:
      return TileType.KEY;
    case TileCode.L:
      return TileType.LOCKED;
    case TileCode._:
    default:
      return TileType.VOID;
  }
}
