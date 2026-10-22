/** Render settings and size presets. Kept free of store imports so both sides can depend on it. */

export type RenderFormat = "png" | "jpeg";

export interface RenderSettings {
  width: number;
  height: number;
  format: RenderFormat;
  /** Render at 2× and downsample for cleaner edges (sizes up to 2560 px). */
  supersample: boolean;
  /** Hide the grid, outline, selection frame, gizmo and dimension lines. */
  hideOverlays: boolean;
  /** PNG with alpha and no venue background or fog. */
  transparent: boolean;
}

export interface RenderSize {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const RENDER_SIZES: readonly RenderSize[] = [
  { id: "hd", label: "HD · 1920 × 1080", width: 1920, height: 1080 },
  { id: "qhd", label: "QHD · 2560 × 1440", width: 2560, height: 1440 },
  { id: "uhd", label: "4K · 3840 × 2160", width: 3840, height: 2160 },
  { id: "deck", label: "Deck · 3000 × 2000", width: 3000, height: 2000 },
  { id: "square", label: "Square · 2160 × 2160", width: 2160, height: 2160 },
  { id: "portrait", label: "Portrait 4:5 · 1620 × 2025", width: 1620, height: 2025 },
];

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  width: 2560,
  height: 1440,
  format: "png",
  supersample: true,
  hideOverlays: true,
  transparent: false,
};

const SUPERSAMPLE_LIMIT = 2560;

export function supersampleFactor(settings: RenderSettings): number {
  return settings.supersample && settings.width <= SUPERSAMPLE_LIMIT && settings.height <= SUPERSAMPLE_LIMIT ? 2 : 1;
}
