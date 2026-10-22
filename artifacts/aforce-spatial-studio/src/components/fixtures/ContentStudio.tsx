import { coolWhiteLed, darkMetal, glossBlack, matteBlack, warmWhiteLed } from "@/scene/materials";

import { Box, Cyl, Ring } from "../primitives";
import type { FixtureProps } from "./types";

/**
 * Branded photography and content studio in the back-right corner: two
 * matte black cyc panels with cool-white LED edges, gloss floor mat, ring
 * light on a stand, camera on a tripod, and a softbox key light.
 */
export function ContentStudio({ fixture }: FixtureProps) {
  const { width: W, depth: D, height: H } = fixture.footprint;
  const panelT = 0.2;

  return (
    <group>
      {/* Cyc corner */}
      <Box size={[W, H, panelT]} position={[0, H / 2, -D / 2 + panelT / 2]} material={matteBlack} />
      <Box size={[panelT, H, D]} position={[W / 2 - panelT / 2, H / 2, 0]} material={matteBlack} />
      <Box size={[0.06, H - 0.4, 0.06]} position={[-W / 2 + 0.05, H / 2, -D / 2 + panelT + 0.03]} material={coolWhiteLed} castShadow={false} />
      <Box size={[0.06, H - 0.4, 0.06]} position={[W / 2 - panelT - 0.03, H / 2, D / 2 - 0.05]} material={coolWhiteLed} castShadow={false} />
      <Box size={[W, 0.05, D]} position={[0, 0.025, 0]} material={glossBlack} castShadow={false} />

      {/* Ring light on a stand, facing the corner */}
      <group position={[0.9, 0, 0.9]} rotation={[0, -Math.PI / 4, 0]}>
        <Cyl args={[0.5, 0.55, 0.06, 32]} position={[0, 0.03, 0]} material={darkMetal} />
        <Cyl args={[0.04, 0.04, 5.3, 12]} position={[0, 2.65, 0]} material={darkMetal} />
        <Ring args={[0.9, 0.06, 16, 64]} position={[0, 5.3, 0]} material={coolWhiteLed} />
        <Ring args={[0.98, 0.03, 12, 64]} position={[0, 5.3, -0.04]} material={darkMetal} />
      </group>

      {/* Camera on a tripod */}
      <group position={[1.7, 0, 1.7]} rotation={[0, -Math.PI / 4, 0]}>
        <Cyl args={[0.03, 0.03, 4.0, 10]} position={[0, 2.0, 0]} material={darkMetal} />
        <Cyl args={[0.03, 0.03, 4.0, 10]} position={[0, 2.0, 0]} rotation={[0.22, 0, 0.22]} material={darkMetal} />
        <Cyl args={[0.03, 0.03, 4.0, 10]} position={[0, 2.0, 0]} rotation={[0.22, 0, -0.22]} material={darkMetal} />
        <Box size={[0.5, 0.35, 0.55]} position={[0, 4.2, 0]} material={glossBlack} />
        <Cyl args={[0.12, 0.14, 0.3, 24]} position={[0, 4.2, -0.4]} rotation={[Math.PI / 2, 0, 0]} material={darkMetal} />
      </group>

      {/* Softbox key light */}
      <group position={[-1.6, 0, 1.4]} rotation={[0, 0.6, 0]}>
        <Cyl args={[0.04, 0.04, 6.0, 10]} position={[0, 3.0, 0]} material={darkMetal} />
        <Box size={[1.6, 1.6, 0.5]} position={[0, 6.0, -0.3]} rotation={[0.35, 0, 0]} material={warmWhiteLed} />
      </group>

      <pointLight position={[0, 6.0, 0.4]} color="#FFFFFF" intensity={30} distance={10} decay={2} />
    </group>
  );
}
