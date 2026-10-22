import { Html } from "@react-three/drei";

import { ImagePanel, useMaterials } from "../materials";
import { Box, Cyl } from "../primitives";
import { useSlot } from "../slots";
import type { FixtureProps } from "./types";

/**
 * AForce OS technology demonstration: a counter with a metal top and a
 * hands-on tablet, backed by a portrait totem running the OS readout. An
 * uploaded screen image replaces the readout; logo slot on the counter.
 */
export function OSDemoStation({ fixture }: FixtureProps) {
  const m = useMaterials();
  const screenImage = useSlot(fixture, "screen");
  const logo = useSlot(fixture, "logo");
  const { width: W, depth: D } = fixture.footprint;
  const counterH = 3;
  const counterD = 2;
  const counterZ = D / 2 - counterD / 2;
  const counterFront = counterZ + counterD / 2;
  const totemW = 3;
  const totemH = Math.max(2, fixture.footprint.height - 2);
  const totemZ = -D / 2 + 0.35;
  const totemY = 1.5 + totemH / 2;
  const screenFaceZ = totemZ + 0.08;

  return (
    <group>
      {/* Counter */}
      <Box size={[W, counterH, counterD]} position={[0, counterH / 2, counterZ]} material={m.surface} />
      <Box size={[W + 0.15, 0.1, counterD + 0.15]} position={[0, counterH + 0.05, counterZ]} material={m.metal} />
      <Box size={[W - 0.2, 0.05, 0.04]} position={[0, 0.35, counterFront + 0.02]} material={m.accent} castShadow={false} />
      <ImagePanel assetId={logo} width={Math.min(3.5, W - 1)} height={1.2} position={[0, 1.7, counterFront + 0.03]} glow={0.6} />

      {/* Tablet, propped at 20 degrees */}
      <Box size={[1.0, 0.04, 0.7]} position={[0.9, counterH + 0.22, counterZ + 0.3]} rotation={[-0.35, 0, 0]} material={m.gloss} />

      {/* Totem */}
      <Box size={[0.5, 1.6, 0.5]} position={[0, 0.8, totemZ]} material={m.darkMetal} />
      <Box size={[totemW, totemH, 0.16]} position={[0, totemY, totemZ]} material={m.surface} />
      <mesh position={[0, totemY, screenFaceZ]} material={m.screen}>
        <planeGeometry args={[totemW - 0.2, totemH - 0.2]} />
      </mesh>
      <Box size={[totemW - 0.4, 0.03, 0.01]} position={[0, totemY + totemH / 2 - 0.3, screenFaceZ + 0.005]} material={m.accent} castShadow={false} />

      {screenImage ? (
        <ImagePanel
          assetId={screenImage}
          width={totemW - 0.2}
          height={totemH - 0.2}
          position={[0, totemY, screenFaceZ + 0.02]}
          fit="cover"
          glow={0.9}
        />
      ) : (
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
      )}

      <Cyl args={[0.05, 0.05, 0.5, 12]} position={[0, 1.55, totemZ - 0.3]} material={m.darkMetal} castShadow={false} />
      <pointLight position={[0, 6.5, counterZ + 1]} color="#FFFFFF" intensity={14} distance={9} decay={2} />
    </group>
  );
}
