import { Game } from "./core/Game.js";

const canvas = document.getElementById("gameCanvas");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");
const overlayRestartBtn = document.getElementById("overlayRestartBtn");

const game = new Game({
  canvas,
  debugSolution: new URLSearchParams(window.location.search).has("debugSolution"),
  ui: {
    restartBtn,
    overlay,
    overlayRestartBtn,
    levelLabel: document.getElementById("levelLabel"),
    statusLabel: document.getElementById("statusLabel"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayBody: document.getElementById("overlayBody"),
    solutionPanel: document.getElementById("solutionPanel"),
    solutionImage: document.getElementById("solutionImage"),
  },
});

game.start().then(() => {
  game.scene.resize();
  requestAnimationFrame(() => game.scene.resize());
});

// Prevent browser gestures from interfering with drawing.
window.addEventListener(
  "gesturestart",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

