import { FLAVORS } from "@/scene/model";
import type { Vec3 } from "@/scene/model";
import {
  brushedMetal,
  flavorLed,
  glossBlack,
  matteBlack,
  panelBlack,
  signalRedLed,
} from "@/scene/materials";

import { Tag } from "../labels";
import { Box, Cyl } from "../primitives";
import type { FixtureProps } from "./types";

/**
 * Premium hydration bar. A 12 ft matte black counter with a brushed-metal
 * top, three taps with red LED indicators, a red toe-kick, and a back-bar
 * wall with three backlit flavor niches: Watermelon, Soursop, Berry.
 */
export function HydrationBar({ fixture }: FixtureProps) {
  const { width: W, depth: D, height: H } = fixture.footprint;
  const counterD = 2.5;
  const counterH = 3.5;
  const counterZ = D / 2 - counterD / 2;
  const counterFront = counterZ + counterD / 2;
  const wallT = 0.5;
  const wallZ = -D / 2 + wallT / 2;
  const wallFace = wallZ + wallT / 2;
  const nicheXs = [-4, 0, 4];
  const tapXs = [-3, 0, 3];

  return (
    <group position={fixture.position} rotation={[0, fixture.rotationY, 0]}>
      {/* Back-bar wall */}
      <Box size={[W, H, wallT]} position={[0, H / 2, wallZ]} material={panelBlack} />
      <Box size={[W - 0.4, 0.06, 0.06]} position={[0, H - 0.35, wallFace + 0.03]} material={signalRedLed} castShadow={false} />

      {/* Flavor niches */}
      {FLAVORS.map((flavor, i) => {
        const x = nicheXs[i] ?? 0;
        const mat = flavorLed(flavor.color);
        const tagPos: Vec3 = [x, 7.75, wallFace + 0.2];
        return (
          <group key={flavor.id} position={[x, 0, wallFace]}>
            {/* Halo: colored LED panel behind a black inset */}
            <Box size={[2.7, 3.5, 0.04]} position={[0, 5.6, 0.02]} material={mat} castShadow={false} />
            <Box size={[2.35, 3.15, 0.08]} position={[0, 5.6, 0.07]} material={matteBlack} />
            {/* Shelf and product tower */}
            <Box size={[2.7, 0.08, 0.95]} position={[0, 4.0, 0.47]} material={brushedMetal} />
            <Cyl args={[0.34, 0.34, 2.2, 32]} position={[0, 5.15, 0.47]} material={glossBlack} />
            <Cyl args={[0.36, 0.36, 0.1, 32]} position={[0, 6.3, 0.47]} material={mat} castShadow={false} />
            <Cyl args={[0.36, 0.36, 0.06, 32]} position={[0, 4.08, 0.47]} material={mat} castShadow={false} />
            <pointLight position={[0, 5.4, 1.3]} color={flavor.color} intensity={10} distance={6} decay={2} />
            <Tag position={tagPos}>{flavor.label}</Tag>
          </group>
        );
      })}

      {/* Counter */}
      <Box size={[W, counterH, counterD]} position={[0, counterH / 2, counterZ]} material={matteBlack} />
      <Box size={[W + 0.2, 0.12, counterD + 0.2]} position={[0, counterH + 0.06, counterZ]} material={brushedMetal} />
      <Box size={[W - 0.2, 0.06, 0.04]} position={[0, 0.35, counterFront + 0.02]} material={signalRedLed} castShadow={false} />
      <Box size={[W - 0.2, 0.04, 0.03]} position={[0, counterH - 0.6, counterFront + 0.02]} material={brushedMetal} castShadow={false} />

      {/* Taps */}
      {tapXs.map((x) => (
        <group key={x} position={[x, counterH + 0.12, counterZ - 0.6]}>
          <Cyl args={[0.1, 0.12, 1.1, 24]} position={[0, 0.55, 0]} material={brushedMetal} />
          <Cyl args={[0.08, 0.08, 0.7, 24]} position={[0, 1.1, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={brushedMetal} />
          <Box size={[0.12, 0.12, 0.12]} position={[0, 0.9, 0.11]} material={signalRedLed} castShadow={false} />
        </group>
      ))}

      <pointLight position={[0, H - 1, counterZ]} color="#FFF3E6" intensity={24} distance={12} decay={2} />
    </group>
  );
}
