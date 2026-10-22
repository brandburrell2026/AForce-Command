import type { Vec3 } from "@/scene/model";

import { Tag } from "../labels";
import { ImagePanel, useMaterials } from "../materials";
import { Box, Cyl } from "../primitives";
import { useSlot } from "../slots";
import type { FixtureProps } from "./types";

/**
 * Wear the Standard apparel gallery. A backlit panel with a warm-white LED
 * halo, a metal rail with five hanging pieces, and a low plinth with folded
 * stacks. Faces −x, toward the floor. Logo slot above the rail.
 */
export function ApparelGallery({ fixture }: FixtureProps) {
  const m = useMaterials();
  const logo = useSlot(fixture, "logo");
  const pieces = [m.clothBlack, m.clothBone, m.clothAccent, m.clothBlack, m.clothBone];
  const { width: W, depth: D, height: H } = fixture.footprint;
  const panelT = 0.4;
  const panelX = W / 2 - panelT / 2;
  const panelFace = panelX - panelT / 2;
  const railX = panelFace - 0.75;
  const railY = 6.2;
  const spacing = 1.6;
  const zs = pieces.map((_, i) => (i - (pieces.length - 1) / 2) * spacing);
  const tagPos: Vec3 = [panelFace - 0.3, H + 0.6, 0];

  return (
    <group>
      {/* Halo and panel */}
      <Box size={[0.02, H + 0.6, D + 0.6]} position={[W / 2 - 0.01, H / 2, 0]} material={m.warmWhite} castShadow={false} />
      <Box size={[panelT, H, D]} position={[panelX, H / 2, 0]} material={m.panel} />
      <ImagePanel
        assetId={logo}
        width={Math.min(6, D - 2)}
        height={Math.max(1, H - 7.2)}
        position={[panelFace - 0.02, H - 1.3, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        glow={0.6}
      />

      {/* Rail and brackets */}
      <Cyl args={[0.05, 0.05, D - 1.5, 16]} position={[railX, railY, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal} />
      <Box size={[0.75, 0.06, 0.06]} position={[panelFace - 0.375, railY, -(D / 2 - 1)]} material={m.metal} />
      <Box size={[0.75, 0.06, 0.06]} position={[panelFace - 0.375, railY, D / 2 - 1]} material={m.metal} />

      {/* Hanging pieces */}
      {pieces.map((mat, i) => {
        const z = zs[i] ?? 0;
        return (
          <group key={i} position={[railX, 0, z]}>
            <Cyl args={[0.02, 0.02, 0.4, 8]} position={[0, railY - 0.2, 0]} material={m.darkMetal} castShadow={false} />
            <Box size={[0.12, 2.3, 1.5]} position={[0, railY - 0.4 - 1.15, 0]} material={mat} />
          </group>
        );
      })}

      {/* Plinth with folded stacks */}
      <Box size={[1.1, 1.2, 2.0]} position={[panelFace - 1.5, 0.6, 0]} material={m.surface} />
      <Box size={[0.7, 0.3, 0.7]} position={[panelFace - 1.5, 1.35, -0.5]} material={m.clothBone} />
      <Box size={[0.7, 0.3, 0.7]} position={[panelFace - 1.5, 1.35, 0.5]} material={m.clothBlack} />

      <pointLight position={[panelFace - 1.5, H - 0.5, 0]} color="#FFF3E6" intensity={22} distance={11} decay={2} />
      <Tag position={tagPos} tone="bone">
        Wear the Standard
      </Tag>
    </group>
  );
}
