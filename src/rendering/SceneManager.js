import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

export class SceneManager {
  /**
   * @param {{canvas: HTMLCanvasElement}} opts
   */
  constructor(opts) {
    this.canvas = opts.canvas;

    this.scene = new THREE.Scene();
    // Flat "paper" look: no fog, no lighting-driven shading.
    this.scene.fog = null;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x070a12, 1);

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    // True top-down view (no isometric tilt).
    this.camera.position.set(0, 20, 0);
    // Keep "up" pointing toward -Z so the grid feels upright.
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);

    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Soft lighting for glacier walls (MeshStandardMaterial); floor tiles stay unlit MeshBasic.
    const hemi = new THREE.HemisphereLight(0xc5e8ff, 0x1e2a3a, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0.55);
    sun.position.set(4.2, 10, 5.5);
    this.scene.add(sun);

    this._resizeObserver = null;
    this._installResizeHandling();
    this._resize();
  }

  /** Call after layout changes (esp. mobile URL bar / rotation). */
  resize() {
    this._resize();
  }

  _installResizeHandling() {
    const onResize = () => this._resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", () => {
      window.setTimeout(() => this._resize(), 200);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onResize);
      window.visualViewport.addEventListener("scroll", onResize);
    }

    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this.canvas);
    }
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

