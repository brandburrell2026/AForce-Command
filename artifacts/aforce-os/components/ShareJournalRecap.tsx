/**
 * Share format: Performance Timeline Recap.
 *
 * Square (Instagram-grid) card that exports the user's actual journal
 * window — chart + summary stats — instead of the identity-headline
 * Card. Data comes from `journalShareCache`; if no payload is present
 * the component renders an empty placeholder (the format picker hides
 * the option in that case so this fallback is defensive).
 *
 * The chart uses the same SVG approach as `JournalChart` (bands +
 * polyline) but is sized for a fixed 1:1 export canvas so ViewShot
 * gets a deterministic snapshot regardless of device width.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors } from '@/theme/colors';
import type { JournalRollup } from '@/types';
import { computeRecapCardStats } from '@/utils/journalRecapStats';
import {
  buildRecapSegmentPaths, recapStatsScope, classifyRecapProvenance,
  classifyStreakEligibility,
} from '@/utils/scoring/boundarySeries';

/** Rendered wherever the card cannot support a number. */
const UNAVAILABLE = '—';


interface Props {
  rollups: readonly JournalRollup[];
  rangeDays: number;
}

const CARD_W = 360;
const CHART_W = CARD_W - 60;
const CHART_H = 110;
const PADDING = { top: 8, right: 4, bottom: 8, left: 4 };

const BANDS = [
  { from: 85, to: 100, color: 'rgba(180, 255, 80, 0.10)' },
  { from: 65, to: 85, color: 'rgba(0, 229, 200, 0.08)' },
  { from: 40, to: 65, color: 'rgba(255, 160, 30, 0.08)' },
  { from: 0, to: 40, color: 'rgba(255, 45, 85, 0.10)' },
];

export const ShareJournalRecap: React.FC<Props> = ({ rollups, rangeDays }) => {
  // An exported recap is the most durable artifact a member produces — it
  // outlives the app session and gets shared. It therefore carries the same
  // boundary guarantees as the in-app chart: no stroke across a recalibration,
  // and no headline average blended from two different measurements.
  // Headline statistics are scoped by the shipped decision function, not by an
  // inline predicate — an earlier inline version narrowed an all-unstamped
  // range to a single row and reported one day under a 30-day label.
  // TWO populations, deliberately. Score-derived tiles use only rows comparable
  // to the newest known model version; activity totals use the whole requested
  // range, so the "30-DAY TIMELINE" label stays true and a member's real
  // participation is never discarded because the scoring model changed.
  const statsScope = useMemo(() => recapStatsScope(rollups), [rollups]);
  // WHY the streak may be withheld — classified, never re-derived here.
  //
  // This line used to read `statsScope.length === rollups.length`: ONE boolean
  // standing in for two different questions, with the reporting range as the
  // denominator for both. `recapStatsScope` and `classifyRecapProvenance` had
  // already moved to the OBSERVED population, so the card held two answers
  // about the same array, and a single missed sync landed on whichever was
  // wrong — deleting a genuine 29-day streak in silence on a fully-stamped
  // month, or blaming "MODEL HISTORY UNAVAILABLE" on an unstamped one.
  //
  // The component now asks for the CAUSE and never computes a denominator.
  const streak = classifyStreakEligibility(rollups);

  // FOUR semantic states, never collapsed into one boolean (founder D3A):
  //   A no qualifier            every day proven comparable
  //   B N COMPARABLE DAY(S)     population narrowed — comparability WAS decided
  //   C NEW MODEL PERIOD        a real transition between known versions
  //   D MODEL HISTORY UNAVAILABLE  provenance could not be established at all
  // D must never wear A's silence or C's words: an unrecorded day is not
  // evidence that the model changed, and saying so would tell a member their
  // history crossed a recalibration that may never have happened.
  const provenance = classifyRecapProvenance(rollups);
  const stats = useMemo(
    () => computeRecapCardStats(rollups, statsScope, { streakEligible: streak.kind === 'eligible' }),
    [rollups, statsScope, streak.kind],
  );
  // D3 — a smaller scoring population may not be silent. Shown only when the
  // score figures actually describe fewer days than the label does.
  // WORDING TAXONOMY, locked (founder ruling 3). These four states may never
  // substitute for one another:
  //   no_history            -> no qualifier at all
  //   provenance_unknown    -> MODEL HISTORY UNAVAILABLE  (+ the count, ruling B)
  //   recorded_incompatible -> MODEL VERSIONS NOT COMPARABLE
  //   partially_comparable  -> N COMPARABLE DAY(S)
  const comparableDaysLabel = (n: number) =>
    `HYDROSTATE · ${n} COMPARABLE ${n === 1 ? 'DAY' : 'DAYS'}`;
  const qualifier =
    provenance.kind === 'partially_comparable'
      ? comparableDaysLabel(provenance.comparableDays)
      : provenance.kind === 'provenance_unknown'
        // Ruling B: never silently present an N-of-M population. The days that
        // survived are unrecorded, so they are NOT called "comparable" — the
        // count is disclosed alongside the honest unavailable wording.
        ? provenance.comparableDays < provenance.observedDays
          ? `HYDROSTATE · MODEL HISTORY UNAVAILABLE · ${provenance.comparableDays} OF ${provenance.observedDays} DAYS`
          : 'HYDROSTATE · MODEL HISTORY UNAVAILABLE'
        // Recorded, and recorded as incomparable — never "unavailable".
        : provenance.kind === 'recorded_incompatible'
          ? 'HYDROSTATE · MODEL VERSIONS NOT COMPARABLE'
          : null;
  // The MODEL half of the explanation. Only ever labelled a MODEL PERIOD when a
  // transition between two known versions is actually present; narrowing caused
  // by unrecorded provenance says "unavailable", not "new model".
  //
  // BRANCH ON `kind` FIRST (founder ruling §8, 2026-09-02). Testing
  // `knownTransition` before `kind` made the `recorded_incompatible` arm DEAD
  // CODE — that state is only ever returned WITH a known transition, so it
  // always matched the transition branch first. The card then printed
  // "MODEL VERSIONS NOT COMPARABLE" as its qualifier and "NEW MODEL PERIOD" as
  // its streak note: two different names for one state, on one export. A
  // transition is how we KNOW the versions are incomparable; it is not what to
  // call the state.
  const modelStreakNote =
    provenance.kind === 'no_history' || provenance.kind === 'fully_comparable'
      ? null
      : provenance.kind === 'recorded_incompatible'
        ? 'MODEL VERSIONS NOT COMPARABLE'
        // partially_comparable / provenance_unknown: a transition between two
        // KNOWN versions is the one thing we actually know happened, so it is
        // announced. Without one, the cause is provenance we never recorded.
        : provenance.knownTransition
          ? 'NEW MODEL PERIOD'
          : 'MODEL HISTORY UNAVAILABLE';
  // THREE CAUSES, THREE ANSWERS (founder ruling, 2026-09-02). A withheld streak
  // must never wear another cause's words, and must never be silent:
  //   coverage_incomplete -> N OF M DAYS MEASURED   (continuity unknowable)
  //   not_comparable      -> the model wording above (scores are not one metric)
  //   eligible/no_history -> nothing to explain
  //
  // "MEASURED" is the Editorial system's own word for "we have a reading"
  // (`EdNumber` splits measured from unmeasured ink; `editorialLogic` renders an
  // unmeasured value as the em-dash), so the preferred wording is carried by
  // existing vocabulary rather than introducing a new term.
  //
  // Coverage is named FIRST when both are true. It is the more primitive
  // failure — an unobserved day has no score to be incomparable — and blaming
  // the model for a missing snapshot is the specific harm this ruling closes.
  // No fact is lost: the provenance qualifier above still discloses the model
  // state independently, on its own line.
  const streakNote =
    streak.kind === 'eligible' || streak.kind === 'no_history'
      ? null
      : streak.kind === 'coverage_incomplete'
        ? `HYDROSTATE · ${streak.measuredDays} OF ${streak.rangeDays} DAYS MEASURED`
        : modelStreakNote;
  const innerW = CHART_W - PADDING.left - PADDING.right;
  const innerH = CHART_H - PADDING.top - PADDING.bottom;

  const pathDs = useMemo(
    () => buildRecapSegmentPaths(rollups, innerW, innerH, PADDING),
    [rollups, innerW, innerH],
  );

  const yFor = (score: number) => PADDING.top + (1 - score / 100) * innerH;

  return (
    <View style={styles.card} testID="share-journal-recap">
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.dot} />
          <Text style={styles.eyebrow}>AFORCE · {rangeDays}-DAY TIMELINE</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeText}>
            {stats.avgScore == null ? UNAVAILABLE : stats.avgScore}
          </Text>
        </View>
      </View>

      <View style={styles.chartWrap}>
        {rollups.length === 0 ? (
          <View style={[styles.emptyChart, { width: CHART_W, height: CHART_H }]}>
            <Text style={styles.emptyText}>No data yet</Text>
          </View>
        ) : (
          <Svg width={CHART_W} height={CHART_H}>
            {BANDS.map((b, i) => {
              const yTop = yFor(b.to);
              const yBot = yFor(b.from);
              return (
                <Rect
                  key={`band-${i}`}
                  x={PADDING.left}
                  y={yTop}
                  width={innerW}
                  height={Math.max(0, yBot - yTop)}
                  fill={b.color}
                />
              );
            })}
            {pathDs.map((d, i) => (
              <Path key={`seg-${i}`} d={d} stroke="#C1281B" strokeWidth={2} fill="none" />
            ))}
          </Svg>
        )}
      </View>

      {qualifier != null && (
        <Text
          style={[styles.statK, styles.qualifier]}
          testID={
            provenance.kind === 'provenance_unknown' ? 'recap-model-history-unavailable'
              : provenance.kind === 'recorded_incompatible' ? 'recap-versions-not-comparable'
                : 'recap-comparable-days'}
        >
          {qualifier}
        </Text>
      )}

      <View style={styles.statsGrid}>
        <Stat k="AVG" v={stats.avgScore == null ? UNAVAILABLE : String(stats.avgScore)} />
        <Stat k="PEAK AVG" v={stats.peakScore == null ? UNAVAILABLE : String(stats.peakScore)} />
        <Stat k="DAYS" v={String(stats.daysTracked)} />
        <Stat
          k="STREAK"
          v={stats.bestStreak == null ? UNAVAILABLE : String(stats.bestStreak)}
        />
      </View>
      {streakNote != null && (
        <Text style={[styles.statK, styles.qualifier]} testID="recap-streak-unavailable">
          {streakNote}
        </Text>
      )}

      <View style={styles.statsRow}>
        {/* SUPPRESSED (founder ruling 2026-09-01). `endOzConsumed` /
            `endAforceUnits` are per-UTC-day counters captured at an arbitrary
            client sync, not window cumulatives — so neither the last row, a sum
            of rows, nor a narrowed row can support a 30-day total. The card
            renders the unavailable state rather than a number it cannot back.
            Restored when the rollups route returns authoritative per-day
            intake ounces from `aforceIntakeLogs`. */}
        <Stat k="OUNCES" v={stats.totalOunces == null ? UNAVAILABLE : String(stats.totalOunces)} wide />
        <Stat k="STICKS" v={stats.totalSticks == null ? UNAVAILABLE : String(stats.totalSticks)} wide />
      </View>

      <View style={styles.footer}>
        <Text style={styles.brand}>aforce.os</Text>
      </View>
    </View>
  );
};

const Stat: React.FC<{ k: string; v: string; wide?: boolean }> = ({ k, v, wide }) => (
  <View style={[styles.stat, wide && styles.statWide]}>
    <Text style={styles.statK}>{k}</Text>
    <Text style={styles.statV}>{v}</Text>
  </View>
);

const styles = StyleSheet.create({
  // Reuses the stat-label tone rather than introducing a colour literal — the
  // brand-token ratchet correctly rejects added raw hex, and a qualifier should
  // read as metadata anyway, which is exactly what that tone already means.
  qualifier: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.7,
    marginTop: 6,
  },
  card: {
    width: CARD_W,
    aspectRatio: 1,
    backgroundColor: '#06070A',
    borderRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C1281B' },
  eyebrow: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(180,255,80,0.4)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scoreBadgeText: {
    color: '#C1281B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  chartWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    paddingVertical: 6,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#5C6275',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  statWide: {
    paddingVertical: 10,
  },
  statK: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  statV: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  footer: { alignItems: 'center' },
  brand: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
});

export default ShareJournalRecap;
