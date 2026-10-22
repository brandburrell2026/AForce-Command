import { Html } from "@react-three/drei";

import { brushedMetal, darkMetal, glossBlack, matteBlack, screenGlass, signalRedLed } from "@/scene/materials";

import { Box, Cyl } from "../primitives";
import type { FixtureProps } from "./types";

/**
 * AForce OS technology demonstration: a matte black counter with a metal
 * top and a hands-on tablet, backed by a 3 × 5 ft portrait totem running
 * the OS readout.
 */
export function OSDemoStation({ fixture }: FixtureProps) {
  const { width: W, depth: D } = fixture.footprint;
  const counterH = 3;
  const counterD = 2;
  const counterZ = D / 2 - counterD / 2;
  const totemW = 3;
  const totemH = Math.max(2, fixture.footprint.height - 2);
  const totemZ = -D / 2 + 0.35;
  const totemY = 1.5 + totemH / 2;
  const screenFaceZ = totemZ + 0.08;

  return (
    <group>
      {/* Counter */}
      <Box size={[W, counterH, counterD]} position={[0, counterH / 2, counterZ]} material={matteBlack} />
      <Box size={[W + 0.15, 0.1, counterD + 0.15]} position={[0, counterH + 0.05, counterZ]} material={brushedMetal} />
      <Box size={[W - 0.2, 0.05, 0.04]} position={[0, 0.35, counterZ + counterD / 2 + 0.02]} material={signalRedLed} castShadow={false} />

      {/* Tablet, propped at 20 degrees */}
      <Box size={[1.0, 0.04, 0.7]} position={[0.9, counterH + 0.22, counterZ + 0.3]} rotation={[-0.35, 0, 0]} material={glossBlack} />

      {/* Totem */}
      <Box size={[0.5, 1.6, 0.5]} position={[0, 0.8, totemZ]} material={darkMetal} />
      <Box size={[totemW, totemH, 0.16]} position={[0, totemY, totemZ]} material={matteBlack} />
      <mesh position={[0, totemY, screenFaceZ]} material={screenGlass}>
        <planeGeometry args={[totemW - 0.2, totemH - 0.2]} />
      </mesh>
      <Box size={[totemW - 0.4, 0.03, 0.01]} position={[0, totemY + totemH / 2 - 0.3, screenFaceZ + 0.005]} material={signalRedLed} castShadow={false} />

      {/* Screen content as a DOM overlay pinned to the glass */}
      <Html position={[0, totemY, screenFaceZ + 0.02]} transform distanceFactor={7.5} zIndexRange={[4, 0]} occlude>
        <div className="screen-ui">
          <div className="eyebrow">AFORCE OS · HYDROSTATE</div>
          <div className="ring">
            <span>74</span>
          </div>
          <div className="foot">
            READY<br />
            NEXT COMMAND <b>14:00</b>
          </div>
        </div>
      </Html>

      <Cyl args={[0.05, 0.05, 0.5, 12]} position={[0, 1.55, totemZ - 0.3]} material={darkMetal} castShadow={false} />
      <pointLight position={[0, 6.5, counterZ + 1]} color="#FFFFFF" intensity={14} distance={9} decay={2} />
    </group>
  );
}
