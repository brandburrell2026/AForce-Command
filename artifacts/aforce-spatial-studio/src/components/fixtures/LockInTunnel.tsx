import { Tag } from "../labels";
import { ImagePanel, useMaterials } from "../materials";
import { Box } from "../primitives";
import { useSlot } from "../slots";
import type { FixtureProps } from "./types";

/**
 * Immersive LED tunnel. Matte shell, gloss floor, accent LED portal ribs
 * every 18 in, metal entrance trim. Guests enter from the open front (+z)
 * and exit toward the hydration bar. Graphic slot on the outer wall that
 * faces the floor.
 */
export function LockInTunnel({ fixture }: FixtureProps) {
  const m = useMaterials();
  const graphic = useSlot(fixture, "logo");
  const { width: W, depth: L, height: H } = fixture.footprint;
  const t = 0.4;
  const innerW = W - 2 * t;
  const ribSpacing = 1.5;
  const ribCount = Math.floor(L / ribSpacing);
  const ribs = Array.from({ length: ribCount }, (_, i) => -L / 2 + ribSpacing / 2 + i * ribSpacing);
  const ribH = H - t - 0.1;

  return (
    <group>
      {/* Shell */}
      <Box size={[t, H, L]} position={[-W / 2 + t / 2, H / 2, 0]} material={m.surface} />
      <Box size={[t, H, L]} position={[W / 2 - t / 2, H / 2, 0]} material={m.surface} />
      <Box size={[W, t, L]} position={[0, H - t / 2, 0]} material={m.surface} />
      <Box size={[innerW, 0.08, L]} position={[0, 0.04, 0]} material={m.gloss} />
      <ImagePanel
        assetId={graphic}
        width={Math.max(2, L - 2)}
        height={Math.max(1, H - 2.5)}
        position={[W / 2 + 0.02, H / 2 - 0.4, 0]}
        rotation={[0, Math.PI / 2, 0]}
        glow={0.5}
      />

      {/* LED portal ribs */}
      {ribs.map((z) => (
        <group key={z} position={[0, 0, z]}>
          <Box size={[0.1, ribH, 0.18]} position={[-innerW / 2 + 0.06, ribH / 2 + 0.08, 0]} material={m.accent} castShadow={false} />
          <Box size={[0.1, ribH, 0.18]} position={[innerW / 2 - 0.06, ribH / 2 + 0.08, 0]} material={m.accent} castShadow={false} />
          <Box size={[innerW, 0.1, 0.18]} position={[0, ribH + 0.03, 0]} material={m.accent} castShadow={false} />
        </group>
      ))}

      {/* Entrance trim */}
      <Box size={[0.12, H, 0.12]} position={[-W / 2 + 0.06, H / 2, L / 2 + 0.06]} material={m.metal} />
      <Box size={[0.12, H, 0.12]} position={[W / 2 - 0.06, H / 2, L / 2 + 0.06]} material={m.metal} />
      <Box size={[W, 0.12, 0.12]} position={[0, H - 0.06, L / 2 + 0.06]} material={m.metal} />

      <pointLight position={[0, H / 2, -L / 3]} color={m.accentHex} intensity={26 * m.ledIntensity} distance={10} decay={2} />
      <pointLight position={[0, H / 2, 0]} color={m.accentHex} intensity={26 * m.ledIntensity} distance={10} decay={2} />
      <pointLight position={[0, H / 2, L / 3]} color={m.accentHex} intensity={26 * m.ledIntensity} distance={10} decay={2} />

      <Tag position={[0, H + 0.7, L / 2]} tone="signal">
        Lock-In
      </Tag>
    </group>
  );
}
