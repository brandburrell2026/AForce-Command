/**
 * TabGlyph — the four bottom-bar icons, drawn exactly as the approved
 * prototype draws them: 18pt, 1.4pt stroke, no fill.
 *
 *   home       a ring with a centre dot
 *   hydration  an outline drop
 *   moments    three lines, each shorter than the last
 *   circles    two overlapping rings
 *
 * The same drawing is used on iPhone and Android, so the bar looks the same
 * on both. The active tab is shown by colour and by the 2pt mark above it.
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabGlyphName = 'home' | 'hydration' | 'moments' | 'circles';

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
      {name === 'hydration' ? (
        <Path
          d="M9 2.5c2.6 3.3 4.5 5.6 4.5 8.1a4.5 4.5 0 0 1-9 0C4.5 8.1 6.4 5.8 9 2.5z"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
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
