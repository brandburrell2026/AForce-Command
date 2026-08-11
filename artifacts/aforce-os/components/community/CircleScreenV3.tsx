/**
 * CircleScreenV3 — the Circle tab redesign (founder comps 2026-08-11; the
 * canonical "Circle" name per RC-L1), rendered only when
 * `circle_v3_dashboard_enabled` is on (app/(tabs)/competition.tsx branch).
 * View-model: components/community/circleV3Presentation.ts (pure, tested) —
 * see its header for the honest-data contract. In one line: the comp's mock
 * named-people rankings are replaced by the app's only real cross-user
 * surface (the anonymous referral boards), "You" carries only real engine/
 * analytics fields, the challenge is own-baseline hydration from real
 * rollups, and friends/activity (no real source) are omitted.
 *
 * `fixture` exists ONLY for the demo gallery / tests (production builds never
 * pass it): it skips every live source — including the boards query — and
 * renders the given inputs.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useUser } from '@clerk/expo';
import { useGetReferralLeaderboard } from '@workspace/api-client-react';

import { AFScreen, AFTopBar, AFCard, AFSectionLabel } from '@/components/ui';
import { af, afType, Spacing } from '@/theme';
import { useEngineSlice, useUserSlice, useProfileIdentitySlice } from '@/store/slices';
import { useScoreTrend } from '@/hooks/useScoreTrend';
import { fetchJournalRollups } from '@/services/realApi';
import type { JournalRollup } from '@/types';
import {
  buildCircleV3Model,
  type CircleV3Inputs,
  type CircleBoardRowView,
} from './circleV3Presentation';

const MEDALS = ['🥇', '🥈', '🥉'];

export function CircleScreenV3({ fixture }: { fixture?: CircleV3Inputs }) {
  const { t } = useTranslation();
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const profileIdentity = useProfileIdentitySlice();
  const { user: clerkUser } = useUser();
  const trend = useScoreTrend(fixture ? fixture.score : engine.score);
  const boardQuery = useGetReferralLeaderboard({
    query: { queryKey: ['circle-v3-boards'], enabled: !fixture },
  });

  const [rollups, setRollups] = React.useState<JournalRollup[]>([]);
  React.useEffect(() => {
    if (fixture) return;
    let cancelled = false;
    fetchJournalRollups(7)
      .then((r) => { if (!cancelled) setRollups(r); })
      .catch(() => {}); // no rollups → the challenge renders its posture
    return () => { cancelled = true; };
  }, [fixture]);

  const model = React.useMemo(() => {
    if (fixture) return buildCircleV3Model(fixture);
    const displayName =
      profileIdentity.displayName.trim() ||
      clerkUser?.fullName ||
      clerkUser?.firstName ||
      '';
    return buildCircleV3Model({
      score: engine.score,
      level: engine.performanceState.level,
      trend,
      displayName,
      city: userState.weatherCity ?? null,
      complianceStreak: userState.complianceStreak,
      rollups,
      board: boardQuery.data ?? null,
      boardFailed: Boolean(boardQuery.isError),
    });
  }, [
    fixture,
    engine.score,
    engine.performanceState.level,
    trend,
    profileIdentity.displayName,
    clerkUser?.fullName,
    clerkUser?.firstName,
    userState.weatherCity,
    userState.complianceStreak,
    rollups,
    boardQuery.data,
    boardQuery.isError,
  ]);

  const { you } = model;

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar eyebrow={t('community.v3.eyebrow')} title={t('community.v3.title')} />

      {/* Live chip — only when the boards actually returned server data
          (corrects the V2 header's always-on LIVE pill). */}
      {model.live ? (
        <View style={styles.liveChip} testID="circle-v3-live">
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{t('community.v3.live')}</Text>
        </View>
      ) : null}

      {/* You — real fields only */}
      <AFCard variant="raised" style={styles.youCard} testID="circle-v3-you">
        <View style={styles.youTop}>
          <View style={[styles.avatar, { backgroundColor: `${you.accent}26` }]}>
            <Text style={[styles.avatarText, { color: you.accent }]}>{you.initials}</Text>
          </View>
          <View style={styles.youWho}>
            <Text style={styles.youName}>{t('community.v3.you')}</Text>
            <Text style={styles.youSub}>
              {you.city ? `${you.city} · ` : ''}
              <Text style={{ color: you.accent }}>{t(`community.v3.band_${you.bandKey}`)}</Text>
            </Text>
          </View>
          {you.trendPill ? (
            <View
              style={[
                styles.trendPill,
                you.trendPill.direction === 'rising' ? styles.trendUp : styles.trendDown,
              ]}
            >
              <Text
                style={[
                  styles.trendText,
                  { color: you.trendPill.direction === 'rising' ? af.green : af.amber },
                ]}
              >
                {you.trendPill.direction === 'rising' ? '▲' : '▼'} {you.trendPill.delta}{' '}
                {t('community.v3.pts')}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rankRow}>
          <View style={styles.rankCell}>
            <Text style={[styles.rankValue, you.boardRank != null && { color: you.accent }]}>
              {you.boardRank != null ? `#${you.boardRank}` : '—'}
            </Text>
            <Text style={styles.rankLabel}>{t('community.v3.rank_boards')}</Text>
          </View>
          <View style={styles.rankCell}>
            <Text style={styles.rankValue}>{you.claims}</Text>
            <Text style={styles.rankLabel}>{t('community.v3.rank_claims')}</Text>
          </View>
          <View style={styles.rankCell}>
            <Text style={styles.rankValue}>{you.streak}</Text>
            <Text style={styles.rankLabel}>{t('community.v3.rank_streak')}</Text>
          </View>
          <View style={styles.rankCell}>
            <Text style={[styles.rankValue, { color: you.accent }]}>{you.score}</Text>
            <Text style={styles.rankLabel}>{t('community.v3.rank_score')}</Text>
          </View>
        </View>
      </AFCard>

      {/* Own-baseline weekly hydration challenge (never a member comparison) */}
      {model.challenge ? (
        <View style={styles.challenge} testID="circle-v3-challenge">
          <View style={styles.challengeTop}>
            <Text style={styles.challengeTitle}>{t('community.v3.challenge_title')}</Text>
            <Text style={styles.challengeValue}>
              {model.challenge.hydrationDays}/{model.challenge.windowDays}{' '}
              {t('community.v3.challenge_days')}
            </Text>
          </View>
          <View style={styles.challengeBar}>
            <View
              style={[styles.challengeFill, { width: `${Math.round(model.challenge.fraction * 100)}%` }]}
            />
          </View>
        </View>
      ) : null}

      {/* The Boards — the app's only real cross-user surface (anonymous) */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <AFSectionLabel label={t('community.v3.boards_label')} />
          {model.stats ? (
            <Text style={styles.sectionHint}>
              {t('community.v3.operators', { n: model.stats.operators })}
            </Text>
          ) : null}
        </View>

        {model.boardStatus === 'loading' ? (
          <Text style={styles.posture}>{t('community.v3.boards_loading')}</Text>
        ) : model.boardStatus === 'offline' ? (
          <Text style={styles.posture}>{t('community.v3.boards_offline')}</Text>
        ) : model.boardStatus === 'empty' ? (
          <Text style={styles.posture}>{t('community.v3.boards_empty')}</Text>
        ) : (
          <View style={styles.board} testID="circle-v3-board">
            {model.boardRows.map((r) => (
              <BoardRow key={`${r.handle}-${r.rank}`} row={r} t={t} />
            ))}
            {model.youRow ? (
              <>
                <View style={styles.youDivider} />
                <BoardRow row={model.youRow} t={t} />
              </>
            ) : null}
          </View>
        )}
        <Text style={styles.footnote}>{t('community.v3.boards_footnote')}</Text>
      </View>
    </AFScreen>
  );
}

function BoardRow({ row, t }: { row: CircleBoardRowView; t: TFunction }) {
  return (
    <View style={[styles.row, row.isYou && styles.rowYou]}>
      <Text style={styles.rowRank}>{MEDALS[row.rank - 1] ?? row.rank}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowHandle, row.isYou && { color: af.green }]}>
          {row.isYou ? t('community.v3.you') : row.handle}
        </Text>
        {row.tierLabel ? <Text style={styles.rowTier}>{row.tierLabel}</Text> : null}
      </View>
      <Text style={styles.rowClaims}>
        {row.claims} <Text style={styles.rowClaimsUnit}>{t('community.v3.claims_unit')}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8] },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    marginTop: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: `${af.green}44`, backgroundColor: `${af.green}14`,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: af.green },
  liveText: { ...afType.caption, color: af.green, letterSpacing: 1 },
  youCard: { marginTop: 16 },
  youTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...afType.bodyStrong, letterSpacing: 1 },
  youWho: { flex: 1, gap: 2 },
  youName: { ...afType.title3, color: af.textPrimary },
  youSub: { ...afType.caption, color: af.textSecondary },
  trendPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  trendUp: { backgroundColor: `${af.green}22` },
  trendDown: { backgroundColor: `${af.amber}22` },
  trendText: { ...afType.caption, fontVariant: ['tabular-nums'] },
  rankRow: {
    flexDirection: 'row', marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: af.divider,
  },
  rankCell: { flex: 1, alignItems: 'center', gap: 3 },
  rankValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  rankLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  challenge: {
    marginTop: 16, padding: 14, gap: 10, borderRadius: 14,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  challengeTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  challengeTitle: { ...afType.bodyStrong, color: af.textPrimary },
  challengeValue: { ...afType.caption, color: af.cyan, fontVariant: ['tabular-nums'] },
  challengeBar: { height: 8, borderRadius: 4, backgroundColor: af.divider, overflow: 'hidden' },
  challengeFill: { height: '100%', borderRadius: 4, backgroundColor: af.cyan },
  section: { marginTop: 24, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionHint: { ...afType.caption, color: af.textTertiary },
  posture: { ...afType.body, color: af.textTertiary, paddingVertical: 10 },
  board: { borderRadius: 14, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: af.divider,
  },
  rowYou: { backgroundColor: `${af.green}0D` },
  rowRank: { ...afType.bodyStrong, color: af.textSecondary, width: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
  rowBody: { flex: 1, gap: 1 },
  rowHandle: { ...afType.bodyStrong, color: af.textPrimary },
  rowTier: { ...afType.caption, color: af.textTertiary },
  rowClaims: { ...afType.bodyStrong, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  rowClaimsUnit: { ...afType.caption, color: af.textTertiary },
  youDivider: { height: 6, backgroundColor: af.canvas },
  footnote: { ...afType.caption, color: af.textTertiary },
});
