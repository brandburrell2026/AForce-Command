/**
 * Travel Intelligence 2.0 — journey view (T3).
 *
 * Presentational only: renders a JourneyView (utils/travel/journeyPresentation)
 * at the top of the existing Travel Intelligence screen. No new route or tab.
 *
 * Atmosphere: a licensed city photo when the registry has one (none yet),
 * otherwise the type-only treatment — a daypart tone with the city name. No
 * invented skylines. The arrival reveal fades in once, and not at all when
 * the device asks for reduced motion. Red is used only for LOCK-IN.
 */
import React from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { af, afLayout, afType } from '@/theme/afTokens';
import { travelTone } from '@/theme/travelTokens';
import type { JourneyView } from '@/utils/travel/journeyPresentation';

export interface TravelJourneyActions {
  busy: boolean;
  onConfirmArrival: () => void;
  onUndoArrival: () => void;
  onReady: () => void;
  onOpenPlan: (momentId: string) => void;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = React.useState(true);
  React.useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (live) setReduce(!!v); })
      .catch(() => { if (live) setReduce(true); });
    return () => { live = false; };
  }, []);
  return reduce;
}

function Action({ label, onPress, busy, primary }: { label: string; onPress: () => void; busy: boolean; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={[primary ? styles.primary : styles.secondary, busy && { opacity: 0.5 }]}
    >
      <Text style={primary ? styles.primaryText : styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function TravelJourneyView({ view, actions }: { view: JourneyView; actions: TravelJourneyActions }) {
  const reduceMotion = useReduceMotion();
  const opacity = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (view.kind !== 'arrival' || reduceMotion) { opacity.setValue(1); return; }
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [view.kind, view.tripId, reduceMotion, opacity]);

  const lockIn = view.kind === 'lock_in';
  const photoNote = view.atmosphere.kind === 'photo' ? null : 'City photography coming · type-only view';

  return (
    <Animated.View testID={`travel-journey-${view.kind}`} style={[styles.wrap, { opacity }]}>
      <View style={[styles.hero, { backgroundColor: lockIn ? travelTone.night : view.tone }]} accessibilityRole="header">
        <Text style={styles.eyebrow}>{view.eyebrow.toUpperCase()}</Text>
        <Text
          style={[styles.headline, lockIn && styles.lockIn]}
          accessibilityLabel={lockIn ? 'LOCK-IN' : view.headline}
        >
          {view.headline}
        </Text>
        <Text style={styles.subline}>{view.subline}</Text>
        {photoNote ? <Text style={styles.note}>{photoNote}</Text> : null}
      </View>

      {view.needsReview ? (
        <Text accessibilityRole="alert" style={styles.review}>
          Your airline reported a cancellation or diversion. Review your trip below before relying on these times.
        </Text>
      ) : null}

      {view.progress != null ? (
        <View style={styles.progressWrap}>
          <View style={styles.track} accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(view.progress * 100) }}>
            <View style={[styles.fill, { width: `${Math.round(view.progress * 100)}%` }]} />
          </View>
          {view.progressCaption ? <Text style={styles.caption}>{view.progressCaption}</Text> : null}
        </View>
      ) : null}

      <View style={styles.card}>
        {view.rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i > 0 && styles.rowRule]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{row.value}</Text>
              <Text style={styles.rowSource}>{row.source}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {view.kind === 'lock_in' ? (
          <Action primary label="I’ve landed" onPress={actions.onConfirmArrival} busy={actions.busy} />
        ) : null}
        {view.kind === 'arrival' && view.arrivalMomentId ? (
          <Action primary label={`Plan your ${view.cityName} arrival`} onPress={() => actions.onOpenPlan(view.arrivalMomentId!)} busy={actions.busy} />
        ) : null}
        {view.kind === 'arrival' ? <Action label="I’m ready" onPress={actions.onReady} busy={actions.busy} /> : null}
        {view.kind === 'arrival' && view.state.arrivalSource === 'member' ? (
          <Action label="I haven’t landed yet" onPress={actions.onUndoArrival} busy={actions.busy} />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: afLayout.cardGap, marginVertical: 16 },
  hero: { borderRadius: afLayout.radiusHero, minHeight: 240, padding: afLayout.cardPaddingLarge, justifyContent: 'flex-end', gap: 8 },
  eyebrow: { ...afType.eyebrow, color: af.textSecondary },
  headline: { ...afType.displayHero, color: af.textPrimary },
  lockIn: { color: af.redText },
  subline: { ...afType.body, color: af.textPrimary },
  note: { ...afType.caption, color: af.textSecondary },
  review: { ...afType.secondary, color: af.textPrimary, borderWidth: afLayout.hairline, borderColor: af.borderAlert, borderRadius: afLayout.radiusCard, padding: afLayout.cardPadding },
  progressWrap: { gap: 8 },
  track: { height: 3, borderRadius: 3, backgroundColor: af.surfacePressed, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: af.textPrimary },
  caption: { ...afType.caption, color: af.textSecondary },
  card: { backgroundColor: af.surface, borderWidth: afLayout.hairline, borderColor: af.border, borderRadius: afLayout.radiusCard, paddingHorizontal: afLayout.cardPadding },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 14, gap: 12 },
  rowRule: { borderTopWidth: afLayout.hairline, borderTopColor: af.divider },
  rowLabel: { ...afType.secondary, color: af.textSecondary, flexShrink: 0 },
  rowRight: { alignItems: 'flex-end', flexShrink: 1 },
  rowValue: { ...afType.bodyStrong, color: af.textPrimary, textAlign: 'right' },
  rowSource: { ...afType.caption, color: af.textSecondary, textAlign: 'right' },
  actions: { gap: 10 },
  primary: { minHeight: afLayout.buttonHeight, borderRadius: afLayout.radiusPill, backgroundColor: af.textPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryText: { ...afType.bodyStrong, color: af.canvas },
  secondary: { minHeight: afLayout.buttonHeight, borderRadius: afLayout.radiusPill, borderWidth: afLayout.hairline, borderColor: af.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondaryText: { ...afType.bodyStrong, color: af.textPrimary },
});
