import { PALETTE, brushedMetal, darkMetal, matteBlack, signalRedLed } from "@/scene/materials";

import { Box } from "../primitives";
import type { FixtureProps } from "./types";

/**
 * Large illuminated inverted-N: Signal Red LED channel letters on a dark
 * metal backer, standing on a matte black plinth with a metal edge and a red
 * LED inlay. The N is mirrored (diagonal rises bottom-left to top-right),
 * matching the right-hand N of the brand monogram.
 */
export function Centerpiece({ fixture }: FixtureProps) {
  const { width, depth } = fixture.footprint;
  const plinthH = 1;
  const letterH = 6.5;
  const stemW = 0.65;
  const letterD = 0.8;
  const halfSpan = 1.7;
  const diagLen = Math.hypot(halfSpan * 2, letterH - stemW);
  const diagAngle = Math.atan2(halfSpan * 2, letterH - stemW);
  const y0 = plinthH + letterH / 2;
  const inset = 0.35;
  const inlayW = width - inset * 2;
  const inlayD = depth - inset * 2;

  return (
    <group position={fixture.position} rotation={[0, fixture.rotationY, 0]}>
      {/* Plinth */}
      <Box size={[width, plinthH, depth]} position={[0, plinthH / 2, 0]} material={matteBlack} />
      <Box size={[width + 0.1, 0.06, depth + 0.1]} position={[0, plinthH + 0.03, 0]} material={brushedMetal} />

      {/* Red LED inlay on the plinth top */}
      <Box size={[inlayW, 0.02, 0.08]} position={[0, plinthH + 0.07, -inlayD / 2]} material={signalRedLed} castShadow={false} />
      <Box size={[inlayW, 0.02, 0.08]} position={[0, plinthH + 0.07, inlayD / 2]} material={signalRedLed} castShadow={false} />
      <Box size={[0.08, 0.02, inlayD]} position={[-inlayW / 2, plinthH + 0.07, 0]} material={signalRedLed} castShadow={false} />
      <Box size={[0.08, 0.02, inlayD]} position={[inlayW / 2, plinthH + 0.07, 0]} material={signalRedLed} castShadow={false} />

      {/* Dark metal backers behind each stroke */}
      <Box size={[stemW + 0.3, letterH + 0.3, 0.15]} position={[-halfSpan, y0, -0.5]} material={darkMetal} />
      <Box size={[stemW + 0.3, letterH + 0.3, 0.15]} position={[halfSpan, y0, -0.5]} material={darkMetal} />
      <Box size={[stemW + 0.3, diagLen, 0.15]} position={[0, y0, -0.5]} rotation={[0, 0, -diagAngle]} material={darkMetal} />

      {/* LED strokes: two stems and the rising diagonal */}
      <Box size={[stemW, letterH, letterD]} position={[-halfSpan, y0, 0]} material={signalRedLed} />
      <Box size={[stemW, letterH, letterD]} position={[halfSpan, y0, 0]} material={signalRedLed} />
      <Box size={[stemW, diagLen, letterD]} position={[0, y0, 0]} rotation={[0, 0, -diagAngle]} material={signalRedLed} />

      <pointLight position={[0, plinthH + 3.5, 1.2]} color={PALETTE.signalRed} intensity={70} distance={22} decay={2} />
      <pointLight position={[0, plinthH + 3.5, -1.4]} color={PALETTE.signalRed} intensity={40} distance={18} decay={2} />
    </group>
  );
}
