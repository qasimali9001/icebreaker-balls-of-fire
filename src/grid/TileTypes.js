export const TileType = Object.freeze({
  START: "START",
  ICE: "ICE",
  WALL: "WALL",
  EXIT: "EXIT",
  VOID: "VOID",
});

export const TileState = Object.freeze({
  SOLID: "solid",
  GONE: "gone",
});

export const TileCode = Object.freeze({
  S: "S",
  I: "I",
  W: "W",
  E: "E",
  _: "_",
});

export function tileTypeFromCode(code) {
  switch (code) {
    case TileCode.S:
      return TileType.START;
    case TileCode.I:
      return TileType.ICE;
    case TileCode.W:
      return TileType.WALL;
    case TileCode.E:
      return TileType.EXIT;
    case TileCode._:
    default:
      return TileType.VOID;
  }
}

