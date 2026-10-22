import { Html } from "@react-three/drei";

import type { Vec3 } from "@/scene/model";
import { formatFeet } from "@/scene/units";

import { Box } from "./primitives";
import { labelLine } from "./sceneMaterials";

/** Labels sit under the HUD (z 10) but above the canvas. */
const LABEL_Z: [number, number] = [5, 0];

export function ZoneLabel({
  position,
  index,
  label,
  dims,
}: {
  position: Vec3;
  index: number;
  label: string;
  dims: string;
}) {
  return (
    <Html position={position} center zIndexRange={LABEL_Z}>
      <div className="zone-label">
        <span className="idx">{String(index).padStart(2, "0")}</span>
        <span>{label}</span>
        <span className="dims">{dims}</span>
      </div>
    </Html>
  );
}

export function Tag({
  position,
  children,
  tone = "muted",
}: {
  position: Vec3;
  children: string;
  tone?: "muted" | "signal" | "bone";
}) {
  const cls = tone === "muted" ? "tag-label" : `tag-label ${tone}`;
  return (
    <Html position={position} center zIndexRange={LABEL_Z}>
      <div className={cls}>{children}</div>
    </Html>
  );
}

/**
 * A dimension callout: a hairline between two points on the floor with end
 * ticks and the measured length at the midpoint. Points must share y and
 * differ along exactly one of x or z.
 */
export function Dimension({ from, to }: { from: Vec3; to: Vec3 }) {
  const alongX = from[0] !== to[0];
  const length = alongX ? Math.abs(to[0] - from[0]) : Math.abs(to[2] - from[2]);
  const center: Vec3 = [
    (from[0] + to[0]) / 2,
    from[1],
    (from[2] + to[2]) / 2,
  ];
  const tick = 0.6;
  const lineSize: Vec3 = alongX ? [length, 0.02, 0.03] : [0.03, 0.02, length];
  const tickSize: Vec3 = alongX ? [0.03, 0.02, tick] : [tick, 0.02, 0.03];
  const labelPos: Vec3 = [center[0], center[1] + 0.3, center[2]];

  return (
    <group>
      <Box size={lineSize} position={center} material={labelLine} castShadow={false} receiveShadow={false} />
      <Box size={tickSize} position={from} material={labelLine} castShadow={false} receiveShadow={false} />
      <Box size={tickSize} position={to} material={labelLine} castShadow={false} receiveShadow={false} />
      <Html position={labelPos} center zIndexRange={LABEL_Z}>
        <div className="dim-label">{formatFeet(length)}</div>
      </Html>
    </group>
  );
}
