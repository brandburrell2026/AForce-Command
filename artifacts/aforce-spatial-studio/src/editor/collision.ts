import type { Fixture, FixtureKind, FloorPlan, Footprint } from "@/scene/model";

/** A rectangle in a fixture's local space: center and full size, feet. */
export interface LocalRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** A rectangle in world space with its rotation pre-expanded. */
export interface Obstacle {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  cos: number;
  sin: number;
}

export interface Point2 {
  x: number;
  z: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Walkable interiors. A fixture without an entry blocks its whole
 * footprint. The tunnel is two side walls so guests can walk through it;
 * the studio and gallery block their panels and equipment only.
 */
const COLLISION_SHAPES: Partial<Record<FixtureKind, (fp: Footprint) => LocalRect[]>> = {
  "lock-in-tunnel": (fp) => {
    const t = 0.4;
    return [
      { x: -fp.width / 2 + t / 2, z: 0, w: t, d: fp.depth },
      { x: fp.width / 2 - t / 2, z: 0, w: t, d: fp.depth },
    ];
  },
  "content-studio": (fp) => {
    const t = 0.2;
    return [
      { x: 0, z: -fp.depth / 2 + t / 2, w: fp.width, d: t },
      { x: fp.width / 2 - t / 2, z: 0, w: t, d: fp.depth },
      { x: 0.9, z: 0.9, w: 1.2, d: 1.2 }, // ring light stand
      { x: 1.7, z: 1.7, w: 0.8, d: 0.8 }, // tripod
      { x: -1.6, z: 1.4, w: 0.6, d: 0.6 }, // softbox pole
    ];
  },
  "apparel-gallery": (fp) => {
    const panelT = 0.4;
    const panelFace = fp.width / 2 - panelT;
    return [
      { x: fp.width / 2 - panelT / 2, z: 0, w: panelT, d: fp.depth },
      { x: panelFace - 0.75, z: 0, w: 0.5, d: fp.depth - 1.5 }, // rail and garments
      { x: panelFace - 1.5, z: 0, w: 1.1, d: 2.0 }, // plinth
    ];
  },
};

function toObstacle(f: Fixture, rect: LocalRect): Obstacle {
  const cos = Math.cos(f.rotationY);
  const sin = Math.sin(f.rotationY);
  // Local offset to world: x' = x cos + z sin, z' = -x sin + z cos.
  const cx = f.position[0] + rect.x * cos + rect.z * sin;
  const cz = f.position[2] - rect.x * sin + rect.z * cos;
  return { cx, cz, hw: rect.w / 2, hd: rect.d / 2, cos, sin };
}

export function buildObstacles(fixtures: readonly Fixture[], floor: FloorPlan): Obstacle[] {
  const out: Obstacle[] = [];
  const hw = floor.width / 2;
  const hd = floor.depth / 2;
  const t = 0.5;
  // Perimeter walls: back, left, right. Front is open.
  out.push({ cx: 0, cz: -hd - t / 2, hw: hw + t, hd: t / 2, cos: 1, sin: 0 });
  out.push({ cx: -hw - t / 2, cz: 0, hw: t / 2, hd, cos: 1, sin: 0 });
  out.push({ cx: hw + t / 2, cz: 0, hw: t / 2, hd, cos: 1, sin: 0 });
  for (const f of fixtures) {
    const shape = COLLISION_SHAPES[f.kind];
    const rects = shape
      ? shape(f.footprint)
      : [{ x: 0, z: 0, w: f.footprint.width, d: f.footprint.depth }];
    for (const r of rects) out.push(toObstacle(f, r));
  }
  return out;
}

export function walkBounds(floor: FloorPlan, radius: number): Bounds {
  const hw = floor.width / 2;
  const hd = floor.depth / 2;
  return { minX: -(hw + 14), maxX: hw + 14, minZ: -(hd - radius), maxZ: hd + 14 };
}

function hits(p: Point2, radius: number, o: Obstacle): boolean {
  const dx = p.x - o.cx;
  const dz = p.z - o.cz;
  // World offset to local: x = x' cos - z' sin, z = x' sin + z' cos.
  const lx = dx * o.cos - dz * o.sin;
  const lz = dx * o.sin + dz * o.cos;
  const qx = Math.max(-o.hw, Math.min(o.hw, lx));
  const qz = Math.max(-o.hd, Math.min(o.hd, lz));
  const ex = lx - qx;
  const ez = lz - qz;
  return ex * ex + ez * ez < radius * radius;
}

function clampBounds(p: Point2, b: Bounds): Point2 {
  return {
    x: Math.max(b.minX, Math.min(b.maxX, p.x)),
    z: Math.max(b.minZ, Math.min(b.maxZ, p.z)),
  };
}

/**
 * Move a circle from one point toward another, sliding along whatever it
 * hits. Tries the full move, then each axis alone, then stays put.
 */
export function resolveMove(
  from: Point2,
  to: Point2,
  radius: number,
  obstacles: readonly Obstacle[],
  bounds: Bounds,
): Point2 {
  const free = (p: Point2) => !obstacles.some((o) => hits(p, radius, o));
  const full = clampBounds(to, bounds);
  if (free(full)) return full;
  const slideX = clampBounds({ x: to.x, z: from.z }, bounds);
  if (free(slideX)) return slideX;
  const slideZ = clampBounds({ x: from.x, z: to.z }, bounds);
  if (free(slideZ)) return slideZ;
  return from;
}
