import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

/** Phones / tablets: fewer pixels + no MSAA saves a lot of GPU fill-rate. */
function isTouchPrimaryDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (window.matchMedia?.("(pointer: coarse)").matches) return true;
  if (navigator.maxTouchPoints > 0 && window.innerWidth < 1024) return true;
  return false;
}

export class SceneManager {
  /**
   * @param {{canvas: HTMLCanvasElement}} opts
   */
  constructor(opts) {
    this.canvas = opts.canvas;

    this._touchPerf = isTouchPrimaryDevice();
    /** @type {number | null} */
    this._resizeRaf = null;

    this.scene = new THREE.Scene();
    // Flat "paper" look: no fog, no lighting-driven shading.
    this.scene.fog = null;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this._touchPerf,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    const dpr = window.devicePixelRatio || 1;
    const dprCap = this._touchPerf ? 1.25 : 2;
    this.renderer.setPixelRatio(Math.min(dprCap, dpr));
    this.renderer.setClearColor(0x070a12, 1);

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    // True top-down view (no isometric tilt).
    this.camera.position.set(0, 20, 0);
    // Keep "up" pointing toward -Z so the grid feels upright.
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Tiles + walls use MeshBasicMaterial — no scene lights (cheaper on mobile GPUs).

    this._resizeObserver = null;
    this._installResizeHandling();
    this._resize();
  }

  /** Call after layout changes (esp. mobile URL bar / rotation). */
  resize() {
    this._resize();
  }

  _installResizeHandling() {
    const scheduleResize = () => this._scheduleResize();
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", () => {
      window.setTimeout(() => this._scheduleResize(), 200);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleResize);
      window.visualViewport.addEventListener("scroll", scheduleResize);
    }

    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this._scheduleResize());
      this._resizeObserver.observe(this.canvas);
    }
  }

  /** Coalesce burst events (mobile URL bar) into one resize per frame. */
  _scheduleResize() {
    if (this._resizeRaf != null) return;
    this._resizeRaf = requestAnimationFrame(() => {
      this._resizeRaf = null;
      this._resize();
    });
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    const viewSize = 10;
    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  worldFromPointer(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera({ x, y }, this.camera);
    const out = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, out);
    return out;
  }

  setCameraToFitBounds(bounds) {
    // bounds: {minX, maxX, minZ, maxZ}
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    this.camera.position.set(centerX, 20, centerZ);
    this.camera.lookAt(centerX, 0, centerZ);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

