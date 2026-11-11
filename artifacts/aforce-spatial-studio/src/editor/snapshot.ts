/**
 * Bridge from the DOM side to the WebGL canvas. The Snapshot component
 * inside the Canvas installs `capture`; project saves use it for
 * thumbnails and section 6 builds renders on it.
 */
export interface CaptureOptions {
  /** Output width in pixels; height follows the canvas aspect. */
  width: number;
  type?: "image/jpeg" | "image/png";
  quality?: number;
}

export const snapshotBridge: { capture: ((options: CaptureOptions) => string | null) | null } = {
  capture: null,
};

export function captureSnapshot(options: CaptureOptions): string | null {
  try {
    return snapshotBridge.capture?.(options) ?? null;
  } catch {
    return null;
  }
}
