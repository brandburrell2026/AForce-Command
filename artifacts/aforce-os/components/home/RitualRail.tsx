/**
 * RitualRail — the AForce daily ritual rendered as a 4-node rail:
 *   PAUSE → HYDRATE → LOCK IN → PERFORM
 *
 * Each node only lights up from *completed* behaviour (see
 * `deriveRitualSteps` in utils/homeDashboard — the score-protection
 * contract lives there). The first incomplete step gets a softly
 * pulsing brand-red halo marking the user's current focus. The pulse
 * respects the OS "reduce motion" setting via ReduceMotion.System.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import type { RitualStepView } from '@/utils/homeDashboard';

const BRAND = Colors.accent.brand;

interface Props {
  steps: RitualStepView[];
}

export function RitualRail({ steps }: Props) {
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 1600,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.4,
    transform: [{ scale: 1 + pulse.value * 0.25 }],
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>DAILY RITUAL</Text>
      <View style={styles.rail}>
        {steps.map((s, i) => {
          const prevComplete = i > 0 && !!steps[i - 1]?.complete;
          const last = i === steps.length - 1;
          return (
            <View key={s.id} style={styles.col}>
              {i > 0 && (
                <View
                  style={[styles.conn, styles.connLeft, prevComplete && styles.connOn]}
                />
              )}
              {!last && (
                <View
                  style={[styles.conn, styles.connRight, s.complete && styles.connOn]}
                />
              )}
              <View style={styles.dotWrap}>
                {s.active && <Animated.View style={[styles.halo, haloStyle]} />}
                <View
                  style={[
                    styles.dot,
                    s.complete && styles.dotFilled,
                    s.active && styles.dotActive,
                  ]}
                >
                  {s.complete ? (
                    <Icon name="check" size={13} color="#000000" />
                  ) : (
                    <Text style={[styles.dotNum, s.active && { color: BRAND }]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, (s.complete || s.active) && styles.labelOn]}
              >
                {s.label}
              </Text>
              <Text numberOfLines={1} style={styles.caption}>
                {s.caption}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const DOT = 34;
const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    color: BRAND,
    marginBottom: 4,
  },
  rail: { flexDirection: 'row', marginTop: 14 },
  col: { flex: 1, alignItems: 'center', position: 'relative' },
  conn: {
    position: 'absolute',
    top: DOT / 2 - 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  connLeft: { left: 0, right: '50%' },
  connRight: { left: '50%', right: 0 },
  connOn: { backgroundColor: BRAND },
  dotWrap: {
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  halo: {
    position: 'absolute',
    width: DOT + 14,
    height: DOT + 14,
    borderRadius: (DOT + 14) / 2,
    top: -7,
    left: -7,
    backgroundColor: Colors.accent.brandGlow,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: '#0A0A0C',
  },
  dotFilled: { backgroundColor: BRAND, borderColor: BRAND },
  dotActive: { borderColor: BRAND },
  dotNum: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.text.muted,
  },
  label: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: Colors.text.muted,
  },
  labelOn: { color: Colors.text.primary },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: Colors.text.muted,
    marginTop: 2,
  },
});
