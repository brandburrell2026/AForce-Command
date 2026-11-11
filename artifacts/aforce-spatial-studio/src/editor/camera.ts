import type { Vec3 } from "@/scene/model";

/** Walkthrough constants, feet. */
export const EYE_HEIGHT = 5.6;
export const BODY_RADIUS = 1.0;
export const WALK_SPEED = 6; // ft/s
export const RUN_SPEED = 11;

export type CameraMode = "orbit" | "walk";

export type CameraPresetId =
  | "hero"
  | "front"
  | "overhead"
  | "iso-left"
  | "bar"
  | "tunnel"
  | "centerpiece";

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: Vec3;
  target: Vec3;
}

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  { id: "hero", label: "Hero", position: [27, 17, 31], target: [0, 3.5, 0] },
  { id: "front", label: "Front elevation", position: [0, 9, 44], target: [0, 4, 0] },
  { id: "overhead", label: "Overhead", position: [0, 62, 0.01], target: [0, 0, 0] },
  { id: "iso-left", label: "Isometric left", position: [-30, 20, 30], target: [0, 3, 0] },
  { id: "bar", label: "Hydration bar", position: [-1.5, 7, 7], target: [-1.5, 5, -7] },
  { id: "tunnel", label: "Lock-In tunnel", position: [-7.5, 5.6, 17], target: [-7.5, 5, 0] },
  { id: "centerpiece", label: "Centerpiece", position: [8, 6, 12], target: [0, 4.5, 0.5] },
];

export type CameraRequest =
  | { nonce: number; kind: "preset"; id: CameraPresetId }
  | { nonce: number; kind: "frame"; fixtureId: string | null };

/**
 * Bridge from the DOM overlay to the pointer-lock controls inside the
 * canvas. Pointer lock must be requested synchronously from a user
 * gesture, so the overlay's click handler calls this directly.
 */
export const walkBridge: { lock: (() => void) | null } = { lock: null };

export function requestWalkLock() {
  walkBridge.lock?.();
}
