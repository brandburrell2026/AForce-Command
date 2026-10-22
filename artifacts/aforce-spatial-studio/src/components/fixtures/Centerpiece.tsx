import { ImagePanel, useMaterials } from "../materials";
import { Box } from "../primitives";
import { useSlot } from "../slots";
import type { FixtureProps } from "./types";

/**
 * Large illuminated inverted-N: accent LED channel letters on a dark metal
 * backer, standing on a plinth with a metal edge and an LED inlay. The N is
 * mirrored (diagonal rises bottom-left to top-right), matching the
 * right-hand N of the brand monogram. Logo slot on the plinth front.
 */
export function Centerpiece({ fixture }: FixtureProps) {
  const m = useMaterials();
  const logo = useSlot(fixture, "logo");
  const { width, depth } = fixture.footprint;
  const plinthH = 1;
  const letterH = Math.max(2, fixture.footprint.height - plinthH);
  const stemW = 0.65;
  const letterD = 0.8;
  const halfSpan = Math.max(0.8, Math.min(1.7, width / 2 - 1.3));
  const diagLen = Math.hypot(halfSpan * 2, letterH - stemW);
  const diagAngle = Math.atan2(halfSpan * 2, letterH - stemW);
  const y0 = plinthH + letterH / 2;
  const inset = 0.35;
  const inlayW = width - inset * 2;
  const inlayD = depth - inset * 2;

  return (
    <group>
      {/* Plinth */}
      <Box size={[width, plinthH, depth]} position={[0, plinthH / 2, 0]} material={m.surface} />
      <Box size={[width + 0.1, 0.06, depth + 0.1]} position={[0, plinthH + 0.03, 0]} material={m.metal} />
      <ImagePanel assetId={logo} width={width - 1.5} height={plinthH - 0.3} position={[0, plinthH / 2, depth / 2 + 0.02]} glow={0.6} />

      {/* LED inlay on the plinth top */}
      <Box size={[inlayW, 0.02, 0.08]} position={[0, plinthH + 0.07, -inlayD / 2]} material={m.accent} castShadow={false} />
      <Box size={[inlayW, 0.02, 0.08]} position={[0, plinthH + 0.07, inlayD / 2]} material={m.accent} castShadow={false} />
      <Box size={[0.08, 0.02, inlayD]} position={[-inlayW / 2, plinthH + 0.07, 0]} material={m.accent} castShadow={false} />
      <Box size={[0.08, 0.02, inlayD]} position={[inlayW / 2, plinthH + 0.07, 0]} material={m.accent} castShadow={false} />

      {/* Dark metal backers behind each stroke */}
      <Box size={[stemW + 0.3, letterH + 0.3, 0.15]} position={[-halfSpan, y0, -0.5]} material={m.darkMetal} />
      <Box size={[stemW + 0.3, letterH + 0.3, 0.15]} position={[halfSpan, y0, -0.5]} material={m.darkMetal} />
      <Box size={[stemW + 0.3, diagLen, 0.15]} position={[0, y0, -0.5]} rotation={[0, 0, -diagAngle]} material={m.darkMetal} />

      {/* LED strokes: two stems and the rising diagonal */}
      <Box size={[stemW, letterH, letterD]} position={[-halfSpan, y0, 0]} material={m.accent} />
      <Box size={[stemW, letterH, letterD]} position={[halfSpan, y0, 0]} material={m.accent} />
      <Box size={[stemW, diagLen, letterD]} position={[0, y0, 0]} rotation={[0, 0, -diagAngle]} material={m.accent} />

      <pointLight position={[0, plinthH + 3.5, 1.2]} color={m.accentHex} intensity={70 * m.ledIntensity} distance={22} decay={2} />
      <pointLight position={[0, plinthH + 3.5, -1.4]} color={m.accentHex} intensity={40 * m.ledIntensity} distance={18} decay={2} />
    </group>
  );
}
