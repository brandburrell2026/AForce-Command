import * as THREE from "three";

import { formatFeet } from "@/scene/units";

import { CAMERA_PRESETS } from "./camera";
import { canvasToBlob } from "./download";
import { type RenderFormat, type RenderSettings, supersampleFactor } from "./renderSettings";
import { isEditorOnly, sceneBridge } from "./sceneBridge";
import { getEditorState } from "./store";

const HARD_LIMIT = 8192;

interface FrameOptions {
  width: number;
  height: number;
  supersample: number;
  hideOverlays: boolean;
  transparent: boolean;
}

/**
 * Render one frame of the live scene at an arbitrary size and return it
 * on a 2D canvas. Resizes the drawing buffer without touching CSS, so the
 * viewport is untouched once everything is restored in `finally`.
 */
function renderFrame(options: FrameOptions): HTMLCanvasElement | null {
  const handles = sceneBridge.handles;
  if (!handles) return null;
  const { gl, scene, camera } = handles;
  if (!(camera instanceof THREE.PerspectiveCamera)) return null;

  const maxSide = Math.min(HARD_LIMIT, gl.capabilities.maxTextureSize);
  let ss = options.supersample;
  while (ss > 1 && (options.width * ss > maxSide || options.height * ss > maxSide)) ss -= 1;
  const bufferW = Math.min(maxSide, Math.round(options.width * ss));
  const bufferH = Math.min(maxSide, Math.round(options.height * ss));

  const size = gl.getSize(new THREE.Vector2());
  const pixelRatio = gl.getPixelRatio();
  const aspect = camera.aspect;
  const background = scene.background;
  const fog = scene.fog;
  const clearAlpha = gl.getClearAlpha();
  const hidden: THREE.Object3D[] = [];

  try {
    if (options.hideOverlays) {
      scene.traverse((o) => {
        if (o.visible && isEditorOnly(o)) {
          o.visible = false;
          hidden.push(o);
        }
      });
    }
    if (options.transparent) {
      scene.background = null;
      scene.fog = null;
      gl.setClearAlpha(0);
    }
    gl.setPixelRatio(1);
    gl.setSize(bufferW, bufferH, false);
    camera.aspect = bufferW / bufferH;
    camera.updateProjectionMatrix();
    gl.render(scene, camera);

    const out = document.createElement("canvas");
    out.width = options.width;
    out.height = options.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(gl.domElement, 0, 0, out.width, out.height);
    return out;
  } finally {
    for (const o of hidden) o.visible = true;
    scene.background = background;
    scene.fog = fog;
    gl.setClearAlpha(clearAlpha);
    gl.setPixelRatio(pixelRatio);
    gl.setSize(size.x, size.y, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
}

function mime(format: RenderFormat): string {
  return format === "png" ? "image/png" : "image/jpeg";
}

/** A presentation still from the current camera. */
export async function renderStill(settings: RenderSettings): Promise<Blob | null> {
  const canvas = renderFrame({
    width: settings.width,
    height: settings.height,
    supersample: supersampleFactor(settings),
    hideOverlays: settings.hideOverlays,
    transparent: settings.transparent && settings.format === "png",
  });
  if (!canvas) return null;
  return canvasToBlob(canvas, mime(settings.format), 0.92);
}

const TILE_W = 1280;
const TILE_H = 720;
const GUTTER = 24;
const LABEL_H = 56;
const COLS = 4;

/**
 * All seven camera views plus a title tile on one sheet, rendered from
 * the live scene. The camera is moved directly and restored afterward;
 * OrbitControls re-derives its state from the restored pose.
 */
export async function renderContactSheet(settings: RenderSettings): Promise<Blob | null> {
  const handles = sceneBridge.handles;
  if (!handles) return null;
  const { camera } = handles;
  const doc = getEditorState().doc;

  const tiles: Array<{ label: string; canvas: HTMLCanvasElement | null }> = [];
  const savedPosition = camera.position.clone();
  const savedQuaternion = camera.quaternion.clone();
  try {
    for (const preset of CAMERA_PRESETS) {
      camera.position.set(...preset.position);
      camera.lookAt(new THREE.Vector3(...preset.target));
      camera.updateMatrixWorld();
      tiles.push({
        label: preset.label,
        canvas: renderFrame({
          width: TILE_W,
          height: TILE_H,
          supersample: settings.supersample ? 2 : 1,
          hideOverlays: settings.hideOverlays,
          transparent: false,
        }),
      });
    }
  } finally {
    camera.position.copy(savedPosition);
    camera.quaternion.copy(savedQuaternion);
    camera.updateMatrixWorld();
  }

  const cells = tiles.length + 1; // title tile first
  const rows = Math.ceil(cells / COLS);
  const sheet = document.createElement("canvas");
  sheet.width = GUTTER + COLS * (TILE_W + GUTTER);
  sheet.height = GUTTER + rows * (TILE_H + LABEL_H + GUTTER);
  const ctx = sheet.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0D0D0D";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  const mono = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const display = '"Archivo Black", "Inter", system-ui, sans-serif';

  const cellX = (i: number) => GUTTER + (i % COLS) * (TILE_W + GUTTER);
  const cellY = (i: number) => GUTTER + Math.floor(i / COLS) * (TILE_H + LABEL_H + GUTTER);

  // Title tile
  {
    const x = cellX(0);
    const y = cellY(0);
    ctx.fillStyle = "#141414";
    ctx.fillRect(x, y, TILE_W, TILE_H + LABEL_H);
    ctx.fillStyle = "#C1281B";
    ctx.fillRect(x + 48, y + 56, 20, 20);
    ctx.fillStyle = "#EDEAE3";
    ctx.font = `500 22px ${mono}`;
    ctx.fillText("AFORCE SPATIAL STUDIO", x + 84, y + 73);
    ctx.font = `48px ${display}`;
    wrapText(ctx, doc.name.toUpperCase(), x + 48, y + 180, TILE_W - 96, 58);
    ctx.fillStyle = "#A19C91";
    ctx.font = `400 22px ${mono}`;
    ctx.fillText(
      `FLOOR ${formatFeet(doc.floor.width)} × ${formatFeet(doc.floor.depth)} · ${doc.fixtures.length} FIXTURES`,
      x + 48,
      y + TILE_H - 120,
    );
    ctx.fillText(new Date().toISOString().slice(0, 10), x + 48, y + TILE_H - 84);
    ctx.fillStyle = "#EDEAE3";
    ctx.font = `500 22px ${mono}`;
    const ritual = "PAUSE. HYDRATE. ";
    ctx.fillText(ritual, x + 48, y + TILE_H - 24);
    const w1 = ctx.measureText(ritual).width;
    ctx.fillStyle = "#C1281B";
    ctx.fillText("LOCK-IN.", x + 48 + w1, y + TILE_H - 24);
    const w2 = ctx.measureText("LOCK-IN. ").width;
    ctx.fillStyle = "#EDEAE3";
    ctx.fillText("PERFORM.", x + 48 + w1 + w2, y + TILE_H - 24);
  }

  tiles.forEach((tile, i) => {
    const x = cellX(i + 1);
    const y = cellY(i + 1);
    ctx.fillStyle = "#070707";
    ctx.fillRect(x, y, TILE_W, TILE_H);
    if (tile.canvas) ctx.drawImage(tile.canvas, x, y, TILE_W, TILE_H);
    ctx.fillStyle = "#141414";
    ctx.fillRect(x, y + TILE_H, TILE_W, LABEL_H);
    ctx.fillStyle = "#C1281B";
    ctx.font = `600 20px ${mono}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 24, y + TILE_H + 36);
    ctx.fillStyle = "#EDEAE3";
    ctx.font = `500 20px ${mono}`;
    ctx.fillText(tile.label.toUpperCase(), x + 72, y + TILE_H + 36);
  });

  return canvasToBlob(sheet, "image/png");
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
