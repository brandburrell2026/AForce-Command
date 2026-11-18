/**
 * AFMark — the AFORCE N–И mark. The only way the mark is drawn in the app.
 *
 * Construction (Codex Master Brief, 2026-11-05, §2): Inter 300, a second N
 * that is the first one MIRRORED (not the Cyrillic letter И typed as text),
 * and a connecting bar 0.4em wide and 0.056em tall. "Build it as a component,
 * never as a typed string."
 *
 * Colour: Signal Red on black; warm white inside an orb. Signal Red is the
 * default because that is the mark standing on its own.
 *
 * The mirror is applied to a View that wraps the letter, not to the Text
 * itself, so it does not depend on text transforms being honoured natively.
 *
 * Accessibility: by default it is one element named "AFORCE". Pass
 * `decorative` where a parent already names the control (the tab-bar orb is
 * announced as "One Breath"), so the mark is not read a second time.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { af } from '@/theme';

/** Bar width and height as a fraction of the letter size (Master Brief §2). */
export const AF_MARK_BAR_WIDTH_EM = 0.4;
export const AF_MARK_BAR_HEIGHT_EM = 0.056;
/** The mark's only typeface. */
export const AF_MARK_FONT = 'Inter_300Light';

export interface AFMarkProps {
  /** Letter size in points. */
  size?: number;
  /** Signal Red on black (default); pass warm white inside an orb. */
  color?: string;
  /** Hide from the screen reader when a parent already names the control. */
  decorative?: boolean;
  testID?: string;
}

export function AFMark({ size = 34, color = af.red, decorative = false, testID }: AFMarkProps) {
  const letter = {
    fontFamily: AF_MARK_FONT,
    fontSize: size,
    lineHeight: size,
    color,
  } as const;
  const a11y = decorative
    ? ({ accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityLabel: 'AFORCE' } as const);
  return (
    <View {...a11y} style={styles.row} testID={testID}>
      <Text style={letter}>
        N
      </Text>
      <View
        style={{
          width: size * AF_MARK_BAR_WIDTH_EM,
          height: size * AF_MARK_BAR_HEIGHT_EM,
          backgroundColor: color,
          marginHorizontal: size * 0.05,
          transform: [{ translateY: -size * 0.015 }],
        }}
      />
      <View style={styles.mirror}>
        <Text style={letter}>
          N
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  mirror: { transform: [{ scaleX: -1 }] },
});
