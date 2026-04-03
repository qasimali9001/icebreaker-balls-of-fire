export const GamePhase = Object.freeze({
  LOADING: "LOADING",
  PLAYING: "PLAYING",
  WIN: "WIN",
  FAIL: "FAIL",
});

export class GameState {
  constructor() {
    this.phase = GamePhase.LOADING;
    this.levelIndex = 0;
  }

  setPhase(phase) {
    this.phase = phase;
  }

  setLevelIndex(levelIndex) {
    this.levelIndex = levelIndex;
  }
}

