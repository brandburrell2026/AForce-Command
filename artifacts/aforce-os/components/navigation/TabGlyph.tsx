/**
 * TabGlyph — the bottom-bar icons, drawn as the approved prototype draws
 * them: 18pt, 1.4pt stroke, no fill. The Hydration tab has no icon (founder
 * direction, 2026-11-22: no water icon); its label stands alone.
 *
 *   home       a ring with a centre dot
 *   moments    three lines, each shorter than the last
 *   circles    two overlapping rings
 *
 * The same drawing is used on iPhone and Android, so the bar looks the same
 * on both. The active tab is shown by colour and by the 2pt mark above it.
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabGlyphName = 'home' | 'moments' | 'circles';

export const TAB_GLYPH_SIZE = 18;
const STROKE = 1.4;

export function TabGlyph({ name, color }: { name: TabGlyphName; color: string }) {
  return (
    <Svg width={TAB_GLYPH_SIZE} height={TAB_GLYPH_SIZE} viewBox="0 0 18 18" fill="none">
      {name === 'home' ? (
        <>
          <Circle cx={9} cy={9} r={7} stroke={color} strokeWidth={STROKE} />
          <Circle cx={9} cy={9} r={1.5} fill={color} />
        </>
      ) : null}
      {name === 'moments' ? <Path d="M3 5h12M3 9h9M3 13h6" stroke={color} strokeWidth={STROKE} /> : null}
      {name === 'circles' ? (
        <>
          <Circle cx={6.5} cy={9} r={4} stroke={color} strokeWidth={STROKE} />
          <Circle cx={11.5} cy={9} r={4} stroke={color} strokeWidth={STROKE} />
        </>
      ) : null}
    </Svg>
  );
}
