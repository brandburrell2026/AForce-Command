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
 *
 * HOME HIERARCHY PASS (founder §1, 2026-08-13) — the verb is now OPTIONAL and
 * the whole line may render NOTHING. Home's hierarchy is HYDROSTATE score →
 * band → evidence confidence → command → action, and a verb rendered under
 * that stack was competing for the band's job: at DEPLETED, `getStatusVerb`
 * collapses two of three trend directions onto CRITICAL, so a member saw the
 * band word restated louder, in red, immediately beneath it — and saw it on
 * FIRST PAINT, because `useScoreTrend` initialises to 'flat' and therefore had
 * no delta to justify the verdict. The mapping in `services/statusVerb.ts` is
 * unchanged (other consumers and its tests still see the full verb set); this
 * component simply stops requiring a verb, and stops rendering a bare arrow
 * when there is neither a verb nor a measurement window to show.
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
  /**
   * The status verb — OPTIONAL since the Home hierarchy pass (founder §1,
   * 2026-08-13). `undefined` means "there is no verdict to draw here", NOT
   * "the caller forgot it": Home withholds the verb when `getStatusVerb`
   * would return DEPLETED's CRITICAL (a second, louder lexicalisation of the
   * band word the hero already prints, ~8-24pt above it), and when the trend
   * has no direction to report at all. `services/statusVerb.ts` is untouched —
   * every other consumer still gets the full verb set, and `VERB_KEY` below
   * still resolves CRITICAL, so the copy and the mapping stay in place.
   */
  verb?: StatusVerb;
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
  const verbLabel = verb ? t(VERB_KEY[verb]) : null;

  // NOTHING TO SAY IS A VALID STATE (founder §1). With no window AND no verb
  // the row would be a lone arrow glyph — a mark with no reading behind it,
  // occupying a line directly under the hero. The line is momentum, so when
  // there is no momentum to report it takes up no space at all rather than
  // holding the slot with punctuation.
  if (!showWindow && !verbLabel) return null;

  // Composed once and reused for the spoken label, so a screen reader hears
  // exactly the strings on screen (and so the two can never drift apart).
  const deltaText = `${delta > 0 ? '+' : ''}${delta} ${t('home.live_status.pts_suffix')}`;
  const windowText = `${t('home.live_status.last_label')} ${formatAge(ageSec)}`;

  return (
    <View
      style={styles.row}
      testID={testID}
      accessibilityLabel={
        // With a verb, the established "Trend VERB" phrasing. Without one there
        // is no verdict to announce, so the label carries the measurement the
        // line is actually showing instead of announcing an empty "Trend".
        verbLabel
          ? t('home.live_status.a11y_label', { verb: verbLabel })
          : `${deltaText} ${windowText}`
      }
    >
      <Text style={[styles.arrow, { color: accent }]}>{ARROW[direction]}</Text>
      {showWindow ? (
        <>
          <Text style={[styles.delta, { color: accent }]}>{deltaText}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.window}>{windowText}</Text>
          {verbLabel ? <Text style={styles.dot}>·</Text> : null}
        </>
      ) : null}
      {verbLabel ? <Text style={[styles.verb, { color: accent }]}>{verbLabel}</Text> : null}
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
