/**
 * CircleScreenV3 — the Community screen V3 (founder comp 2026-08-12: "Update
 * the community screen to look like this"), rendered when
 * `circle_v3_dashboard_enabled` is on (app/(tabs)/competition.tsx branch;
 * tab label stays "Circle" per RC-L1 — in-screen heading "Community" per the
 * ruling's tab-label-only scope). View-model:
 * components/community/circleV3Presentation.ts (pure, tested) — see its
 * header for the data contract. In one line: the ranked cohort flows through
 * the SAME competitionEngine pipeline the shipped V2 screen used (sample
 * roster, live-injected You row), while everything about YOU is real where a
 * source exists (engine score/band, compliance streak, weather city,
 * own-baseline weekly hydration from real rollups). The sample roster is
 * captioned on screen and the footnote claims only what is real — your own
 * score and streak moving as you log — never a live standing against others.
 *
 * `fixture` exists ONLY for the demo gallery / tests (production builds never
 * pass it): it supplies the full inputs and skips every live source. Tab
 * switching stays interactive in both modes.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { AFScreen, AFTopBar, AFEmptyState } from '@/components/ui';
import { af, afType, Spacing } from '@/theme';
import { useEngineSlice, useUserSlice } from '@/store/slices';
import { buildSnapshot } from '@/services/competitionEngine';
import { fetchJournalRollups } from '@/services/realApi';
import type { JournalRollup } from '@/types';
import {
  buildCircleV3Model,
  type CircleTab,
  type CircleV3Inputs,
  type CircleV3RowView,
} from './circleV3Presentation';

const TABS: CircleTab[] = ['rank', 'cities', 'friends', 'challenge'];

/** Dark glyph on light avatar fills; bone on the Signal Red fill. */
function avatarTextColor(bg: string): string {
  return bg === af.red ? af.textPrimary : af.canvas;
}

export function CircleScreenV3({ fixture }: { fixture?: CircleV3Inputs }) {
  const { t } = useTranslation();
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const [tab, setTab] = React.useState<CircleTab>(fixture?.tab ?? 'rank');

  const [rollupDays, setRollupDays] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (fixture) return;
    let cancelled = false;
    fetchJournalRollups(7)
      .then((rollups: JournalRollup[]) => {
        if (cancelled) return;
        setRollupDays(rollups.filter((r) => r.endUnitsConsumed > 0).length);
      })
      .catch(() => {}); // no rollups → the challenge bar is omitted
    return () => { cancelled = true; };
  }, [fixture]);

  // Same live-injection args the shipped V2 screen passes — the You row in
  // the cohort carries the real engine score / compliance / streak.
  const liveSnapshot = React.useMemo(
    () =>
      fixture
        ? null
        : buildSnapshot({
            liveUserScore: engine.score,
            liveCompliance: Math.min(
              1,
              userState.unitsConsumedToday / Math.max(1, userState.dailyTarget),
            ),
            liveConsistency: Math.min(100, userState.complianceStreak * 12),
            liveStateLabel: engine.performanceState.level,
          }),
    [fixture, engine.score, engine.performanceState.level, userState.unitsConsumedToday, userState.dailyTarget, userState.complianceStreak],
  );

  const model = React.useMemo(
    () =>
      buildCircleV3Model({
        snapshot: fixture ? fixture.snapshot : liveSnapshot!,
        cityOverride: fixture ? fixture.cityOverride : (userState.weatherCity ?? null),
        hydrationDaysThisWeek: fixture ? fixture.hydrationDaysThisWeek : rollupDays,
        tab,
      }),
    [fixture, liveSnapshot, userState.weatherCity, rollupDays, tab],
  );

  const { you } = model;

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar eyebrow={t('community.v3.eyebrow')} title={t('community.v3.title')} />

      {/* You card — comp layout, live-injected row underneath */}
      <View style={[styles.youCard, { borderColor: `${you.accent}55` }]} testID="circle-v3-you">
        <View style={styles.youTop}>
          <View style={[styles.youAvatar, { backgroundColor: you.accent }]}>
            <Text style={styles.youAvatarText}>{you.initials}</Text>
          </View>
          <View style={styles.youWho}>
            <Text style={styles.youName}>{you.name}</Text>
            <Text style={styles.youMeta}>
              {you.cityLine} · <Text style={{ color: you.accent }}>{t(`community.v3.band_${you.bandKey}`)}</Text>
            </Text>
          </View>
          {you.deltaSpots != null ? (
            <View style={styles.spotsPill}>
              <Text style={styles.spotsText}>
                {you.deltaSpots > 0 ? '↑' : '↓'} {t('community.v3.spots', { n: Math.abs(you.deltaSpots) })}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.statsRow}>
          <YouStat value={fmtRank(you.globalRank)} label={t('community.v3.stat_global')} accent={you.accent} />
          <YouStat value={fmtRank(you.cityRank)} label={t('community.v3.stat_city')} />
          <YouStat value={fmtRank(you.stateRank)} label={t('community.v3.stat_state')} />
          <YouStat value={fmtRank(you.teamRank)} label={t('community.v3.stat_team')} />
          <YouStat value={String(you.score)} label={t('community.v3.stat_score')} accent={you.accent} />
        </View>
      </View>

      {/* Sample-cohort caption. The cohort stays (founder ruling), but the
          standings it produces — the rank stats above, the rows below — are
          not a measurement of real people, and the screen has to say so. */}
      <Text style={styles.sampleNote} testID="circle-v3-sample-note">
        {t('community.v3.sample_note')}
      </Text>

      {/* Scope tabs — comp pill row */}
      <View style={styles.tabsRow} accessibilityRole="tablist" testID="circle-v3-tabs">
        {TABS.map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tabPill, tab === key && styles.tabPillOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            // 9pt padding + a 18pt caption line is ~36pt; hitSlop carries the
            // touchable area to the 44pt minimum without changing the comp.
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            testID={`circle-v3-tab-${key}`}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>
              {t(`community.v3.tab_${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Weekly challenge — own-baseline hydration, real rollups only */}
      {model.challengePct != null ? (
        <View style={styles.challenge} testID="circle-v3-challenge">
          <View style={styles.challengeTop}>
            <Text style={styles.challengeTitle}>{t('community.v3.challenge_title')}</Text>
            <Text style={styles.challengePct}>{model.challengePct}%</Text>
          </View>
          <View style={styles.challengeTrack}>
            <LinearGradient
              colors={[af.red, af.amber]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.challengeFill, { width: `${model.challengePct}%` }]}
            />
          </View>
          {model.tab === 'challenge' && model.hydrationDays != null ? (
            <Text style={styles.challengeDetail}>
              {t('community.v3.challenge_detail', { n: model.hydrationDays })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Leaderboard — comp rows */}
      {model.rows.length > 0 ? (
        <View style={styles.list} testID="circle-v3-list">
          {model.rows.map((row) => (
            <LeaderRow key={row.key} row={row} streakLabel={(n) => t('community.v3.streak_days', { n })} />
          ))}
        </View>
      ) : model.tab === 'challenge' ? null : (
        // Challenge carries no roster by design; on the other three tabs an
        // empty list means there is nobody to rank — name that rather than
        // leave the screen looking half-loaded.
        <AFEmptyState
          icon="users"
          title={t('community.v3.empty_title')}
          message={t('community.v3.empty_message')}
          testID="circle-v3-empty"
        />
      )}

      <Text style={styles.footnote}>{t('community.v3.footnote')}</Text>
    </AFScreen>
  );
}

function fmtRank(rank: number | null): string {
  return rank != null ? `#${rank}` : '—';
}

function YouStat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LeaderRow({ row, streakLabel }: { row: CircleV3RowView; streakLabel: (n: number) => string }) {
  const subtitle =
    row.streakDays != null ? `${row.subtitleLeft} · ${streakLabel(row.streakDays)}` : row.subtitleLeft;
  return (
    <View style={[styles.row, row.isYou && styles.rowYou]}>
      <Text style={styles.rowRank}>{row.rank}</Text>
      <View style={[styles.rowAvatar, { backgroundColor: row.avatarColor }]}>
        <Text style={[styles.rowAvatarText, { color: avatarTextColor(row.avatarColor) }]}>
          {row.initials}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowNameLine}>
          <Text style={[styles.rowName, row.isYou && { color: af.green }]}>{row.name}</Text>
          {row.verified ? (
            <View style={styles.verified} accessibilityLabel="Verified">
              <Text style={styles.verifiedGlyph}>✓</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Text style={[styles.rowScore, { color: row.scoreAccent }]}>{row.score}</Text>
      <Text
        style={[
          styles.rowMove,
          row.move.dir === 'up' && { color: af.green },
          row.move.dir === 'down' && { color: af.redText },
        ]}
      >
        {row.move.dir === 'up' ? `↑${row.move.n}` : row.move.dir === 'down' ? `↓${row.move.n}` : '–'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8] },
  youCard: {
    marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1,
    backgroundColor: `${af.green}0A`,
  },
  youTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  youAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  youAvatarText: { ...afType.bodyStrong, color: af.canvas, letterSpacing: 1 },
  youWho: { flex: 1, gap: 2 },
  youName: { ...afType.title3, color: af.textPrimary },
  youMeta: { ...afType.caption, color: af.textSecondary },
  spotsPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: `${af.green}1F`, borderWidth: 1, borderColor: `${af.green}44`,
  },
  spotsText: { ...afType.caption, color: af.green, fontVariant: ['tabular-nums'] },
  statsRow: {
    flexDirection: 'row', marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: af.divider,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  sampleNote: { ...afType.caption, color: af.textTertiary, marginTop: 10 },
  tabsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tabPill: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: af.surface, borderWidth: 1, borderColor: af.border,
  },
  tabPillOn: { backgroundColor: af.red, borderColor: af.red },
  tabText: { ...afType.caption, color: af.textSecondary },
  tabTextOn: { color: af.textPrimary },
  challenge: {
    marginTop: 16, padding: 14, gap: 10, borderRadius: 14,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  challengeTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  challengeTitle: { ...afType.bodyStrong, color: af.textPrimary },
  challengePct: { ...afType.bodyStrong, color: af.textSecondary, fontVariant: ['tabular-nums'] },
  challengeTrack: { height: 8, borderRadius: 4, backgroundColor: af.divider, overflow: 'hidden' },
  challengeFill: { height: '100%', borderRadius: 4 },
  challengeDetail: { ...afType.caption, color: af.textTertiary },
  list: { marginTop: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: af.divider,
  },
  rowYou: { backgroundColor: `${af.green}0D`, borderRadius: 12, paddingHorizontal: 10 },
  rowRank: { ...afType.body, color: af.textTertiary, width: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  rowAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowAvatarText: { ...afType.bodyStrong, letterSpacing: 0.5 },
  rowBody: { flex: 1, gap: 2 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { ...afType.bodyStrong, color: af.textPrimary },
  verified: { width: 16, height: 16, borderRadius: 8, backgroundColor: af.cyan, alignItems: 'center', justifyContent: 'center' },
  verifiedGlyph: { color: af.canvas, fontSize: 10, fontWeight: '700' },
  rowSub: { ...afType.caption, color: af.textTertiary },
  rowScore: { ...afType.title3, fontVariant: ['tabular-nums'] },
  rowMove: { ...afType.caption, color: af.textTertiary, width: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
  footnote: { ...afType.caption, color: af.textTertiary, marginTop: 14 },
});
