import { PALETTE, brushedMetal, glossBlack, matteBlack, signalRedLed } from "@/scene/materials";

import { Tag } from "../labels";
import { Box } from "../primitives";
import type { FixtureProps } from "./types";

/**
 * Immersive red LED tunnel. Matte black shell, gloss black floor, Signal
 * Red LED portal ribs every 18 in, brushed-metal entrance trim. Guests
 * enter from the open front (+z) and exit toward the hydration bar.
 */
export function LockInTunnel({ fixture }: FixtureProps) {
  const { width: W, depth: L, height: H } = fixture.footprint;
  const t = 0.4;
  const innerW = W - 2 * t;
  const ribSpacing = 1.5;
  const ribCount = Math.floor(L / ribSpacing);
  const ribs = Array.from({ length: ribCount }, (_, i) => -L / 2 + ribSpacing / 2 + i * ribSpacing);
  const ribH = H - t - 0.1;

  return (
    <group position={fixture.position} rotation={[0, fixture.rotationY, 0]}>
      {/* Shell */}
      <Box size={[t, H, L]} position={[-W / 2 + t / 2, H / 2, 0]} material={matteBlack} />
      <Box size={[t, H, L]} position={[W / 2 - t / 2, H / 2, 0]} material={matteBlack} />
      <Box size={[W, t, L]} position={[0, H - t / 2, 0]} material={matteBlack} />
      <Box size={[innerW, 0.08, L]} position={[0, 0.04, 0]} material={glossBlack} />

      {/* LED portal ribs */}
      {ribs.map((z) => (
        <group key={z} position={[0, 0, z]}>
          <Box size={[0.1, ribH, 0.18]} position={[-innerW / 2 + 0.06, ribH / 2 + 0.08, 0]} material={signalRedLed} castShadow={false} />
          <Box size={[0.1, ribH, 0.18]} position={[innerW / 2 - 0.06, ribH / 2 + 0.08, 0]} material={signalRedLed} castShadow={false} />
          <Box size={[innerW, 0.1, 0.18]} position={[0, ribH + 0.03, 0]} material={signalRedLed} castShadow={false} />
        </group>
      ))}

      {/* Entrance trim */}
      <Box size={[0.12, H, 0.12]} position={[-W / 2 + 0.06, H / 2, L / 2 + 0.06]} material={brushedMetal} />
      <Box size={[0.12, H, 0.12]} position={[W / 2 - 0.06, H / 2, L / 2 + 0.06]} material={brushedMetal} />
      <Box size={[W, 0.12, 0.12]} position={[0, H - 0.06, L / 2 + 0.06]} material={brushedMetal} />

      <pointLight position={[0, H / 2, -L / 3]} color={PALETTE.signalRed} intensity={26} distance={10} decay={2} />
      <pointLight position={[0, H / 2, 0]} color={PALETTE.signalRed} intensity={26} distance={10} decay={2} />
      <pointLight position={[0, H / 2, L / 3]} color={PALETTE.signalRed} intensity={26} distance={10} decay={2} />

      <Tag position={[0, H + 0.7, L / 2]} tone="signal">
        Lock-In
      </Tag>
    </group>
  );
}
