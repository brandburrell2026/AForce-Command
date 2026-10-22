import type { Fixture, FloorPlan, Vec3 } from "@/scene/model";

/** Smallest footprint dimension the editor allows, feet. */
export const MIN_DIM = 0.5;

export function snapTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function round(value: number, places = 3): number {
  const p = 10 ** places;
  return Math.round(value * p) / p;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Wrap an angle into (-π, π]. */
export function normalizeAngle(rad: number): number {
  let a = rad % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Half extents of the fixture's rotated footprint along world x and z. */
export function rotatedHalfExtents(fixture: Fixture): { hx: number; hz: number } {
  const c = Math.abs(Math.cos(fixture.rotationY));
  const s = Math.abs(Math.sin(fixture.rotationY));
  const hw = fixture.footprint.width / 2;
  const hd = fixture.footprint.depth / 2;
  return { hx: hw * c + hd * s, hz: hw * s + hd * c };
}

/** Keep the whole rotated footprint inside the floor. Oversized fixtures center. */
export function clampPosition(fixture: Fixture, floor: FloorPlan): Vec3 {
  const { hx, hz } = rotatedHalfExtents(fixture);
  const limX = Math.max(0, floor.width / 2 - hx);
  const limZ = Math.max(0, floor.depth / 2 - hz);
  const clamp = (v: number, lim: number) => Math.min(lim, Math.max(-lim, v));
  return [clamp(fixture.position[0], limX), 0, clamp(fixture.position[2], limZ)];
}
