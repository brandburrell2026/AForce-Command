/**
 * Community Screen — five-section hub.
 *
 *   • RANKINGS   — scope selector (City / State / Team / Individual)
 *                  + live user context card + leaderboard
 *   • CHALLENGES — open circle challenges (CircleChallengeCard list)
 *   • BATTLES    — live region rivalries (BattleCard list)
 *   • TEAMS      — team performance roster (TeamCard for "My Team"
 *                  + ranked list of all teams)
 *   • MAP        — territory teaser → deep-links into /territory
 *
 * The route file is still `(tabs)/competition.tsx` (keeps deep links
 * stable); the tab label is now "Community" via the i18n key
 * `tabs.competition` → "Community".
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { Icon } from '../components/Icon';

import { GradientBackground } from '@/components/GradientBackground';
import { Leaderboard } from '@/components/Leaderboard';
import { TeamCard } from '@/components/TeamCard';
import { BattleCard } from '@/components/BattleCard';
import { CircleChallengeCard } from '@/components/CircleChallengeCard';
import { useAppStore } from '@/store/useAppStore';
import { buildSnapshot, trendArrow } from '@/services/competitionEngine';
import { Colors } from '@/theme/colors';
import type { CompetitionScope, LeaderboardEntry, CompetitorTeam } from '@/types/competition';
import type { FeatureFlags } from '@/types';

import { listBattles, supportSide } from '@/services/battleService';
import { listChallenges, acceptChallenge } from '@/services/circleService';
import { useBattlesSubscription, useCircleSubscription } from '@/hooks/useCircleSubscription';

type SectionKey = 'rankings' | 'challenges' | 'battles' | 'teams' | 'map';

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'rankings',   label: 'RANK',       icon: 'bar-chart-2' },
  { key: 'challenges', label: 'CHALLENGES', icon: 'zap' },
  { key: 'battles',    label: 'BATTLES',    icon: 'shield' },
  { key: 'teams',      label: 'TEAMS',      icon: 'users' },
  { key: 'map',        label: 'MAP',        icon: 'map' },
];

export default function CompetitionScreen() {
  const router = useRouter();
  // Tab-level navigator handle — used to jump back to the Home tab
  // explicitly. `router.replace('/')` is unreliable inside route
  // groups + the iOS More overflow, so we drive the parent tab
  // navigator directly when we need to leave Community.
  const navigation = useNavigation();
  const goHomeTab = React.useCallback(() => {
    const parent =
      (navigation as { getParent?: () => unknown }).getParent?.() ?? navigation;
    try {
      (parent as { navigate: (name: string) => void }).navigate('index');
    } catch {
      router.replace('/');
    }
  }, [navigation, router]);
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const { engineOutput, userState, featureFlags } = state;

  const [section, setSection] = React.useState<SectionKey>('rankings');
  // Section visit history — back chevron steps back through the
  // sections you've actually visited (Rank → Challenges → Battles →
  // ← Challenges ← Rank ← Home) instead of jumping straight to Home
  // on the first tap. Empty stack means we're at the original section
  // entry point and back exits the tab.
  const [sectionHistory, setSectionHistory] = React.useState<SectionKey[]>([]);
  const goToSection = React.useCallback(
    (next: SectionKey) => {
      setSectionHistory((prev) =>
        next === section ? prev : [...prev, section],
      );
      setSection(next);
    },
    [section],
  );

  // ── Snapshot (shared across Rankings + Teams) ─────────────────────
  const snapshot = React.useMemo(() => {
    return buildSnapshot({
      liveUserScore: engineOutput.score,
      liveCompliance: Math.min(1, userState.unitsConsumedToday / Math.max(1, userState.dailyTarget)),
      liveConsistency: Math.min(100, userState.complianceStreak * 12),
      liveStateLabel: engineOutput.performanceState.level,
    });
  }, [engineOutput, userState]);

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
            <Pressable
              onPress={() => {
                // 1. If the user has stepped through Community
                //    sections (Rank → Challenges → Battles → …),
                //    walk them back through that history first.
                if (sectionHistory.length > 0) {
                  const prev = sectionHistory[sectionHistory.length - 1]!;
                  setSection(prev);
                  setSectionHistory((h) => h.slice(0, -1));
                  return;
                }
                // 2. Otherwise leave the tab. Drive the parent tab
                //    navigator directly — this works whether the
                //    screen was reached via a bottom tab tap or the
                //    iOS "More" overflow stack (7 tabs → 5 visible).
                goHomeTab();
              }}
              hitSlop={12}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel={
                sectionHistory.length > 0
                  ? 'Back to previous section'
                  : 'Back to home'
              }
              testID="community-back"
            >
              <Icon name="chevron-left" size={22} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>SPORT MODE</Text>
              <Text style={styles.title}>Community</Text>
            </View>
            <View style={[styles.statePill, { borderColor: `${Colors.states.PEAK.primary}55`, backgroundColor: `${Colors.states.PEAK.primary}15` }]}>
              <Icon name="zap" size={10} color={Colors.states.PEAK.primary} />
              <Text style={[styles.statePillText, { color: Colors.states.PEAK.primary }]}>LIVE</Text>
            </View>
          </View>

          {/* Section selector — horizontal segmented strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionRowContent}
            style={styles.sectionRow}
          >
            {SECTIONS.map((s) => {
              const active = section === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => goToSection(s.key)}
                  style={[styles.sectionBtn, active && styles.sectionBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={s.label}
                  testID={`community-section-${s.key}`}
                >
                  <Icon
                    name={s.icon}
                    size={12}
                    color={active ? Colors.text.primary : Colors.text.muted}
                  />
                  <Text style={[styles.sectionBtnText, active && styles.sectionBtnTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {section === 'rankings' && (
            <RankingsSection
              snapshot={snapshot}
              me={me}
              myTeam={myTeam}
              topCity={topCity}
              featureFlags={featureFlags}
            />
          )}
          {section === 'challenges' && <ChallengesSection />}
          {section === 'battles' && <BattlesSection />}
          {section === 'teams' && (
            <TeamsSection
              teams={snapshot.teams}
              myTeam={myTeam}
              myTeamRank={me.teamRank}
            />
          )}
          {section === 'map' && (
            <MapSection
              cityName={topCity?.name}
              cityScore={topCity?.competitionScore}
              onOpen={() => router.push('/territory')}
            />
          )}
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

// ─── Rankings ──────────────────────────────────────────────────────
interface RankingsProps {
  snapshot: ReturnType<typeof buildSnapshot>;
  me: ReturnType<typeof buildSnapshot>['context'];
  myTeam: CompetitorTeam | undefined;
  topCity: ReturnType<typeof buildSnapshot>['cities'][number] | undefined;
  featureFlags: FeatureFlags;
}

function RankingsSection({ snapshot, me, myTeam, topCity, featureFlags }: RankingsProps) {
  const enabledScopeKinds = React.useMemo<CompetitionScope[]>(() => {
    const out: CompetitionScope[] = [];
    if (featureFlags.city_competition_enabled !== false)    out.push('city');
    if (featureFlags.state_competition_enabled !== false)   out.push('state');
    if (featureFlags.team_competition_enabled !== false)    out.push('team');
    if (featureFlags.global_leaderboard_enabled !== false)  out.push('individual');
    return out;
  }, [featureFlags]);

  const [scope, setScope] = React.useState<CompetitionScope>(
    () => (enabledScopeKinds.includes('individual') ? 'individual' : (enabledScopeKinds[0] ?? 'individual')),
  );
  const effectiveScope: CompetitionScope | null =
    enabledScopeKinds.length === 0
      ? null
      : (enabledScopeKinds.includes(scope) ? scope : enabledScopeKinds[0]);

  const entries: LeaderboardEntry[] = React.useMemo(() => {
    switch (effectiveScope) {
      case 'city':       return snapshot.cities.map(c => ({ kind: 'city',       entry: c } as LeaderboardEntry));
      case 'state':      return snapshot.states.map(s => ({ kind: 'state',      entry: s } as LeaderboardEntry));
      case 'team':       return snapshot.teams.map(t => ({ kind: 'team',        entry: t } as LeaderboardEntry));
      case 'individual': return snapshot.individuals.map(u => ({ kind: 'individual', entry: u } as LeaderboardEntry));
      default:           return [];
    }
  }, [effectiveScope, snapshot]);

  const stateLabelDisplay = me.user.state_label === 'PEAK' ? 'OPTIMAL' : me.user.state_label;

  return (
    <>
      {/* User context card */}
      <View style={[styles.userCard, { borderColor: Colors.border.medium }]}>
        <View style={styles.userTopRow}>
          <View style={[styles.youAvatar, { backgroundColor: Colors.states.PEAK.primary }]}>
            <Text style={styles.youAvatarText}>{me.user.avatarInitials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.userName}>{me.user.name}</Text>
            <Text style={styles.userMeta}>{me.user.city}, {me.user.state} · {stateLabelDisplay}</Text>
          </View>
          <View style={[styles.deltaPill, me.recentDelta > 0 ? { backgroundColor: `${Colors.states.PEAK.primary}1F` } : null]}>
            <Icon name="arrow-up-right" size={11} color={Colors.states.PEAK.primary} />
            <Text style={[styles.deltaText, { color: Colors.states.PEAK.primary }]}>+{me.recentDelta} spots</Text>
          </View>
        </View>
        <View style={styles.userStatsRow}>
          <UserStat label="GLOBAL" value={`#${me.globalRank ?? '—'}`} accent={Colors.states.PEAK.primary} />
          <UserStat label="CITY"   value={`#${me.cityRank ?? '—'}`} />
          <UserStat label="STATE"  value={`#${me.stateRank ?? '—'}`} />
          <UserStat label="TEAM"   value={me.teamRank != null ? `#${me.teamRank}` : '—'} />
          <UserStat label="SCORE"  value={String(me.user.competitionScore)} accent={Colors.states.PEAK.primary} />
        </View>
      </View>

      {snapshot.cityWinsAvailable && topCity && (
        <View style={[styles.celebrate, { borderColor: `${Colors.states.PEAK.primary}55` }]}>
          <Icon name="award" size={14} color={Colors.states.PEAK.primary} />
          <Text style={styles.celebrateText}>
            <Text style={{ color: Colors.states.PEAK.primary, fontFamily: 'Inter_700Bold' }}>{topCity.name}</Text>
            {' leads the country this week.'}
          </Text>
        </View>
      )}

      <View style={styles.scopeRow}>
        {enabledScopeKinds.map((kind) => (
          <Pressable
            key={kind}
            onPress={() => setScope(kind)}
            style={[styles.scopeBtn, effectiveScope === kind && styles.scopeBtnActive]}
          >
            <Text style={[styles.scopeText, effectiveScope === kind && styles.scopeTextActive]}>
              {kind.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {scope === 'team' && myTeam && (
        <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
          <TeamCard team={myTeam} yourRank={me.teamRank} />
        </View>
      )}

      <Leaderboard entries={entries} />

      <Text style={styles.footnote}>
        Re-ranks live as you log intake, complete protocols, and recover.
      </Text>
    </>
  );
}

// ─── Challenges ────────────────────────────────────────────────────
function ChallengesSection() {
  const v = useCircleSubscription();
  const challenges = React.useMemo(() => listChallenges(), [v]);

  if (challenges.length === 0) {
    return (
      <EmptyBlock
        icon="zap"
        title="No open challenges"
        body="When someone in your circle calls you out, it shows up here."
      />
    );
  }
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow="OPEN CHALLENGES"
        title={`${challenges.length} waiting`}
        sub="Tap accept to lock in a 24-hour rivalry."
      />
      {challenges.map((c) => (
        <CircleChallengeCard
          key={c.id}
          challenge={c}
          onAccept={(id) => acceptChallenge(id)}
        />
      ))}
    </View>
  );
}

// ─── Battles ───────────────────────────────────────────────────────
function BattlesSection() {
  const v = useBattlesSubscription();
  const battles = React.useMemo(() => listBattles(), [v]);

  if (battles.length === 0) {
    return (
      <EmptyBlock
        icon="shield"
        title="No live battles"
        body="Region rivalries open at the start of each weekly cycle."
      />
    );
  }
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow="HYDRATION BATTLES"
        title={`${battles.length} live`}
        sub="Pick a side. Your score adds to their total."
      />
      {battles.map((b) => (
        <BattleCard
          key={b.id}
          battle={b}
          onSupport={(id, side) => supportSide(id, side)}
        />
      ))}
    </View>
  );
}

// ─── Teams ─────────────────────────────────────────────────────────
interface TeamsProps {
  teams: CompetitorTeam[];
  myTeam: CompetitorTeam | undefined;
  myTeamRank: number | undefined;
}
function TeamsSection({ teams, myTeam, myTeamRank }: TeamsProps) {
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow="TEAM PERFORMANCE"
        title={`${teams.length} ranked teams`}
        sub="Composite score across performance, compliance, consistency, and recovery."
      />
      {myTeam && <TeamCard team={myTeam} yourRank={myTeamRank} />}
      <View style={styles.teamList}>
        {teams.map((t) => {
          const isMine = myTeam?.id === t.id;
          return (
            <View
              key={t.id}
              style={[
                styles.teamRow,
                isMine && { borderColor: `${Colors.states.PEAK.primary}55` },
              ]}
            >
              <Text style={[styles.teamRank, isMine && { color: Colors.states.PEAK.primary }]}>
                #{t.rank}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{t.name}</Text>
                <Text style={styles.teamMeta}>
                  {t.city} · {t.rosterSize} athletes
                </Text>
              </View>
              <View style={styles.teamScoreCol}>
                <Text style={styles.teamScore}>{t.competitionScore}</Text>
                <Text style={styles.teamTrend}>{trendArrow(t.trend)} {t.trend.toUpperCase()}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Community Maps ────────────────────────────────────────────────
interface MapProps {
  cityName: string | undefined;
  cityScore: number | undefined;
  onOpen: () => void;
}
function MapSection({ cityName, cityScore, onOpen }: MapProps) {
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow="COMMUNITY MAPS"
        title="Territory"
        sub="Stylized hydration map of every city, state and team."
      />
      <Pressable onPress={onOpen} style={styles.mapCard} accessibilityRole="button" accessibilityLabel="Open Territory map">
        <View style={styles.mapHero}>
          <View style={[styles.mapDot, { top: 24,  left: 38, backgroundColor: Colors.states.PEAK.primary }]} />
          <View style={[styles.mapDot, { top: 70,  left: 96, backgroundColor: Colors.states.PEAK.primary }]} />
          <View style={[styles.mapDot, { top: 44,  right: 70, backgroundColor: Colors.states.BALANCED.primary }]} />
          <View style={[styles.mapDot, { bottom: 30, left: 60, backgroundColor: Colors.states.RECOVERING.primary }]} />
          <View style={[styles.mapDot, { bottom: 22, right: 36, backgroundColor: Colors.states.DEPLETED.primary }]} />
          <Text style={styles.mapHeroLabel}>HYDRATION TOPOGRAPHY</Text>
        </View>
        <View style={styles.mapBody}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>
              {cityName ? `${cityName} leading` : 'Live ranking'}
            </Text>
            <Text style={styles.mapSub}>
              {cityScore != null
                ? `Composite score ${cityScore} · tap to explore`
                : 'Tap to explore the full map'}
            </Text>
          </View>
          <Icon name="arrow-up-right" size={18} color={Colors.text.primary} />
        </View>
      </Pressable>
    </View>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────
function UserStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.userStat}>
      <Text style={[styles.userStatValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.userStatLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

function EmptyBlock({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={18} color={Colors.text.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
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

  // Section selector
  sectionRow: { marginBottom: 14 },
  sectionRowContent: { paddingHorizontal: 20, gap: 8 },
  sectionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  sectionBtnActive: {
    backgroundColor: Colors.fill.strong,
    borderColor: Colors.border.medium,
  },
  sectionBtnText: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.8,
  },
  sectionBtnTextActive: { color: Colors.text.primary },

  // Rankings — user card
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

  // Generic stacked-section block
  stack: { paddingHorizontal: 20, gap: 12 },
  sectionHeader: { marginBottom: 4 },
  sectionEyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.4, marginTop: 4 },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 4, lineHeight: 17 },

  // Teams
  teamList: { gap: 8, marginTop: 4 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  teamRank: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text.muted, minWidth: 32 },
  teamName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.2 },
  teamMeta: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 2 },
  teamScoreCol: { alignItems: 'flex-end' },
  teamScore: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.3 },
  teamTrend: { fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.4, marginTop: 2 },

  // Map teaser
  mapCard: {
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  mapHero: {
    height: 160,
    backgroundColor: '#0A0A0A',
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.subtle,
  },
  mapDot: {
    position: 'absolute',
    width: 10, height: 10, borderRadius: 5,
    shadowColor: '#fff', shadowOpacity: 0.6, shadowRadius: 6,
  },
  mapHeroLabel: {
    position: 'absolute', bottom: 12, left: 14,
    fontSize: 9, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 2.4,
  },
  mapBody: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  mapTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.2 },
  mapSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 3 },

  // Empty block
  empty: {
    marginHorizontal: 20, marginTop: 8, padding: 22,
    borderRadius: 18,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.fill.medium,
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.2 },
  emptyBody: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 6, textAlign: 'center', lineHeight: 17 },
});
