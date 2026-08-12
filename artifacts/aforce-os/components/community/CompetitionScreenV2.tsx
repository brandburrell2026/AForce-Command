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
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';

import { GradientBackground } from '@/components/GradientBackground';
import { Leaderboard } from '@/components/Leaderboard';
import { TeamCard } from '@/components/TeamCard';
import { BattleCard } from '@/components/BattleCard';
import { CircleChallengeCard } from '@/components/CircleChallengeCard';
import { useAppStore } from '@/store/useAppStore';
import { buildSnapshot, trendArrow } from '@/services/competitionEngine';
import { af } from '@/theme';
import type { CompetitionScope, LeaderboardEntry, CompetitorTeam } from '@/types/competition';
import type { FeatureFlags } from '@/types';

import { listBattles, supportSide } from '@/services/battleService';
import { listChallenges, acceptChallenge } from '@/services/circleService';
import { useBattlesSubscription, useCircleSubscription } from '@/hooks/useCircleSubscription';

type SectionKey = 'rankings' | 'challenges' | 'battles' | 'teams' | 'map';

// `label` resolves under community.v2.sec_<key> at render.
const SECTIONS: { key: SectionKey; icon: string }[] = [
  { key: 'rankings',   icon: 'bar-chart-2' },
  { key: 'challenges', icon: 'zap' },
  { key: 'battles',    icon: 'shield' },
  { key: 'teams',      icon: 'users' },
  { key: 'map',        icon: 'map' },
];

export function CompetitionScreenV2() {
  const { t } = useTranslation();
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
                  ? t('community.v2.back_prev_a11y')
                  : t('community.v2.back_home_a11y')
              }
              testID="community-back"
            >
              <Icon name="chevron-left" size={22} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t('community.v2.eyebrow')}</Text>
              <Text style={styles.title}>{t('community.v2.title')}</Text>
            </View>
            <View style={[styles.statePill, { borderColor: `${af.green}55`, backgroundColor: `${af.green}15` }]}>
              <Icon name="zap" size={10} color={af.green} />
              <Text style={[styles.statePillText, { color: af.green }]}>{t('community.v2.live')}</Text>
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
                  accessibilityLabel={t(`community.v2.sec_${s.key}`)}
                  accessibilityState={{ selected: active }}
                  testID={`community-section-${s.key}`}
                >
                  <Icon
                    name={s.icon}
                    size={12}
                    color={active ? af.textPrimary : af.textTertiary}
                  />
                  <Text style={[styles.sectionBtnText, active && styles.sectionBtnTextActive]}>
                    {t(`community.v2.sec_${s.key}`)}
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
  const { t } = useTranslation();
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

  const stateLabelDisplay = me.user.state_label === 'PEAK' ? t('community.v2.optimal') : me.user.state_label;

  return (
    <>
      {/* User context card */}
      <View
        style={[styles.userCard, { borderColor: af.border }]}
        accessible
        accessibilityLabel={
          `${me.user.name}, ${me.user.city}, ${me.user.state} · ${stateLabelDisplay}. ` +
          `${t('community.v2.stat_global')} #${me.globalRank ?? '—'}, ` +
          `${t('community.v2.stat_city')} #${me.cityRank ?? '—'}, ` +
          `${t('community.v2.stat_state')} #${me.stateRank ?? '—'}, ` +
          `${t('community.v2.stat_team')} ${me.teamRank != null ? `#${me.teamRank}` : '—'}, ` +
          `${t('community.v2.stat_score')} ${me.user.competitionScore}`
        }
      >
        <View style={styles.userTopRow}>
          <View style={[styles.youAvatar, { backgroundColor: af.green }]}>
            <Text style={styles.youAvatarText}>{me.user.avatarInitials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.userName}>{me.user.name}</Text>
            <Text style={styles.userMeta}>{me.user.city}, {me.user.state} · {stateLabelDisplay}</Text>
          </View>
          {/* The pill only ever says "up" — with no movement there is nothing
              to claim, so it stays off rather than reading "+0 spots". */}
          {me.recentDelta > 0 && (
            <View style={[styles.deltaPill, { backgroundColor: `${af.green}1F` }]}>
              <Icon name="arrow-up-right" size={11} color={af.green} />
              <Text style={[styles.deltaText, { color: af.green }]}>{t('community.v2.spots', { count: me.recentDelta })}</Text>
            </View>
          )}
        </View>
        <View style={styles.userStatsRow}>
          <UserStat label={t('community.v2.stat_global')} value={`#${me.globalRank ?? '—'}`} accent={af.green} />
          <UserStat label={t('community.v2.stat_city')}   value={`#${me.cityRank ?? '—'}`} />
          <UserStat label={t('community.v2.stat_state')}  value={`#${me.stateRank ?? '—'}`} />
          <UserStat label={t('community.v2.stat_team')}   value={me.teamRank != null ? `#${me.teamRank}` : '—'} />
          <UserStat label={t('community.v2.stat_score')}  value={String(me.user.competitionScore)} accent={af.green} />
        </View>
      </View>

      {snapshot.cityWinsAvailable && topCity && (
        <View style={[styles.celebrate, { borderColor: `${af.green}55` }]}>
          <Icon name="award" size={14} color={af.green} />
          <Text style={styles.celebrateText}>
            <Text style={{ color: af.green, fontFamily: 'Inter_700Bold' }}>{topCity.name}</Text>
            {t('community.v2.leads_country')}
          </Text>
        </View>
      )}

      <View style={styles.scopeRow}>
        {enabledScopeKinds.map((kind) => (
          <Pressable
            key={kind}
            onPress={() => setScope(kind)}
            style={[styles.scopeBtn, effectiveScope === kind && styles.scopeBtnActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: effectiveScope === kind }}
          >
            <Text style={[styles.scopeText, effectiveScope === kind && styles.scopeTextActive]}>
              {t(`community.v2.scope_${kind}`)}
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

      <Text style={styles.footnote}>{t('community.v2.rankings_footnote')}</Text>
    </>
  );
}

// ─── Challenges ────────────────────────────────────────────────────
function ChallengesSection() {
  const { t } = useTranslation();
  const v = useCircleSubscription();
  const challenges = React.useMemo(() => listChallenges(), [v]);

  if (challenges.length === 0) {
    return (
      <EmptyBlock
        icon="zap"
        title={t('community.v2.challenges_empty_title')}
        body={t('community.v2.challenges_empty_body')}
      />
    );
  }
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow={t('community.v2.challenges_eyebrow')}
        title={t('community.v2.challenges_waiting', { count: challenges.length })}
        sub={t('community.v2.challenges_sub')}
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
  const { t } = useTranslation();
  const v = useBattlesSubscription();
  const battles = React.useMemo(() => listBattles(), [v]);

  if (battles.length === 0) {
    return (
      <EmptyBlock
        icon="shield"
        title={t('community.v2.battles_empty_title')}
        body={t('community.v2.battles_empty_body')}
      />
    );
  }
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow={t('community.v2.battles_eyebrow')}
        title={t('community.v2.battles_live', { count: battles.length })}
        sub={t('community.v2.battles_sub')}
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
  // aliased to `tr` — the teams.map() callback below binds `t` to a team.
  const { t: tr } = useTranslation();
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow={tr('community.v2.teams_eyebrow')}
        title={tr('community.v2.teams_ranked', { count: teams.length })}
        sub={tr('community.v2.teams_sub')}
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
                isMine && { borderColor: `${af.green}55` },
              ]}
              accessible
              accessibilityLabel={
                `#${t.rank} ${t.name}, ${t.city} · ` +
                `${tr('community.v2.team_athletes', { count: t.rosterSize })}, ` +
                `${t.competitionScore}, ${t.trend.toUpperCase()}`
              }
            >
              <Text style={[styles.teamRank, isMine && { color: af.green }]}>
                #{t.rank}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{t.name}</Text>
                <Text style={styles.teamMeta}>
                  {t.city} · {tr('community.v2.team_athletes', { count: t.rosterSize })}
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
  const { t } = useTranslation();
  return (
    <View style={styles.stack}>
      <SectionHeader
        eyebrow={t('community.v2.map_eyebrow')}
        title={t('community.v2.map_title')}
        sub={t('community.v2.map_sub')}
      />
      <Pressable onPress={onOpen} style={styles.mapCard} accessibilityRole="button" accessibilityLabel={t('community.v2.map_open_a11y')}>
        <View style={styles.mapHero}>
          <HeatBlob top={-20}  left={-10}   color={af.green} />
          <HeatBlob top={30}   left={80}    color={af.green} />
          <HeatBlob top={-10}  right={40}   color={af.cyan} />
          <HeatBlob bottom={-20} left={50}  color={af.amber} />
          <HeatBlob bottom={-10} right={-20} color={af.red} />
          <HeatBlob top={70}   right={-30}  color={af.cyan} />
          <HeatBlob bottom={20} left={-30}  color={af.amber} />
          <View style={styles.mapHeroVignette} pointerEvents="none" />
          <Text style={styles.mapHeroLabel}>{t('community.v2.map_hero')}</Text>
        </View>
        <View style={styles.mapBody}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapTitle}>
              {cityName ? t('community.v2.map_leading', { city: cityName }) : t('community.v2.map_live_ranking')}
            </Text>
            <Text style={styles.mapSub}>
              {cityScore != null
                ? t('community.v2.map_composite', { score: cityScore })
                : t('community.v2.map_tap_explore')}
            </Text>
          </View>
          <Icon name="arrow-up-right" size={18} color={af.textPrimary} />
        </View>
      </Pressable>
    </View>
  );
}

// Heat-map blob — stacked translucent circles approximate a radial glow.
function HeatBlob({
  top, left, right, bottom, color,
}: { top?: number; left?: number; right?: number; bottom?: number; color: string }) {
  const pos = { top, left, right, bottom };
  return (
    <View
      style={[styles.heatBlobWrap, pos]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.heatBlobOuter, { backgroundColor: color }]} />
      <View style={[styles.heatBlobMid,   { backgroundColor: color }]} />
      <View style={[styles.heatBlobCore,  { backgroundColor: color }]} />
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
        <Icon name={icon} size={18} color={af.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  scroll: { flex: 1 },
  content: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  back: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: af.surface },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 2.5 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.6, marginTop: 2 },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  statePillText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },

  // Section selector
  sectionRow: { marginBottom: 14 },
  sectionRowContent: { paddingHorizontal: 20, gap: 8 },
  sectionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
  },
  sectionBtnActive: {
    backgroundColor: af.red,
    borderColor: af.red,
  },
  sectionBtnText: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 1.8,
  },
  sectionBtnTextActive: { color: af.textPrimary },

  // Rankings — user card
  userCard: {
    marginHorizontal: 20, marginBottom: 14, padding: 16, borderRadius: 18,
    backgroundColor: af.surface, borderWidth: 1,
  },
  userTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  youAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  youAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: af.onRed, letterSpacing: 0.5 },
  userName: { fontSize: 17, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.3 },
  userMeta: { fontSize: 11, fontFamily: 'Inter_500Medium', color: af.textTertiary, marginTop: 2 },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  deltaText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  userStatsRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  userStat: { alignItems: 'center', flex: 1 },
  userStatValue: { fontSize: 18, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.4 },
  userStatLabel: { fontSize: 8, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 1.5, marginTop: 2 },

  celebrate: {
    marginHorizontal: 20, marginBottom: 14, padding: 12, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${af.green}10`, borderWidth: 1,
  },
  celebrateText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: af.textPrimary, flex: 1 },

  scopeRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: af.surface, borderRadius: 100, padding: 4 },
  scopeBtn: { flex: 1, paddingVertical: 9, borderRadius: 100, alignItems: 'center' },
  scopeBtnActive: { backgroundColor: af.surfaceRaised },
  scopeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: af.textTertiary, letterSpacing: 0.5 },
  scopeTextActive: { color: af.textPrimary },

  footnote: { fontSize: 11, fontFamily: 'Inter_400Regular', color: af.textTertiary, textAlign: 'center', paddingHorizontal: 28, marginTop: 16, lineHeight: 16 },

  // Generic stacked-section block
  stack: { paddingHorizontal: 20, gap: 12 },
  sectionHeader: { marginBottom: 4 },
  sectionEyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 2.5 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.4, marginTop: 4 },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: af.textTertiary, marginTop: 4, lineHeight: 17 },

  // Teams
  teamList: { gap: 8, marginTop: 4 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
  },
  teamRank: { fontSize: 15, fontFamily: 'Inter_700Bold', color: af.textTertiary, minWidth: 32 },
  teamName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.2 },
  teamMeta: { fontSize: 11, fontFamily: 'Inter_500Medium', color: af.textTertiary, marginTop: 2 },
  teamScoreCol: { alignItems: 'flex-end' },
  teamScore: { fontSize: 18, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.3 },
  teamTrend: { fontSize: 9, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 1.4, marginTop: 2 },

  // Map teaser
  mapCard: {
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
  },
  mapHero: {
    height: 160,
    backgroundColor: '#0A0A0A',
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: af.divider,
  },
  mapDot: {
    position: 'absolute',
    width: 10, height: 10, borderRadius: 5,
    shadowColor: '#fff', shadowOpacity: 0.6, shadowRadius: 6,
  },
  heatBlobWrap: {
    position: 'absolute',
    width: 90, height: 90,
    alignItems: 'center', justifyContent: 'center',
  },
  heatBlobOuter: {
    position: 'absolute',
    width: 90, height: 90, borderRadius: 45,
    opacity: 0.08,
  },
  heatBlobMid: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 22,
    opacity: 0.16,
  },
  heatBlobCore: {
    position: 'absolute',
    width: 10, height: 10, borderRadius: 5,
    opacity: 0.95,
  },
  mapHeroVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0A',
    opacity: 0.55,
  },
  mapHeroLabel: {
    position: 'absolute', bottom: 12, left: 14,
    fontSize: 9, fontFamily: 'Inter_700Bold',
    color: af.textTertiary, letterSpacing: 2.4,
  },
  mapBody: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  mapTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.2 },
  mapSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: af.textTertiary, marginTop: 3 },

  // Empty block
  empty: {
    marginHorizontal: 20, marginTop: 8, padding: 22,
    borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: af.surface,
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.2 },
  emptyBody: { fontSize: 12, fontFamily: 'Inter_400Regular', color: af.textTertiary, marginTop: 6, textAlign: 'center', lineHeight: 17 },
});
