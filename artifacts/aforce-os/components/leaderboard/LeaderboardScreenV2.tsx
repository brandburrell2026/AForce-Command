/**
 * Leaderboard Screen — spec #7 slice 3.
 *
 * Top 100 recruiters by total claims, plus the caller's rank/claims.
 * Anonymous "Operator XXXX" handles only — zero PII surfaced. Social
 * recognition is the entire reward; no entitlement or money flows.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import { useGetReferralLeaderboard } from '@workspace/api-client-react';

export function LeaderboardScreenV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const topPadding = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom + 24;

  const q = useGetReferralLeaderboard();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await q.refetch(); } finally { setRefreshing(false); }
  }, [q]);

  const data = q.data;
  const entries = data?.entries ?? [];
  const yourRank = data?.yourRank ?? 0;
  const yourClaims = data?.yourClaims ?? 0;
  const totalParticipants = data?.totalParticipants ?? 0;
  const showYouSeparately =
    yourRank > 0 && !entries.some((e) => e.isYou);

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding, paddingBottom: bottomPadding },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={af.textPrimary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              testID="leaderboard-back"
            >
              <Icon name="chevron-left" size={20} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t('leaderboard.v2.eyebrow')}</Text>
              <Text style={styles.title}>{t('leaderboard.v2.title')}</Text>
            </View>
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryNumber}>
                {yourRank > 0 ? `#${yourRank}` : '—'}
              </Text>
              <Text style={styles.summaryLabel}>{t('leaderboard.v2.your_rank')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryNumber}>{yourClaims}</Text>
              <Text style={styles.summaryLabel}>{t('leaderboard.v2.your_claims')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryNumber}>{totalParticipants}</Text>
              <Text style={styles.summaryLabel}>{t('leaderboard.v2.operators')}</Text>
            </View>
          </View>

          {q.isLoading ? (
            <Text style={styles.emptyText}>{t('leaderboard.v2.loading')}</Text>
          ) : entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('leaderboard.v2.empty')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {entries.map((e) => (
                <Row
                  key={`${e.handle}-${e.rank}`}
                  rank={e.rank}
                  handle={e.handle}
                  tierLabel={e.tier.label}
                  claims={e.claims}
                  isYou={e.isYou}
                />
              ))}
              {showYouSeparately ? (
                <>
                  <View style={styles.ellipsis}>
                    <Text style={styles.ellipsisText}>· · ·</Text>
                  </View>
                  <Row
                    rank={yourRank}
                    handle={t('leaderboard.v2.you')}
                    tierLabel=""
                    claims={yourClaims}
                    isYou
                  />
                </>
              ) : null}
            </View>
          )}

          <Text style={styles.footnote}>{t('leaderboard.v2.footnote')}</Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function Row({
  rank, handle, tierLabel, claims, isYou,
}: {
  rank: number; handle: string; tierLabel: string; claims: number; isYou: boolean;
}) {
  const { t } = useTranslation();
  const rowA11yLabel =
    `#${rank} ${handle}${tierLabel ? `, ${tierLabel}` : ''}, ` +
    `${claims} ${t('leaderboard.v2.recruits')}`;
  return (
    <View
      style={[styles.row, isYou && styles.rowYou]}
      accessible
      accessibilityLabel={rowA11yLabel}
      testID={isYou ? 'leaderboard-row-you' : `leaderboard-row-${rank}`}
    >
      <Text style={[styles.rowRank, isYou && styles.rowRankYou]}>
        {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : `#${rank}`}
      </Text>
      <View style={styles.rowMid}>
        <Text style={[styles.rowHandle, isYou && styles.rowHandleYou]} numberOfLines={1}>
          {handle}
        </Text>
        {tierLabel ? <Text style={styles.rowTier}>{tierLabel.toUpperCase()}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowClaims, isYou && styles.rowClaimsYou]}>{claims}</Text>
        <Text style={styles.rowClaimsLabel}>{t('leaderboard.v2.recruits')}</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: { paddingHorizontal: 20, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold', fontSize: 10,
    letterSpacing: 2.5, color: af.textTertiary, textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Inter_700Bold', fontSize: 28, color: af.textPrimary, marginTop: 2,
  },
  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 18, paddingHorizontal: 8,
    borderRadius: 16, borderWidth: 1, borderColor: af.divider,
    backgroundColor: af.surface,
  },
  summaryCol: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, height: 32, backgroundColor: af.divider },
  summaryNumber: {
    fontFamily: 'Inter_700Bold', fontSize: 26, color: af.textPrimary,
  },
  summaryLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 9,
    letterSpacing: 1.6, color: af.textTertiary, textTransform: 'uppercase',
  },
  list: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: af.divider,
    backgroundColor: af.surface,
    gap: 12,
  },
  rowYou: {
    borderColor: af.red,
    backgroundColor: 'rgba(193,40,27,0.06)',
  },
  rowRank: {
    width: 44, fontFamily: 'Inter_700Bold', fontSize: 16,
    color: af.textSecondary, textAlign: 'center',
  },
  rowRankYou: { color: af.redText },
  rowMid: { flex: 1, gap: 2 },
  rowHandle: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 15, color: af.textPrimary, letterSpacing: 1.5,
  },
  rowHandleYou: { color: af.redText },
  rowTier: {
    fontFamily: 'Inter_600SemiBold', fontSize: 9,
    letterSpacing: 1.6, color: af.textTertiary,
  },
  rowRight: { alignItems: 'flex-end', gap: 2, minWidth: 70 },
  rowClaims: {
    fontFamily: 'Inter_700Bold', fontSize: 20, color: af.textPrimary,
  },
  rowClaimsYou: { color: af.redText },
  rowClaimsLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 9,
    letterSpacing: 1.4, color: af.textTertiary,
  },
  ellipsis: { alignItems: 'center', paddingVertical: 6 },
  ellipsisText: { color: af.textTertiary, fontSize: 18, letterSpacing: 4 },
  empty: {
    paddingVertical: 36, paddingHorizontal: 18,
    borderRadius: 16, borderWidth: 1, borderColor: af.divider,
    backgroundColor: af.surface, alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20,
    color: af.textTertiary, textAlign: 'center',
  },
  footnote: {
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16,
    color: af.textTertiary, textAlign: 'center', marginTop: 4, paddingHorizontal: 18,
  },
});
