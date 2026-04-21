/**
 * Competition Screen — Hydration as sport.
 *
 * Scope selector → City / State / Team / Individual.
 * Live data: the current user's row updates from store.engineOutput.
 *
 * Surfaces:
 *   - User stat card (rank + recent delta — the "personal best" wow)
 *   - Optional Team card (when scope === team and user has a team)
 *   - Leaderboard for the selected scope
 *   - Optional "City wins" celebration ribbon (when topCity competitionScore >= 90)
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { Leaderboard } from '@/components/Leaderboard';
import { TeamCard } from '@/components/TeamCard';
import { useAppStore } from '@/store/useAppStore';
import { buildSnapshot } from '@/services/competitionEngine';
import { Colors } from '@/theme/colors';
import { CURRENT_USER_KEY } from '@/mocks/competitionData';
import type { CompetitionScope, LeaderboardEntry } from '@/types/competition';

export default function CompetitionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const { engineOutput, userState, featureFlags } = state;

  // Compute enabled scopes from flags BEFORE selecting initial scope, so a
  // disabled default ('individual') never renders.
  const enabledScopeKinds = React.useMemo<CompetitionScope[]>(() => {
    const out: CompetitionScope[] = [];
    if (featureFlags.city_competition_enabled !== false)       out.push('city');
    if (featureFlags.state_competition_enabled !== false)      out.push('state');
    if (featureFlags.team_competition_enabled !== false)       out.push('team');
    if (featureFlags.global_leaderboard_enabled !== false)     out.push('individual');
    return out;
  }, [featureFlags]);

  const [scope, setScope] = React.useState<CompetitionScope>(
    () => (enabledScopeKinds.includes('individual') ? 'individual' : (enabledScopeKinds[0] ?? 'individual')),
  );

  // Derive the effective scope synchronously during render so a stale/disabled
  // scope can never render between a flag flip and a useEffect fallback.
  const effectiveScope: CompetitionScope | null =
    enabledScopeKinds.length === 0
      ? null
      : (enabledScopeKinds.includes(scope) ? scope : enabledScopeKinds[0]);

  const snapshot = React.useMemo(() => {
    return buildSnapshot({
      liveUserScore: engineOutput.score,
      liveCompliance: Math.min(1, userState.unitsConsumedToday / Math.max(1, userState.dailyTarget)),
      liveConsistency: Math.min(100, userState.complianceStreak * 12),
      liveStateLabel: engineOutput.performanceState.level,
    });
  }, [engineOutput, userState]);

  const entries: LeaderboardEntry[] = React.useMemo(() => {
    switch (effectiveScope) {
      case 'city':       return snapshot.cities.map(c => ({ kind: 'city',       entry: c } as LeaderboardEntry));
      case 'state':      return snapshot.states.map(s => ({ kind: 'state',      entry: s } as LeaderboardEntry));
      case 'team':       return snapshot.teams.map(t => ({ kind: 'team',        entry: t } as LeaderboardEntry));
      case 'individual': return snapshot.individuals.map(u => ({ kind: 'individual', entry: u } as LeaderboardEntry));
      default:           return [];
    }
  }, [effectiveScope, snapshot]);

  // Build visible scope tabs from the enabled set.
  const scopes: { kind: CompetitionScope; label: string }[] = enabledScopeKinds.map((k) => ({
    kind: k,
    label: k === 'individual' ? 'Individual' : k.charAt(0).toUpperCase() + k.slice(1),
  }));

  const me = snapshot.context;
  const myTeam = snapshot.teams.find(t => t.id === me.user.teamId);
  const topCity = snapshot.cities[0];

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom + 24;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Feather name="chevron-left" size={22} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>SPORT MODE</Text>
              <Text style={styles.title}>Competition</Text>
            </View>
            <View style={[styles.statePill, { borderColor: `${Colors.states.PEAK.primary}55`, backgroundColor: `${Colors.states.PEAK.primary}15` }]}>
              <Feather name="zap" size={10} color={Colors.states.PEAK.primary} />
              <Text style={[styles.statePillText, { color: Colors.states.PEAK.primary }]}>LIVE</Text>
            </View>
          </View>

          {/* User context card */}
          <View style={[styles.userCard, { borderColor: Colors.border.medium }]}>
            <View style={styles.userTopRow}>
              <View style={[styles.youAvatar, { backgroundColor: Colors.states.PEAK.primary }]}>
                <Text style={styles.youAvatarText}>{me.user.avatarInitials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.userName}>{me.user.name}</Text>
                <Text style={styles.userMeta}>{me.user.city}, {me.user.state} · {me.user.state_label}</Text>
              </View>
              <View style={[styles.deltaPill, me.recentDelta > 0 ? { backgroundColor: `${Colors.states.PEAK.primary}1F` } : null]}>
                <Feather name="arrow-up-right" size={11} color={Colors.states.PEAK.primary} />
                <Text style={[styles.deltaText, { color: Colors.states.PEAK.primary }]}>+{me.recentDelta} spots</Text>
              </View>
            </View>
            <View style={styles.userStatsRow}>
              <UserStat label="GLOBAL"  value={`#${me.globalRank ?? '—'}`} accent={Colors.states.PEAK.primary} />
              <UserStat label="CITY"    value={`#${me.cityRank ?? '—'}`} />
              <UserStat label="STATE"   value={`#${me.stateRank ?? '—'}`} />
              <UserStat label="TEAM"    value={me.teamRank != null ? `#${me.teamRank}` : '—'} />
              <UserStat label="SCORE"   value={String(me.user.competitionScore)} accent={Colors.states.PEAK.primary} />
            </View>
          </View>

          {/* City-wins celebration ribbon (WOW moment) */}
          {snapshot.cityWinsAvailable && topCity && (
            <View style={[styles.celebrate, { borderColor: `${Colors.states.PEAK.primary}55` }]}>
              <Feather name="award" size={14} color={Colors.states.PEAK.primary} />
              <Text style={styles.celebrateText}>
                <Text style={{ color: Colors.states.PEAK.primary, fontFamily: 'Inter_700Bold' }}>{topCity.name}</Text>
                {' leads the country this week.'}
              </Text>
            </View>
          )}

          {/* Scope selector */}
          <View style={styles.scopeRow}>
            {scopes.map((s) => (
              <Pressable
                key={s.kind}
                onPress={() => setScope(s.kind)}
                style={[styles.scopeBtn, effectiveScope === s.kind && styles.scopeBtnActive]}
              >
                <Text style={[styles.scopeText, effectiveScope === s.kind && styles.scopeTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Featured team card */}
          {scope === 'team' && myTeam && (
            <TeamCard team={myTeam} yourRank={me.teamRank} />
          )}

          {/* Leaderboard */}
          <Leaderboard entries={entries} />

          {/* Footnote */}
          <Text style={styles.footnote}>
            Re-ranks live as you log intake, complete protocols, and recover.
          </Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function UserStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.userStat}>
      <Text style={[styles.userStatValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.userStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  back: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fill.light },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.6, marginTop: 2 },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  statePillText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },

  userCard: {
    marginHorizontal: 20, marginBottom: 14, padding: 16, borderRadius: 18,
    backgroundColor: Colors.background.card, borderWidth: 1,
  },
  userTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  youAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  youAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text.inverse, letterSpacing: 0.5 },
  userName: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.3 },
  userMeta: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 2 },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  deltaText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  userStatsRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  userStat: { alignItems: 'center', flex: 1 },
  userStatValue: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.4 },
  userStatLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5, marginTop: 2 },

  celebrate: {
    marginHorizontal: 20, marginBottom: 14, padding: 12, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.states.PEAK.primary}10`, borderWidth: 1,
  },
  celebrateText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.primary, flex: 1 },

  scopeRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: Colors.background.card, borderRadius: 100, padding: 4 },
  scopeBtn: { flex: 1, paddingVertical: 9, borderRadius: 100, alignItems: 'center' },
  scopeBtnActive: { backgroundColor: Colors.fill.strong },
  scopeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text.muted, letterSpacing: 0.5 },
  scopeTextActive: { color: Colors.text.primary },

  footnote: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted, textAlign: 'center', paddingHorizontal: 28, marginTop: 16, lineHeight: 16 },
});
