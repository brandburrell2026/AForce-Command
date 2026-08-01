/**
 * TodayQuote — compact contextual quote card on the home screen.
 *
 * Reads the live performance level, social-mode flag, last-intake time
 * and streak from the store, derives a QuoteContext, and renders the
 * single quote selected by `quoteEngine.selectQuote`.
 *
 * Tapping the card opens the native share sheet with the quote text —
 * the highest-friction-removed path to social sharing (the explicit
 * goal of the quote system brief).
 */

import React from 'react';
import { Pressable, Share, StyleSheet, Text, View, Platform } from 'react-native';

import { Colors } from '@/theme/colors';
import { Typography } from '@/theme/typography';
import { Spacing, Radii } from '@/theme/spacing';
import { useAppStore } from '@/store/useAppStore';
import { selectQuote, buildQuoteContext } from '@/services/quoteEngine';
import type { QuoteType } from '@/types/quote';

/**
 * Map QuoteType → tiny eyebrow label + accent dot color. Keeps the
 * card visually consistent with the AForce performance state palette.
 */
const TYPE_META: Record<QuoteType, { label: string; dot: string }> = {
  command:  { label: 'COMMAND',     dot: Colors.states.PEAK.primary },
  result:   { label: 'RESULT',      dot: Colors.states.BALANCED.primary },
  identity: { label: 'IDENTITY',    dot: Colors.states.PEAK.primary },
  product:  { label: 'AFORCE',      dot: Colors.text.muted },
  social:   { label: 'NIGHT OUT', dot: Colors.states.RECOVERING.primary },
};

function TodayQuoteImpl() {
  const { state } = useAppStore();
  const { engineOutput, userState } = state;

  // Derive the context once per relevant input. We don't include `now`
  // in deps so the quote is stable for the lifetime of the mount; it
  // refreshes naturally when the store fires (intake logged, social
  // toggled, level changes).
  const level = engineOutput.performanceState.level;
  const socialActive = Boolean(userState.socialMode?.active);
  const lastIntakeTime = userState.lastIntakeTime;
  const streakDays = userState.complianceStreak ?? 0;
  const quote = React.useMemo(() => {
    const ctx = buildQuoteContext({
      level,
      socialModeActive: socialActive,
      lastIntakeTime,
      streakDays,
    });
    return selectQuote(ctx);
  }, [level, socialActive, lastIntakeTime, streakDays]);

  const meta = TYPE_META[quote.type];

  const onShare = React.useCallback(async () => {
    try {
      // Lazy haptic feedback on native; web silently no-ops.
      if (Platform.OS !== 'web') {
        const haptics = await import('expo-haptics');
        haptics.selectionAsync().catch(() => {});
      }
      await Share.share({ message: `${quote.text} — AForce` });
    } catch {
      // Share dismissed / no provider — silent. Failing share is a
      // non-event from the user's perspective.
    }
  }, [quote.text]);

  return (
    <Pressable
      onPress={onShare}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${quote.text}. Tap to share.`}
      android_ripple={{ color: Colors.border.subtle, borderless: false }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      testID="today-quote-card"
    >
      <View style={styles.eyebrowRow}>
        <View style={[styles.dot, { backgroundColor: meta.dot }]} />
        <Text style={styles.eyebrow} numberOfLines={1}>{meta.label}</Text>
        <Text style={styles.shareHint}>TAP TO SHARE</Text>
      </View>
      <Text style={styles.quote} numberOfLines={2} testID="today-quote-text">
        {quote.text}
      </Text>
    </Pressable>
  );
}

export const TodayQuote = React.memo(TodayQuoteImpl);
TodayQuote.displayName = 'TodayQuote';

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: Radii.xl,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginHorizontal: Spacing[4],
    marginTop: Spacing[2],
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    marginBottom: Spacing[1],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eyebrow: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    flexGrow: 1,
  },
  shareHint: {
    color: Colors.text.muted,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '600',
    opacity: 0.7,
  },
  quote: {
    color: Colors.text.primary,
    fontSize: 19,
    fontFamily: Typography.fonts.bold,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
