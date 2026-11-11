import type { Asset, AssetKind } from "@/scene/model";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_TEXTURE_DIM = 2048;

let counter = 0;

function nextAssetId(): string {
  counter += 1;
  return `asset-${Date.now().toString(36)}-${counter}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} is not an image the browser can read.`));
    };
    img.src = url;
  });
}

/**
 * Read an image file, downscale it to at most 2048 px on the long side,
 * and encode it as a data URL. Logos and PNG/WebP/SVG sources keep alpha
 * as PNG; everything else becomes JPEG.
 */
export async function importImageFile(file: File, kind: AssetKind): Promise<Asset> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not an image.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is larger than 8 MB.`);
  }
  const img = await loadImage(file);
  const srcW = img.naturalWidth || 1024;
  const srcH = img.naturalHeight || 1024;
  const scale = Math.min(1, MAX_TEXTURE_DIM / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(img, 0, 0, width, height);

  const keepAlpha =
    kind === "logo" || ["image/png", "image/webp", "image/svg+xml", "image/gif"].includes(file.type);
  const dataUrl = keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88);

  return {
    id: nextAssetId(),
    kind,
    name: file.name.replace(/\.[^.]+$/, ""),
    dataUrl,
    width,
    height,
    bytes: Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
