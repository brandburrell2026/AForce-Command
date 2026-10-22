import type * as THREE from "three";

import type { Vec3 } from "@/scene/model";
import {
  brushedMetal,
  clothBlack,
  clothBone,
  clothRed,
  darkMetal,
  matteBlack,
  panelBlack,
  warmWhiteLed,
} from "@/scene/materials";

import { Tag } from "../labels";
import { Box, Cyl } from "../primitives";
import type { FixtureProps } from "./types";

const PIECES: THREE.Material[] = [clothBlack, clothBone, clothRed, clothBlack, clothBone];

/**
 * Wear the Standard apparel gallery. A 9 × 9 ft matte black panel with a
 * warm-white LED halo, a brushed-metal rail with five hanging pieces, and
 * a low plinth with folded stacks. Faces −x, toward the floor.
 */
export function ApparelGallery({ fixture }: FixtureProps) {
  const { width: W, depth: D, height: H } = fixture.footprint;
  const panelT = 0.4;
  const panelX = W / 2 - panelT / 2;
  const panelFace = panelX - panelT / 2;
  const railX = panelFace - 0.75;
  const railY = 6.2;
  const spacing = 1.6;
  const zs = PIECES.map((_, i) => (i - (PIECES.length - 1) / 2) * spacing);
  const tagPos: Vec3 = [panelFace - 0.3, H + 0.6, 0];

  return (
    <group position={fixture.position} rotation={[0, fixture.rotationY, 0]}>
      {/* Halo and panel */}
      <Box size={[0.02, H + 0.6, D + 0.6]} position={[W / 2 - 0.01, H / 2, 0]} material={warmWhiteLed} castShadow={false} />
      <Box size={[panelT, H, D]} position={[panelX, H / 2, 0]} material={panelBlack} />

      {/* Rail and brackets */}
      <Cyl args={[0.05, 0.05, D - 1.5, 16]} position={[railX, railY, 0]} rotation={[Math.PI / 2, 0, 0]} material={brushedMetal} />
      <Box size={[0.75, 0.06, 0.06]} position={[panelFace - 0.375, railY, -(D / 2 - 1)]} material={brushedMetal} />
      <Box size={[0.75, 0.06, 0.06]} position={[panelFace - 0.375, railY, D / 2 - 1]} material={brushedMetal} />

      {/* Hanging pieces */}
      {PIECES.map((mat, i) => {
        const z = zs[i] ?? 0;
        return (
          <group key={i} position={[railX, 0, z]}>
            <Cyl args={[0.02, 0.02, 0.4, 8]} position={[0, railY - 0.2, 0]} material={darkMetal} castShadow={false} />
            <Box size={[0.12, 2.3, 1.5]} position={[0, railY - 0.4 - 1.15, 0]} material={mat} />
          </group>
        );
      })}

      {/* Plinth with folded stacks */}
      <Box size={[1.1, 1.2, 2.0]} position={[panelFace - 1.5, 0.6, 0]} material={matteBlack} />
      <Box size={[0.7, 0.3, 0.7]} position={[panelFace - 1.5, 1.35, -0.5]} material={clothBone} />
      <Box size={[0.7, 0.3, 0.7]} position={[panelFace - 1.5, 1.35, 0.5]} material={clothBlack} />

      <pointLight position={[panelFace - 1.5, H - 0.5, 0]} color="#FFF3E6" intensity={22} distance={11} decay={2} />
      <Tag position={tagPos} tone="bone">
        Wear the Standard
      </Tag>
    </group>
  );
}
