/**
 * ReadinessInsightsV2 — the Phase 2 · S4 redesign of the Weekly Report as
 * "Readiness Insights" (spec §8.4), rendered when `spec_weekly_report` is on.
 * Spec target: one large weekly score → line chart → three drivers → one AForce
 * insight — the compact, chart-led summary that replaces the legacy 7-card grid.
 *
 * Data is REAL and honest (spec §6.2, §11): the score series is the store's
 * recovery `history`; the drivers are the live score `breakdown` (never a
 * fabricated trend). When there isn't ≥2 days of history yet, it says so rather
 * than inventing a chart. The legacy grid is preserved behind the flag-off path.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import {
  AFScreen,
  AFTopBar,
  AFChart,
  AFCard,
  AFSectionLabel,
  AFStatusBadge,
  AFEmptyState,
} from '@/components/ui';
import { af, afType } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { useEngineSlice } from '@/store/slices';

function dayInitial(ts: Date | string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(undefined, { weekday: 'narrow' });
  } catch {
    return '';
  }
}

export function ReadinessInsightsV2() {
  const { state } = useAppStore();
  const engine = useEngineSlice();
  const { history } = state;

  // Chronological window of the most recent readings (history is newest-first).
  const window = history.slice(0, 7).reverse();
  const scores = window.map((h) => h.score);
  const labels = window.map((h) => dayInitial(h.timestamp));

  const avg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const delta = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null;

  // Drivers = the live score breakdown, biggest movers first, non-zero only.
  const drivers = [...engine.breakdown]
    .filter((c) => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  const topPositive = drivers.find((d) => d.delta > 0);

  return (
    <AFScreen scroll>
      <AFTopBar eyebrow="Last 7 days" title="Readiness insights" />

      {scores.length < 2 ? (
        <AFEmptyState
          icon="activity"
          title="Not enough history yet"
          message="Complete a couple more days of cycles and your readiness trend will appear here."
        />
      ) : (
        <>
          {/* Weekly score hero */}
          <View style={styles.hero}>
            <Text style={styles.score}>{avg}</Text>
            <Text style={styles.scoreLabel}>AVG READINESS</Text>
            {delta != null && delta !== 0 && (
              <View style={styles.deltaWrap}>
                <AFStatusBadge
                  label={`${delta > 0 ? '+' : '−'}${Math.abs(delta)} this week`}
                  tone={delta > 0 ? 'positive' : 'critical'}
                  icon={delta > 0 ? 'trending-up' : 'trending-down'}
                />
              </View>
            )}
          </View>

          {/* Line chart */}
          <View style={styles.chart}>
            <AFChart
              values={scores}
              labels={labels}
              height={140}
              summary={`Readiness over ${scores.length} days, averaging ${avg}.`}
            />
          </View>

          {/* Three drivers */}
          <View style={styles.section}>
            <AFSectionLabel label="What moved your score" />
            <AFCard padded={false} style={styles.driversCard}>
              {drivers.length === 0 ? (
                <Text style={styles.noDrivers}>No notable movers this week.</Text>
              ) : (
                drivers.map((d, i) => (
                  <View key={d.id} style={[styles.driverRow, i > 0 && styles.driverDivider]}>
                    <Text style={styles.driverLabel}>{d.label}</Text>
                    <Text style={[styles.driverDelta, { color: d.delta > 0 ? af.green : af.red }]}>
                      {d.delta > 0 ? '+' : '−'}
                      {Math.abs(Math.round(d.delta))}
                    </Text>
                  </View>
                ))
              )}
            </AFCard>
          </View>

          {/* One AForce insight */}
          {topPositive && (
            <View style={styles.section}>
              <AFSectionLabel label="AForce insight" />
              <AFCard>
                <Text style={styles.insight}>
                  {topPositive.label} is your biggest lift this week — keep leaning into it.
                </Text>
              </AFCard>
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 24, gap: 4 },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  scoreLabel: { ...afType.eyebrow, color: af.textTertiary },
  deltaWrap: { marginTop: 10 },
  chart: { marginTop: 28 },
  section: { marginTop: 28, gap: 12 },
  driversCard: { paddingHorizontal: 16 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  driverDivider: { borderTopWidth: 1, borderTopColor: af.divider },
  driverLabel: { ...afType.body, color: af.textPrimary, flex: 1 },
  driverDelta: { ...afType.title3, fontVariant: ['tabular-nums'] },
  noDrivers: { ...afType.secondary, color: af.textTertiary, padding: 16 },
  insight: { ...afType.body, color: af.textSecondary },
});
