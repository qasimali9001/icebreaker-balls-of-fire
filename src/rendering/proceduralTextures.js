import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

function tileTextureAnisotropy() {
  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) return 1;
  return 4;
}

/**
 * @param {number} t
 * @param {number} a
 * @param {number} b
 */
function lerp(t, a, b) {
  return a + (b - a) * t;
}

/** Simple value noise for organic variation */
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise2(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return lerp(v, lerp(u, a, b), lerp(u, c, d));
}

function fbm(x, y) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    v += a * smoothNoise2(x * f, y * f);
    a *= 0.5;
    f *= 2;
  }
  return v;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ r: number, g: number, b: number }} centerRgb
 * @param {{ r: number, g: number, b: number }} edgeRgb
 * @param {number} noiseAmt 0..1
 */
function fillTileCanvas(canvas, centerRgb, edgeRgb, noiseAmt) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const edge = Math.max(Math.abs(u - 0.5) * 2, Math.abs(v - 0.5) * 2);
      const edgeSoft = Math.pow(Math.min(1, edge), 1.35);
      const nx = (x / size) * 6;
      const ny = (y / size) * 6;
      const n = fbm(nx, ny) * noiseAmt;
      const t = Math.min(1, edgeSoft + n * 0.35);
      const r = lerp(t, centerRgb.r, edgeRgb.r);
      const g = lerp(t, centerRgb.g, edgeRgb.g);
      const b = lerp(t, centerRgb.b, edgeRgb.b);
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, r);
      data[i + 1] = Math.min(255, g);
      data[i + 2] = Math.min(255, b);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * @param {number} size
 * @returns {THREE.CanvasTexture}
 */
export function createIceTileTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  fillTileCanvas(
    canvas,
    { r: 210, g: 245, b: 255 },
    { r: 120, g: 190, b: 230 },
    0.55
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = tileTextureAnisotropy();
  return tex;
}

/**
 * @param {number} size
 * @returns {THREE.CanvasTexture}
 */
export function createStartTileTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  fillTileCanvas(
    canvas,
    { r: 120, g: 255, b: 200 },
    { r: 40, g: 160, b: 120 },
    0.35
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = tileTextureAnisotropy();
  return tex;
}

/**
 * @param {number} size
 * @returns {THREE.CanvasTexture}
 */
export function createExitTileTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  fillTileCanvas(
    canvas,
    { r: 255, g: 230, b: 160 },
    { r: 200, g: 140, b: 60 },
    0.3
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = tileTextureAnisotropy();
  return tex;
}

/**
 * @param {number} size
 * @returns {THREE.CanvasTexture}
 */
export function createWallTileTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  fillTileCanvas(
    canvas,
    { r: 55, g: 65, b: 90 },
    { r: 28, g: 32, b: 48 },
    0.45
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = tileTextureAnisotropy();
  return tex;
}

/**
 * Radial fire gradient + noise for the ball (core).
 * @param {number} size
 * @returns {THREE.CanvasTexture}
 */
export function createFireballCoreTexture(size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.48;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, "#fffef8");
  grad.addColorStop(0.2, "#ffe566");
  grad.addColorStop(0.45, "#ff8c28");
  grad.addColorStop(0.72, "#e04010");
  grad.addColorStop(1, "#6a1208");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.14, y * 0.14) * 22;
      const i = (y * size + x) * 4;
      d[i] = Math.min(255, d[i] + n);
      d[i + 1] = Math.min(255, d[i + 1] + n * 0.5);
      d[i + 2] = Math.min(255, d[i + 2] - n * 0.35);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft outer flame ring (additive layer).
 * @param {number} size
 * @returns {THREE.CanvasTexture}
 */
export function createFireballHaloTexture(size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const rad = size * 0.5;
  const grad = ctx.createRadialGradient(cx, cy, rad * 0.35, cx, cy, rad);
  grad.addColorStop(0, "rgba(255,200,80,0)");
  grad.addColorStop(0.55, "rgba(255,120,40,0.35)");
  grad.addColorStop(0.85, "rgba(255,60,20,0.55)");
  grad.addColorStop(1, "rgba(120,20,10,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.1, y * 0.1);
      const i = (y * size + x) * 4;
      data[i + 3] = Math.floor(data[i + 3] * (0.75 + n * 0.35));
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
