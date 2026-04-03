import { SceneManager } from "../rendering/SceneManager.js";
import { GridManager } from "../grid/GridManager.js";
import { InputHandler } from "../input/InputHandler.js";
import { PlayerController } from "../player/PlayerController.js";
import { GamePhase, GameState } from "./GameState.js";

export class Game {
  /**
   * @param {{canvas: HTMLCanvasElement, ui: any, debugSolution?: boolean}} opts
   */
  constructor(opts) {
    this.canvas = opts.canvas;
    this.ui = opts.ui;

    this.state = new GameState();

    this.scene = new SceneManager({ canvas: this.canvas });
    this.grid = new GridManager({ scene: this.scene });
    this.player = new PlayerController({ scene: this.scene, grid: this.grid });
    this.input = new InputHandler({
      canvas: this.canvas,
      scene: this.scene,
      grid: this.grid,
      getAnchorCell: () => this.player.currentCell,
      onPathCommitted: (path) => this.onPathCommitted(path),
      onPathExtended: (segment) => this.onPathExtended(segment),
    });

    this._levels = [
      "./src/levels/level1.json",
      "./src/levels/level2.json",
      "./src/levels/level3.json",
      "./src/levels/level4.json",
      "./src/levels/level5.json",
      "./src/levels/level6.json",
    ];

    this._raf = null;
    this._lastTs = 0;

    /** When true, compute and draw one valid stroke after each load (?debugSolution). */
    this._debugSolution = Boolean(opts.debugSolution);

    // Restart must be a deliberate tap — not a swipe/drag that started on or crossed the button
    // (otherwise “drawing downward” near the HUD can accidentally fire restart).
    this._bindTapOnly(this.ui.restartBtn, () => this.restartLevel());
    this._bindTapOnly(this.ui.overlayRestartBtn, () => this.restartLevel());
  }

  /**
   * Fires `fn` only on a deliberate tap: small movement and pointer released while still
   * over the control (so drags that start on the button but end on the canvas do nothing).
   * @param {HTMLElement | null | undefined} el
   * @param {() => void} fn
   */
  _bindTapOnly(el, fn) {
    if (!el) return;
    /** @type {{ x: number, y: number, id: number } | null} */
    let start = null;
    const maxMovePx = 14;

    el.addEventListener(
      "pointerdown",
      (e) => {
        start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      },
      { passive: true }
    );

    // Use window so we always see pointerup even if the finger leaves the button (cancel tap).
    window.addEventListener(
      "pointerup",
      (e) => {
        if (!start || e.pointerId !== start.id) return;
        const d = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        const releasedOnControl = el.contains(e.target);
        start = null;
        if (!releasedOnControl) return;
        if (d > maxMovePx) return;
        e.preventDefault();
        fn();
      },
      { passive: false }
    );

    window.addEventListener("pointercancel", (e) => {
      if (start && e.pointerId === start.id) start = null;
    });

    // Avoid duplicate action if a synthetic click still fires.
    el.addEventListener("click", (e) => e.preventDefault());
  }

  async start() {
    this.setOverlayVisible(false);
    this.setStatus("");
    this.state.setPhase(GamePhase.LOADING);

    await this.loadLevel(0);

    this.state.setPhase(GamePhase.PLAYING);
    if (!this._debugSolution) {
      this.setStatus("Draw a path.");
    }

    this._lastTs = performance.now();
    const tick = (ts) => {
      const dt = Math.min(1 / 30, (ts - this._lastTs) / 1000);
      this._lastTs = ts;
      this.update(dt);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  async loadLevel(levelIndex) {
    this.state.setLevelIndex(levelIndex);
    const url = this._levels[levelIndex];
    if (!url) throw new Error(`No level at index ${levelIndex}`);

    this.setLevelLabel(`Level ${levelIndex + 1}`);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load level: ${url}`);
    const levelData = await res.json();

    // Solvability is checked at authoring time (python tools/check_level.py or npm run validate-levels).
    // Running the BFS here on large / dense-open levels can freeze the browser (RAM + main-thread CPU).

    this.grid.loadLevel(levelData);

    if (this._debugSolution && this.ui.solutionPanel && this.ui.solutionImage) {
      const n = levelIndex + 1;
      this.ui.solutionImage.alt = `Reference solution for level ${n}`;
      this.ui.solutionImage.src = `./solutions/level${n}.png`;
      this.ui.solutionPanel.classList.remove("hidden");
      this.ui.solutionPanel.setAttribute("aria-hidden", "false");
      this.setStatus(`Debug: solution image — remove ?debugSolution to hide`);
    } else if (this.ui.solutionPanel) {
      this.ui.solutionPanel.classList.add("hidden");
      this.ui.solutionPanel.setAttribute("aria-hidden", "true");
    }

    this.player.spawnAt(this.grid.getStartCell());

    this.input.setEnabled(true);
    this.player.setEnabled(true);
  }

  restartLevel() {
    this.setOverlayVisible(false);
    this.setStatus("Restarting…");
    // After clearing the final level, restart the run from level 1.
    if (this.state.phase === GamePhase.WIN && this.state.levelIndex === this._levels.length - 1) {
      this.state.setLevelIndex(0);
    }
    this.failResetSoon();
  }

  failResetSoon() {
    this.state.setPhase(GamePhase.FAIL);
    this.input.setEnabled(false);
    this.player.setEnabled(false);

    window.setTimeout(async () => {
      await this.loadLevel(this.state.levelIndex);
      this.state.setPhase(GamePhase.PLAYING);
      if (!this._debugSolution) {
        this.setStatus("Draw a path.");
      }
    }, 0);
  }

  onPathCommitted(path) {
    if (this.state.phase !== GamePhase.PLAYING) return;
    // In live-draw mode we don't need to do anything special on pointer-up.
    // The player is already moving while drawing.
    if (this.grid.checkWin(this.player.currentCell)) this.win();
  }

  onPathExtended(segment) {
    if (this.state.phase !== GamePhase.PLAYING) return;
    if (!segment || segment.length === 0) return;

    if (!this._debugSolution) {
      this.setStatus("");
    }

    this.player.queueCells(segment, {
      onStepInvalid: () => {
        this.setStatus("Oops — invalid step.");
        this.failResetSoon();
      },
      onStepLeftCell: (leftCell) => {
        this.grid.meltCell(leftCell);
      },
      onArrived: () => {
        if (this.grid.checkWin(this.player.currentCell)) this.win();
      },
    });
  }

  win() {
    this.state.setPhase(GamePhase.WIN);
    this.input.setEnabled(false);
    this.player.setEnabled(false);

    const nextIndex = this.state.levelIndex + 1;
    if (nextIndex < this._levels.length) {
      this.setStatus("Level clear — next…");
      window.setTimeout(async () => {
        this.setOverlayVisible(false);
        await this.loadLevel(nextIndex);
        this.state.setPhase(GamePhase.PLAYING);
        if (!this._debugSolution) {
          this.setStatus("Draw a path.");
        }
      }, 750);
      return;
    }

    this.setOverlayVisible(true);
    if (this.ui.overlayTitle) this.ui.overlayTitle.textContent = "You win";
    if (this.ui.overlayBody)
      this.ui.overlayBody.textContent = "All levels cleared. Tap restart to play again from level 1.";
  }

  update(dt) {
    this.player.update(dt);
    this.scene.render();
  }

  setOverlayVisible(isVisible) {
    if (!this.ui.overlay) return;
    this.ui.overlay.classList.toggle("hidden", !isVisible);
  }

  setLevelLabel(text) {
    if (this.ui.levelLabel) this.ui.levelLabel.textContent = text;
  }

  setStatus(text) {
    if (this.ui.statusLabel) this.ui.statusLabel.textContent = text;
  }
}

