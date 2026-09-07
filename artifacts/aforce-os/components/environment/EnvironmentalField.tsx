/**
 * THE FIELD — the environment rendered as atmosphere.
 *
 * The founder's principle: the environment carries the meaning; typography
 * explains it. So this component does the explaining's opposite — it says
 * nothing and shows everything, and the screen above it stays quiet.
 *
 * ── HONEST BY CONSTRUCTION ─────────────────────────────────────────────────
 *
 * Layered gradients only. No photography, no illustrated sun/cloud/rain, no
 * particle weather. Every one of those would imply evidence we do not hold —
 * a drawn cloud is a claim about the sky. Density, light direction, horizon
 * height and vignette carry the state instead, and none of them asserts a fact
 * about the world beyond the state the interpretation already proved.
 *
 * ── THE AFORCE SIGNATURE ───────────────────────────────────────────────────
 *
 * The brand mark is the N–И monogram: a letterform and its mirror, divided by
 * a Signal Red seam. That geometry is expressed here as LIGHT rather than as a
 * logo — two mirrored luminance planes converging on a vertical axis, with a
 * single red hairline at the meeting point. No watermark, nothing to read; the
 * field simply has a spine, and the spine is the mark's logic.
 *
 * It is most legible in CLEAR (an open field is where structure reads) and
 * compresses as the states intensify, so the signature is a constant without
 * ever becoming decoration.
 */
import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { EnvironmentalState } from '@/utils/environment/environmentalInterpretation';
import { af, withAlpha } from '@/theme';
import { ATMOSPHERE } from '@/utils/environment/environmentalAtmosphere';

export interface EnvironmentalFieldProps {
  readonly state: EnvironmentalState;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/**
 * Purely decorative in the accessibility tree: the STATE is announced by the
 * screen's own text. A field that also announced itself would make VoiceOver
 * read the weather twice.
 */
export function EnvironmentalField({ state, style, testID }: EnvironmentalFieldProps) {
  const a = ATMOSPHERE[state];

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID ?? `environmental-field-${state}`}
    >
      {/* Base plane */}
      <LinearGradient
        colors={[a.base[0], a.base[1], a.base[2]]}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* The horizon — where the state's light gathers. */}
      <LinearGradient
        colors={['transparent', a.glow, 'transparent']}
        locations={[
          Math.max(0, a.horizon - 0.46),
          Math.min(1, a.horizon),
          1,
        ]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── THE AFORCE SEAM ────────────────────────────────────────────────
          Two mirrored luminance planes meeting on a vertical axis, and a
          single Signal Red hairline at the meeting point. The N–И monogram's
          geometry as light: a form, its mirror, and the divider between. */}
      <View style={styles.seamWrap} pointerEvents="none">
        <LinearGradient
          colors={['transparent', withAlpha(af.textPrimary, a.seam * 0.22)]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.seamLeft}
        />
        {/* The mirror. Same gradient, reflected — `scaleX(-1)` is literally how
            the brand mark builds its second N. */}
        <LinearGradient
          colors={['transparent', withAlpha(af.textPrimary, a.seam * 0.22)]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={[styles.seamRight, { transform: [{ scaleX: -1 }] }]}
        />
        <LinearGradient
          colors={['transparent', withAlpha(af.red, a.seam), 'transparent']}
          locations={[0.12, 0.55, 1]}
          style={styles.seamLine}
        />
      </View>

      {/* INSUFFICIENT: definition falls away rather than colour arriving. */}
      {a.unresolved ? (
        <LinearGradient
          colors={[withAlpha(af.canvas, 0), withAlpha(af.canvas, 0.55), withAlpha(af.canvas, 0.86)]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Vignette — the frame closing in as concern rises. */}
      {a.vignette > 0 ? (
        <LinearGradient
          colors={[
            // The vignette is the app's own ground closing in, so it darkens
            // toward `af.canvas` rather than an off-palette black.
            withAlpha(af.canvas, a.vignette),
            'transparent',
            withAlpha(af.canvas, Math.min(1, a.vignette * 1.4)),
          ]}
          locations={[0, 0.42, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seamWrap: { ...StyleSheet.absoluteFillObject },
  // The two planes meet just off-centre, the way the monogram's counters do.
  seamLeft: { position: 'absolute', left: 0, top: '18%', bottom: 0, width: '50%' },
  seamRight: { position: 'absolute', right: 0, top: '18%', bottom: 0, width: '50%' },
  seamLine: { position: 'absolute', left: '50%', top: '22%', bottom: '6%', width: 1 },
});
