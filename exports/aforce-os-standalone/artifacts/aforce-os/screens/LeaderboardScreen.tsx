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
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { useGetReferralLeaderboard } from '@workspace/api-client-react';

export function LeaderboardScreen() {
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
              tintColor={Colors.text.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={12}
              testID="leaderboard-back"
            >
              <Icon name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>RECRUITERS</Text>
              <Text style={styles.title}>Leaderboard</Text>
            </View>
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryNumber}>
                {yourRank > 0 ? `#${yourRank}` : '—'}
              </Text>
              <Text style={styles.summaryLabel}>YOUR RANK</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryNumber}>{yourClaims}</Text>
              <Text style={styles.summaryLabel}>YOUR CLAIMS</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryNumber}>{totalParticipants}</Text>
              <Text style={styles.summaryLabel}>OPERATORS</Text>
            </View>
          </View>

          {q.isLoading ? (
            <Text style={styles.emptyText}>Loading the boards…</Text>
          ) : entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No recruits on the boards yet.{'\n'}Be the first to put an
                operator's name up.
              </Text>
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
                    handle="You"
                    tierLabel=""
                    claims={yourClaims}
                    isYou
                  />
                </>
              ) : null}
            </View>
          )}

          <Text style={styles.footnote}>
            Handles are anonymous — derived from each operator's invite
            code. No emails, no real names. Recognition only.
          </Text>
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
  return (
    <View
      style={[styles.row, isYou && styles.rowYou]}
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
        <Text style={styles.rowClaimsLabel}>RECRUITS</Text>
      </View>
    </View>
  );
}

export default LeaderboardScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold', fontSize: 10,
    letterSpacing: 2.5, color: Colors.text.muted, textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text.primary, marginTop: 2,
  },
  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 18, paddingHorizontal: 8,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
  },
  summaryCol: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.border.subtle },
  summaryNumber: {
    fontFamily: 'Inter_700Bold', fontSize: 26, color: Colors.text.primary,
  },
  summaryLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 9,
    letterSpacing: 1.6, color: Colors.text.muted, textTransform: 'uppercase',
  },
  list: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    gap: 12,
  },
  rowYou: {
    borderColor: Colors.accent.primary,
    backgroundColor: 'rgba(182,255,0,0.06)',
  },
  rowRank: {
    width: 44, fontFamily: 'Inter_700Bold', fontSize: 16,
    color: Colors.text.secondary, textAlign: 'center',
  },
  rowRankYou: { color: Colors.accent.primary },
  rowMid: { flex: 1, gap: 2 },
  rowHandle: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 15, color: Colors.text.primary, letterSpacing: 1.5,
  },
  rowHandleYou: { color: Colors.accent.primary },
  rowTier: {
    fontFamily: 'Inter_600SemiBold', fontSize: 9,
    letterSpacing: 1.6, color: Colors.text.muted,
  },
  rowRight: { alignItems: 'flex-end', gap: 2, minWidth: 70 },
  rowClaims: {
    fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text.primary,
  },
  rowClaimsYou: { color: Colors.accent.primary },
  rowClaimsLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 9,
    letterSpacing: 1.4, color: Colors.text.muted,
  },
  ellipsis: { alignItems: 'center', paddingVertical: 6 },
  ellipsisText: { color: Colors.text.muted, fontSize: 18, letterSpacing: 4 },
  empty: {
    paddingVertical: 36, paddingHorizontal: 18,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card, alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20,
    color: Colors.text.muted, textAlign: 'center',
  },
  footnote: {
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16,
    color: Colors.text.muted, textAlign: 'center', marginTop: 4, paddingHorizontal: 18,
  },
});
