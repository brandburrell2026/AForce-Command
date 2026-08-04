/**
 * RiskTimerDisplay — Live countdown showing urgency and time to next action.
 */

import React from 'react';
import { View, Text, StyleSheet, AccessibilityInfo, Platform } from 'react-native';
import type { PerformanceState } from '../types';
import { Colors } from '../theme/colors';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

interface Props {
  timerSeconds: number;
  performanceState: PerformanceState;
}

export function RiskTimerDisplay({ timerSeconds, performanceState }: Props) {
  const { color, level } = performanceState;

  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const urgencyLabels: Record<string, string> = {
    PEAK: 'NEXT CHECK',
    BALANCED: 'ACT WITHIN',
    RECOVERING: 'TIME REMAINING',
    DEPLETED: 'CRITICAL — ACT NOW',
  };

  const isUrgent = level === 'DEPLETED' || (level === 'RECOVERING' && minutes < 5);

  // RC-1 fix (P0 a11y, safety surface): this countdown had no accessible
  // grouping at all — a screen reader read the label, the digits, and the
  // "URGENT" badge as three disconnected fragments, and a live countdown
  // updating every second was never announced. Composed label + a polite
  // live region on the group (not assertive — a per-second announcement
  // would be unusable) let a screen-reader user hear the current state
  // without altering the visible timer logic or copy below.
  const timerLabel = urgencyLabels[level] ?? 'NEXT CHECK';
  const composedLabel = isUrgent
    ? `${timerLabel}. ${display}. URGENT.`
    : `${timerLabel}. ${display}.`;

  // RC-1 verdict-pass follow-up: `accessibilityLiveRegion` is Android-only
  // (RN's own docs mark it `@platform android` — VoiceOver on iOS never
  // reads it, so this safety-adjacent countdown was silent for iOS
  // screen-reader users the whole time). Android's polite live region is
  // left exactly as-is above; this adds the iOS equivalent via
  // `AccessibilityInfo.announceForAccessibility`, fired ONLY when the
  // display crosses one of the component's existing urgency thresholds —
  // never per second, which the comment above already established would be
  // unusable. Those thresholds are the four `level` bands (PEAK / BALANCED /
  // RECOVERING / DEPLETED) and the `isUrgent` boundary computed above
  // (DEPLETED, or RECOVERING with < 5 minutes left) — both captured in
  // `transitionKey` so a re-render that only changes `display` (i.e. every
  // second) does not re-trigger the effect at all.
  const transitionKey = `${level}:${isUrgent}`;
  const hasMountedRef = React.useRef(false);
  const lastAnnouncedKeyRef = React.useRef<string | null>(null);
  // Ref (not a dep) so the effect below only re-runs when `transitionKey`
  // changes — i.e. on an urgency-band crossing — never on the per-second
  // `display` tick that also changes `composedLabel`.
  const composedLabelRef = React.useRef(composedLabel);
  composedLabelRef.current = composedLabel;

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!hasMountedRef.current) {
      // Don't announce on first mount — VoiceOver already reads the
      // composed accessibilityLabel when focus lands on the group; an
      // extra announce here would double-speak the initial state.
      hasMountedRef.current = true;
      lastAnnouncedKeyRef.current = transitionKey;
      return;
    }
    if (lastAnnouncedKeyRef.current === transitionKey) return;
    lastAnnouncedKeyRef.current = transitionKey;
    AccessibilityInfo.announceForAccessibility(composedLabelRef.current);
  }, [transitionKey]);

  return (
    <View
      style={[styles.container, { borderColor: `${color}22` }]}
      accessible
      accessibilityLabel={composedLabel}
      accessibilityLiveRegion="polite"
      testID="risk-timer-display"
    >
      <Text style={[styles.label, { color: Colors.text.muted }]}>
        {urgencyLabels[level] ?? 'NEXT CHECK'}
      </Text>
      <Text
        style={[
          styles.timerText,
          { color: isUrgent ? color : Colors.text.primary },
        ]}
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
      >
        {display}
      </Text>
      {isUrgent && (
        <View style={[styles.urgentBadge, { backgroundColor: `${color}20`, borderColor: `${color}44` }]}>
          <Text style={[styles.urgentText, { color }]}>URGENT</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: Colors.background.card,
    marginHorizontal: 20,
  },
  label: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  timerText: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  urgentBadge: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  urgentText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
});
