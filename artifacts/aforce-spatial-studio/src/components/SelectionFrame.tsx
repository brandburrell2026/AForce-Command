import * as THREE from "three";

import type { Footprint, Vec3 } from "@/scene/model";
import { PALETTE } from "@/scene/materials";

import { Box } from "./primitives";

const signal = new THREE.MeshBasicMaterial({ color: PALETTE.signalRed, toneMapped: false });
const bone = new THREE.MeshBasicMaterial({ color: PALETTE.muted, toneMapped: false });

/**
 * Footprint outline on the floor with short corner posts. Rendered inside
 * the fixture's group so it follows every move, rotation and scale.
 */
export function SelectionFrame({ footprint, tone }: { footprint: Footprint; tone: "signal" | "bone" }) {
  const material = tone === "signal" ? signal : bone;
  const hw = footprint.width / 2 + 0.15;
  const hd = footprint.depth / 2 + 0.15;
  const y = 0.03;
  const t = tone === "signal" ? 0.07 : 0.045;
  const post = 0.7;

  const edges: Array<{ size: Vec3; position: Vec3 }> = [
    { size: [hw * 2, 0.02, t], position: [0, y, -hd] },
    { size: [hw * 2, 0.02, t], position: [0, y, hd] },
    { size: [t, 0.02, hd * 2], position: [-hw, y, 0] },
    { size: [t, 0.02, hd * 2], position: [hw, y, 0] },
  ];
  const corners: Vec3[] = [
    [-hw, post / 2, -hd],
    [hw, post / 2, -hd],
    [-hw, post / 2, hd],
    [hw, post / 2, hd],
  ];

  return (
    <group>
      {edges.map((e, i) => (
        <Box key={i} size={e.size} position={e.position} material={material} castShadow={false} receiveShadow={false} />
      ))}
      {corners.map((c, i) => (
        <Box key={`c${i}`} size={[t, post, t]} position={c} material={material} castShadow={false} receiveShadow={false} />
      ))}
    </group>
  );
}
