/**
 * ActivationJourneyCard — presentational consumer surface for the
 * QR-activation Day-7 offer + personal activation milestones on Home.
 *
 * Pure / presentational: it renders whatever journey view-model it is handed
 * (see useActivationJourney) and reads no store. Score-Protection: nothing
 * here awards or mutates score — it only projects two on-device milestones
 * and the pure Day-7 countdown.
 *
 * Accent: the card's tint is handed in (`accentPrimary` / `accentGlow`) so it
 * tracks the live hydration/readiness band exactly like the orb — the Zone
 * derives it from `useDisplayedAccent()` (with an `accentForScore` fallback),
 * so the eyebrow, step dots, countdown, and CTA recolour on the same frame the
 * score the user sees changes. This is display-only: the colour follows score,
 * it never moves score.
 *
 * Phases:
 *   • unanchored → encourage the first command (the habit loop start).
 *   • pending    → counts down to the offer opening.
 *   • open       → live countdown + a "see plans" CTA.
 *   • expired    → a positive "fully activated" close, never a downer.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme/colors';
import type { ActivationJourneyVM } from '@/hooks/useActivationJourney';

/** Convert a 6-digit hex (the band `primary`) into a translucent rgba fill. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props extends ActivationJourneyVM {
  /** Routes the user to the subscription plans. */
  onSeePlans: () => void;
  /** Score-band accent (matches the orb): solid tint for text/dots/fills. */
  accentPrimary: string;
  /** Score-band glow (translucent) for hairline borders. */
  accentGlow: string;
}

function StepDot({
  label,
  done,
  active,
  accent,
}: {
  label: string;
  done: boolean;
  active?: boolean;
  accent: string;
}) {
  const tint = done || active ? accent : Colors.text.muted;
  return (
    <View style={styles.step}>
      <View
        style={[
          styles.dot,
          { borderColor: tint },
          done ? { backgroundColor: accent } : null,
          active && !done ? { backgroundColor: withAlpha(accent, 0.1) } : null,
        ]}
      />
      <Text style={[styles.stepLabel, { color: tint }]}>{label}</Text>
    </View>
  );
}

export function ActivationJourneyCard({
  anchored,
  onboarded,
  offer,
  countdown,
  onSeePlans,
  accentPrimary,
  accentGlow,
}: Props) {
  const { t } = useTranslation();

  const offerReached = offer.phase === 'open' || offer.phase === 'expired';
  // The 72h claim window is at most 3 days, so fold days into hours for a
  // simple "Xh Ym left" read-out.
  const openHours = countdown.days * 24 + countdown.hours;

  return (
    <View style={styles.card} testID="home-activation-card">
      <Text style={[styles.eyebrow, { color: accentPrimary }]}>
        {t('activationJourney.eyebrow')}
      </Text>

      <View style={styles.steps}>
        <StepDot
          label={t('activationJourney.steps.setup')}
          done={onboarded}
          accent={accentPrimary}
        />
        <View style={styles.connector} />
        <StepDot
          label={t('activationJourney.steps.firstCommand')}
          done={anchored}
          accent={accentPrimary}
        />
        <View style={styles.connector} />
        <StepDot
          label={t('activationJourney.steps.offer')}
          done={offerReached}
          active={offer.phase === 'open'}
          accent={accentPrimary}
        />
      </View>

      {offer.phase === 'unanchored' ? (
        <View testID="home-activation-unanchored">
          <Text style={styles.title}>{t('activationJourney.unanchored.title')}</Text>
          <Text style={styles.body}>{t('activationJourney.unanchored.body')}</Text>
        </View>
      ) : null}

      {offer.phase === 'pending' ? (
        <View testID="home-activation-pending">
          <Text style={styles.title}>{t('activationJourney.pending.title')}</Text>
          <Text style={styles.countdown}>
            {t('activationJourney.pending.countdown', {
              days: countdown.days,
              hours: countdown.hours,
            })}
          </Text>
        </View>
      ) : null}

      {offer.phase === 'open' ? (
        <View testID="home-activation-open">
          <Text style={styles.title}>{t('activationJourney.open.title')}</Text>
          <Text style={[styles.countdown, { color: accentPrimary }]}>
            {t('activationJourney.open.countdown', {
              hours: openHours,
              minutes: countdown.minutes,
            })}
          </Text>
          <TouchableOpacity
            onPress={onSeePlans}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('activationJourney.open.cta')}
            testID="home-activation-cta"
            style={[
              styles.cta,
              { borderColor: accentGlow, backgroundColor: withAlpha(accentPrimary, 0.06) },
            ]}
          >
            <Text style={[styles.ctaText, { color: accentPrimary }]}>
              {t('activationJourney.open.cta')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {offer.phase === 'expired' ? (
        <View testID="home-activation-expired">
          <Text style={styles.title}>{t('activationJourney.expired.title')}</Text>
          <Text style={styles.body}>{t('activationJourney.expired.body')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 16,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  step: { alignItems: 'center', gap: 6 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  connector: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 6,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    letterSpacing: -0.2,
    color: Colors.text.primary,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: Colors.text.secondary,
    marginTop: 6,
  },
  countdown: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 0.4,
    color: Colors.text.secondary,
    marginTop: 6,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
