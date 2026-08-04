/**
 * LiveStatusLine — `▲ +N pts · LAST Ns · VERB` strip rendered between
 * the orb's status label and the consequence line.
 *
 * Purely presentational. All inputs come from the `useScoreTrend` hook
 * and the pure `getStatusVerb` mapping in `services/statusVerb.ts`.
 *
 * RC-1 verdict-pass follow-up (Wave-1 r2, item 5): migrated off the
 * hardcoded `Colors`/raw-rgba/`Inter_*` literal styling onto `af.*`/`afType`
 * tokens, and off hardcoded English copy onto `home.live_status.*` i18n
 * keys — `getStatusVerb` stays a pure, dependency-free enum mapping (no
 * `t()` inside it); this component is the one presentational consumer that
 * resolves the enum to display copy, mirroring the established
 * resolver-returns-enum / component-resolves-i18n pattern (see
 * `docs/health/TRANSLATION-REVIEW.md`).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TrendDirection } from '../../hooks/useScoreTrend';
import type { StatusVerb } from '../../services/statusVerb';
import { af, afType } from '../../theme';

interface Props {
  direction: TrendDirection;
  delta: number;
  ageSec: number;
  verb: StatusVerb;
  /** Tint that drives arrow + verb color (matches orb accent). */
  accent: string;
  testID?: string;
}

const ARROW: Record<TrendDirection, string> = {
  rising: '▲',
  falling: '▼',
  flat: '●',
};

// StatusVerb -> i18n key suffix under `home.live_status.verb_*`. A plain
// lookup table, not string transformation, so a future new StatusVerb value
// fails loudly (TS narrows the Record to the full union) instead of silently
// falling back to raw English.
const VERB_KEY: Record<StatusVerb, string> = {
  ASCENDING: 'home.live_status.verb_ascending',
  'LOCKED IN': 'home.live_status.verb_locked_in',
  HOLDING: 'home.live_status.verb_holding',
  DRIFTING: 'home.live_status.verb_drifting',
  DECLINING: 'home.live_status.verb_declining',
  RECOVERING: 'home.live_status.verb_recovering',
  CRITICAL: 'home.live_status.verb_critical',
};

function formatAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  return `${m}m`;
}

function LiveStatusLineImpl({ direction, delta, ageSec, verb, accent, testID }: Props) {
  const { t } = useTranslation();
  // For 'flat' / freshly-mounted (no window yet), show just the verb
  // so we don't render meaningless "+0 · 0s".
  const showWindow = direction !== 'flat' && ageSec >= 5;
  const verbLabel = t(VERB_KEY[verb]);

  return (
    <View
      style={styles.row}
      testID={testID}
      accessibilityLabel={t('home.live_status.a11y_label', { verb: verbLabel })}
    >
      <Text style={[styles.arrow, { color: accent }]}>{ARROW[direction]}</Text>
      {showWindow ? (
        <>
          <Text style={[styles.delta, { color: accent }]}>
            {delta > 0 ? '+' : ''}{delta} {t('home.live_status.pts_suffix')}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.window}>
            {t('home.live_status.last_label')} {formatAge(ageSec)}
          </Text>
          <Text style={styles.dot}>·</Text>
        </>
      ) : null}
      <Text style={[styles.verb, { color: accent }]}>{verbLabel}</Text>
    </View>
  );
}

export const LiveStatusLine = React.memo(LiveStatusLineImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
  },
  arrow: {
    ...afType.microLabel,
  },
  delta: {
    ...afType.microLabel,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  dot: {
    ...afType.microLabel,
    fontSize: 12,
    color: af.textTertiary,
  },
  window: {
    ...afType.tab,
    color: af.textSecondary,
    letterSpacing: 1.4,
  },
  verb: {
    ...afType.microLabel,
    letterSpacing: 2.2,
  },
});
