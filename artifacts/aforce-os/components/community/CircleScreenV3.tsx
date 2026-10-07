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
 * Wave 5 turned the certainty hierarchy back the right way up. It had been
 * inverted: the least-evidenced numbers were the loudest. The one number with
 * a real source — your own score — now dominates the You card, the four
 * cohort-relative ranks sit beneath it in supporting weight, the sample-data
 * caption reads as the standings' caption instead of the faintest line on the
 * page, and the eyebrow no longer says "LIVE" over a sample roster.
 *
 * The Wave-5 tail closed the last of it at the ROW. A caption can go unread,
 * and every roster row still wore the grammar of a real leaderboard — avatar,
 * name, score, movement — with nothing separating an invented person from the
 * member's own row but a green tint. Now each sample row carries a neutral
 * SAMPLE tag that a screen reader speaks too, and the Verified badge (a
 * credential, i.e. social proof) can no longer render over one: the view model
 * refuses it. The founder's cohort and comp layout are untouched — nobody was
 * deleted, nothing was invented, the presentation just stopped implying that
 * these are members you are actually competing against.
 *
 * Black Issue restyle (2026-10-06, docs/black-issue-restyle-plan.md §4 item 4):
 * presentation only. AFMasthead head (breadcrumb + statement), the You card
 * as an AFCard (alert variant when the band is Depleted — the band word keeps
 * its status-system colour), mono-micro filter pills, a hairline weekly
 * challenge card, a red STANDINGS section header over hairline rows, and the
 * member's own row outlined in the alert hairline. Nothing about the cohort,
 * the ranking, the disclosure tags or the row announcements changed.
 *
 * `fixture` exists ONLY for the demo gallery / tests (production builds never
 * pass it): it supplies the full inputs and skips every live source. Tab
 * switching stays interactive in both modes.
 */
import React from 'react';
import { circleMembershipPilotAvailable } from '@/featureFlags/flags';
import { CircleMembersPanel } from './CircleMembersPanel';
import { useFeatureFlags } from '@/store/useAppStore';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';

import { AFScreen, AFMasthead, AFCard, AFSectionLabel, AFEmptyState, AFStatPair } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { af, afType, afLayout, afAlpha, withAlpha, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { useEngineSlice, useUserSlice } from '@/store/slices';
import { buildSnapshot } from '@/services/competitionEngine';
import { fetchJournalRollups } from '@/services/realApi';
import { hasHydroStateObservation } from '@/utils/scoring/boundarySeries';
import type { JournalRollup } from '@/types';
import { useRouter } from 'expo-router';
import {
  buildCircleV3Model,
  circleRowA11yLabel,
  type CircleRowA11yStrings,
  type CircleTab,
  type CircleV3Inputs,
  type CircleV3RowView,
} from './circleV3Presentation';

const TABS: CircleTab[] = ['rank', 'cities', 'friends', 'challenge'];

export function CircleScreenV3({ fixture }: { fixture?: CircleV3Inputs }) {
  const router = useRouter();
  const flags = useFeatureFlags();
  const membershipPilot = !fixture && circleMembershipPilotAvailable(flags);
  const tabClearance = useTabBarClearance();
  const { t } = useTranslation();
  const eyebrowType = useAFEyebrowType();
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const [tab, setTab] = React.useState<CircleTab>(fixture?.tab ?? 'rank');

  const [rollupDays, setRollupDays] = React.useState<number | null>(null);
  const [rollupsFailed, setRollupsFailed] = React.useState(false);
  React.useEffect(() => {
    if (fixture) return;
    let cancelled = false;
    fetchJournalRollups(7)
      .then((rollups: JournalRollup[]) => {
        if (cancelled) return;
        // Explicit observation gate — see countLoggedRollupDays. The dense
        // wire materialises days the member was never measured on, and this
        // must not count them as ritual days.
        setRollupDays(
          rollups.filter((r) => hasHydroStateObservation(r) && r.endUnitsConsumed > 0).length,
        );
      })
      .catch(() => {
        // S2-7: the bar being silently absent was indistinguishable from
        // "no challenge this week" — a failed fetch now says so in words.
        if (!cancelled) setRollupsFailed(true);
      });
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

  // A tab press swaps every row underneath a heading that never changes —
  // visible to the eye, silent to a screen reader. Announce the new scope
  // once per change, never on mount (focus already reads the pressed tab).
  // Ref-guarded exactly like RiskTimerDisplay's ~:58-79: no live region
  // exists on this screen, so this covers iOS and Android alike.
  const tabAnnouncement = t('community.v3.tab_announce', {
    tab: t(`community.v3.tab_${tab}`),
  });
  const tabAnnouncementRef = React.useRef(tabAnnouncement);
  tabAnnouncementRef.current = tabAnnouncement;
  // Holds the tab last spoken rather than a bare "mounted" flag, so
  // StrictMode's double-invoked mount effect cannot speak a change that
  // never happened.
  const announcedTabRef = React.useRef<CircleTab | null>(null);
  React.useEffect(() => {
    if (announcedTabRef.current === tab) return;
    const first = announcedTabRef.current === null;
    announcedTabRef.current = tab;
    if (first) return;
    try {
      AccessibilityInfo.announceForAccessibility(tabAnnouncementRef.current);
    } catch { /* no-op on web */ }
  }, [tab]);

  const rowLabels = React.useMemo<CircleRowA11yStrings>(
    () => ({
      rank: (n) => t('community.v3.row_rank', { n }),
      you: t('community.v3.row_you'),
      sample: t('community.v3.row_sample_a11y'),
      verified: t('community.v3.row_verified'),
      score: (n) => t('community.v3.row_score', { n }),
      moveUp: (n) => t('community.v3.row_move_up', { count: n }),
      moveDown: (n) => t('community.v3.row_move_down', { count: n }),
      moveFlat: t('community.v3.row_move_flat'),
    }),
    [t],
  );

  return (
    <AFScreen scroll contentContainerStyle={{ paddingBottom: tabClearance }}>
      {/* Masthead: wordmark + red breadcrumb. The statement sits in its own row
          (below) so the community-sharing entry can share its line, exactly as
          the reference's PRIVATE control does. */}
      <AFMasthead breadcrumb={t('community.v3.eyebrow')} />
      <View style={styles.statementRow}>
        <Text
          style={styles.statement}
          accessibilityRole="header"
          maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        >
          {t('community.v3.title')}
        </Text>
        {/* Same entry the shield top-bar action was — one route, no new state.
            The reference's PRIVATE checkbox would need a visibility-scope read
            this screen does not make today, so this control only navigates. */}
        <Pressable
          onPress={() => router.push('/privacy/community-sharing')}
          accessibilityRole="button"
          accessibilityLabel={t('communitySharing.entry_title')}
          hitSlop={8}
          style={styles.shareBtn}
          testID="circle-v3-sharing"
        >
          <View style={styles.shareBox}>
            <Icon name="shield" size={12} color={af.textSecondary} />
          </View>
          <Text style={[styles.shareLabel, eyebrowType]}>
            {t('community.v3.sharing_label').toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {/* You card — comp layout, live-injected row underneath. Depleted takes
          the alert surface; every other band keeps the standard surface with a
          hairline in the band's own system colour. */}
      <AFCard
        variant={you.bandKey === 'depleted' ? 'alert' : 'standard'}
        style={[
          styles.youCard,
          you.bandKey !== 'depleted' && { borderColor: withAlpha(you.accent, afAlpha.a34) },
        ]}
        testID="circle-v3-you"
      >
        <View style={styles.youTop}>
          <View style={[styles.youAvatar, { backgroundColor: you.accent }]}>
            {/* Ink on the band fill: white on Signal Red (5.85:1), canvas black elsewhere. */}
            <Text style={[styles.youAvatarText, { color: you.accent === af.red ? af.onRed : af.canvas }]}>{you.initials}</Text>
          </View>
          <View style={styles.youWho}>
            <Text style={styles.youName}>{you.name}</Text>
            <Text style={styles.youMeta}>
              {you.cityLine} · <Text style={{ color: you.accent }}>{t(`community.v3.band_${you.bandKey}`)}</Text>
            </Text>
          </View>
          {you.deltaSpots != null ? (
            /* The arrow glyph was the only thing saying WHICH WAY this moved,
               and a bare "↑" is read inconsistently (or skipped) by screen
               readers — the same defect already fixed on the leader rows, whose
               `row_move_up` / `row_move_down` strings this reuses rather than
               inventing a second vocabulary for the same fact. */
            <View
              style={styles.spotsPill}
              accessible
              accessibilityLabel={t(
                you.deltaSpots > 0 ? 'community.v3.row_move_up' : 'community.v3.row_move_down',
                { count: Math.abs(you.deltaSpots) },
              )}
            >
              <Text style={[styles.spotsText, eyebrowType]}>
                {you.deltaSpots > 0 ? '↑' : '↓'} {t('community.v3.spots', { n: Math.abs(you.deltaSpots) })}
              </Text>
            </View>
          ) : null}
        </View>
        {/* Comp layout kept — five columns, same order. What changed is
            weight: the four ranks are positions inside a SAMPLE cohort, the
            score is yours and real, so the real number is the loud one. */}
        <View style={styles.statsRow}>
          <RankStat value={fmtRank(you.globalRank)} label={t('community.v3.stat_global')} />
          <RankStat value={fmtRank(you.cityRank)} label={t('community.v3.stat_city')} />
          <RankStat value={fmtRank(you.stateRank)} label={t('community.v3.stat_state')} />
          <RankStat value={fmtRank(you.teamRank)} label={t('community.v3.stat_team')} />
          <ScoreStat value={String(you.score)} label={t('community.v3.stat_score')} accent={you.accent} />
        </View>
      </AFCard>

      {/* Sample-cohort caption. The cohort stays (founder ruling), but the
          standings it produces — the rank stats above, the rows below — are
          not a measurement of real people, and the screen has to say so. */}
      <Text style={styles.sampleNote} testID="circle-v3-sample-note">
        {t('community.v3.sample_note')}
      </Text>

      {/* Scope tabs — AFSegmentedControl's pill language (mono micro caps,
          hairline idle, filled-red active). Kept inline rather than adopting
          the primitive: this rail needs a per-tab testID and the tablist
          hitSlop locked by the Wave-5 a11y tests, neither of which
          AFSegmentedControl exposes. */}
      <View style={styles.tabsRow} accessibilityRole="tablist" testID="circle-v3-tabs">
        {TABS.map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tabPill, tab === key && styles.tabPillOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            // 9pt padding + an 18pt caption line is ~36pt; hitSlop carries the
            // touchable area to the 44pt minimum without changing the comp.
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            testID={`circle-v3-tab-${key}`}
          >
            <Text style={[styles.tabText, eyebrowType, tab === key && styles.tabTextOn]}>
              {t(`community.v3.tab_${key}`).toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Weekly challenge — own-baseline hydration, real rollups only */}
      {model.challengePct != null ? (
        <AFCard style={styles.challenge} testID="circle-v3-challenge">
          <View style={styles.challengeTop}>
            <Text style={styles.challengeTitle}>{t('community.v3.challenge_title')}</Text>
            <Text style={styles.challengePct}>{model.challengePct}%</Text>
          </View>
          <View style={styles.challengeTrack}>
            <View style={[styles.challengeFill, { width: `${model.challengePct}%` }]} />
          </View>
          {model.tab === 'challenge' && model.hydrationDays != null ? (
            <Text style={styles.challengeDetail}>
              {t('community.v3.challenge_detail', { n: model.hydrationDays })}
            </Text>
          ) : null}
        </AFCard>
      ) : rollupsFailed ? (
        <Text style={styles.challengeUnavailable} testID="circle-v3-challenge-unavailable">
          {t('community.v3.challenge_unavailable')}
        </Text>
      ) : null}

      {/* Leaderboard — red STANDINGS header over hairline rows */}
      {model.tab === 'friends' && membershipPilot ? <CircleMembersPanel /> : model.rows.length > 0 ? (
        <View style={styles.standings}>
          <AFSectionLabel
            label={t('community.v3.standings')}
            meta={t('community.v3.standings_meta', { n: model.rows.length })}
            testID="circle-v3-standings-label"
          />
          <View style={styles.list} testID="circle-v3-list">
            {model.rows.map((row) => (
              <LeaderRow
                key={row.key}
                row={row}
                streakLabel={(n) => t('community.v3.streak_days', { n })}
                streakStart={t('community.v3.streak_start')}
                sampleLabel={t('community.v3.row_sample')}
                labels={rowLabels}
              />
            ))}
          </View>
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

/*
 * A11y fix (Wave-5 Phase-1 pass): both stats were a bare numeral Text over a
 * bare label Text — exactly the ~18-call-site defect `AFStatPair` was built to
 * end (see its doc-comment). VoiceOver read the you-card's five columns as ten
 * disconnected fragments ("#12" … "GLOBAL"), while the leader rows underneath
 * — the SAME information — had already been collapsed to one sentence each.
 * Adopting the primitive composes each column into "GLOBAL, #12" and brings the
 * numerals under the display font-scale ceiling. Visual output is unchanged:
 * `styles.stat` is applied last so its `alignItems: 'center'` and `gap` still
 * win, and the value/label styles are passed straight through.
 */

/** A position inside the sample cohort — supporting weight, never the accent. */
function RankStat({ value, label }: { value: string; label: string }) {
  return (
    <AFStatPair
      label={label}
      value={value}
      direction="column"
      reverseOrder
      style={styles.stat}
      valueStyle={styles.statValue}
      labelStyle={styles.statLabel}
    />
  );
}

/** The one measured number on the screen — sized and tinted to say so. */
function ScoreStat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <AFStatPair
      label={label}
      value={value}
      direction="column"
      reverseOrder
      style={styles.stat}
      valueStyle={[styles.scoreValue, { color: accent }]}
      labelStyle={styles.scoreLabel}
    />
  );
}

function LeaderRow({
  row,
  streakLabel,
  streakStart,
  sampleLabel,
  labels,
}: {
  row: CircleV3RowView;
  streakLabel: (n: number) => string;
  /** Zero-streak phrasing for the member's own row ("Start your streak"). */
  streakStart: string;
  /** Visible SAMPLE tag copy (the spoken counterpart lives in `labels`). */
  sampleLabel: string;
  labels: CircleRowA11yStrings;
}) {
  const eyebrowType = useAFEyebrowType();
  const streakText =
    row.streakDays == null
      ? null
      : row.isYou && row.streakDays === 0
        ? streakStart
        : streakLabel(row.streakDays);
  const subtitle = streakText != null ? `${row.subtitleLeft} · ${streakText}` : row.subtitleLeft;
  return (
    // One element, one sentence. The row used to be six-plus loose Texts that
    // VoiceOver read as fragments; `accessible` collapses them, which also
    // answers the Verified badge — it needs no label of its own now that the
    // word is spoken here (AFCard's fix set `accessible` because a card is the
    // group; here the ROW is the group, and a second element inside it would
    // only re-fragment what this label just assembled).
    <View
      style={[styles.row, row.isYou && styles.rowYou]}
      accessible
      accessibilityLabel={circleRowA11yLabel(row, subtitle, labels)}
    >
      <Text style={[styles.rowRank, row.isYou && styles.rowRankYou]}>{row.rank}</Text>
      {/* Reference avatars are hairline rings with mono initials; the member's
          own row is the one filled avatar (band accent, same as the You card). */}
      <View
        style={[
          styles.rowAvatar,
          row.isYou && { backgroundColor: row.scoreAccent, borderColor: row.scoreAccent },
        ]}
      >
        {/* Ink on the band fill: white on the Signal Red fill (5.85:1); the
            canvas black on every other accent (#1088 review B3). */}
        <Text style={[styles.rowAvatarText, row.isYou && { color: row.scoreAccent === af.red ? af.onRed : af.canvas }]}>
          {row.initials}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName}>{row.name}</Text>
          {/* Green text and a green row tint were the ONLY marks saying which
              row is yours — invisible to anyone who cannot separate the hues.
              The tag says it in words; the outline now merely reinforces it. */}
          {row.isYou ? <Text style={styles.youTag}>{labels.you}</Text> : null}
          {/* The row-level half of the sample disclosure. The caption above the
              standings qualifies the LIST; this qualifies the PERSON, at the
              only moment a member is actually reading their name. Deliberately
              neutral — no hue, no glyph, no icon — so it cannot be mistaken for
              a status, a badge or an achievement, and so the member's own row
              (alert outline, YOU tag) stays the loud one. */}
          {row.isSample ? <Text style={styles.sampleTag}>{sampleLabel}</Text> : null}
          {/* Reachable only for a row the member's own data backs: the view
              model forces `verified` false on every sample row, because a
              credential over an invented person is the one mark here that
              reads as proof rather than decoration. */}
          {row.verified ? (
            <View style={styles.verified}>
              <Text style={styles.verifiedGlyph}>✓</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.rowSub, eyebrowType]}>{subtitle}</Text>
      </View>
      <Text style={[styles.rowScore, { color: row.scoreAccent }]}>{row.score}</Text>
      <Text
        style={[
          styles.rowMove,
          row.move.dir === 'up' && styles.rowMoveUp,
          row.move.dir === 'down' && styles.rowMoveDown,
        ]}
      >
        {row.move.dir === 'up' ? `+${row.move.n}` : row.move.dir === 'down' ? `−${row.move.n}` : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statementRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
  },
  statement: { ...afType.title1, color: af.textPrimary, flexShrink: 1 },
  // Footprint of the reference's PRIVATE checkbox: a 22pt outlined square over
  // a mono micro label; the 44pt floor comes from minWidth/minHeight + hitSlop.
  shareBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4 },
  shareBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: af.border,
    alignItems: 'center', justifyContent: 'center',
  },
  shareLabel: { ...afType.micro, color: af.textTertiary },
  youCard: { marginTop: 20, padding: 16, borderRadius: afLayout.radiusCard },
  youTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  youAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  youAvatarText: { ...afType.bodyStrong, color: af.canvas, letterSpacing: 1 },
  youWho: { flex: 1, gap: 2 },
  youName: { ...afType.title3, color: af.textPrimary },
  youMeta: { ...afType.caption, color: af.textSecondary },
  spotsPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, borderColor: withAlpha(af.green, afAlpha.a34),
  },
  spotsText: { ...afType.micro, color: af.green, fontVariant: ['tabular-nums'] },
  statsRow: {
    flexDirection: 'row', marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: af.divider,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  // Ranks: smaller than the score and in supporting colour. They were title3 in
  // textPrimary — the same size as the score, and GLOBAL even wore the band
  // accent, which dressed a sample-cohort position up as a measurement.
  statValue: { ...afType.title3, color: af.textSecondary, fontVariant: ['tabular-nums'] },
  statLabel: { ...afType.micro, color: af.textTertiary },
  scoreValue: { ...afType.title2, fontVariant: ['tabular-nums'] },
  scoreLabel: { ...afType.micro, color: af.textSecondary },
  // The caption belongs to the standings above it, so it is set as one: a
  // rule tying it to the block, secondary text, one step up in size. It was
  // tertiary caption — the dimmest type on a screen full of ranks it
  // qualifies. Still quieter than any number; just no longer deniable.
  sampleNote: {
    ...afType.secondary,
    color: af.textSecondary,
    marginTop: 12,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: af.border,
  },
  // Wraps rather than scrolls: four pills fit a 390 phone on one line, and at
  // larger Dynamic Type the last one drops to a second line instead of clipping.
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  tabPill: {
    minHeight: 34, paddingHorizontal: 12, paddingVertical: 9, borderRadius: afLayout.radiusPill,
    justifyContent: 'center', borderWidth: 1, borderColor: af.border,
  },
  tabPillOn: { backgroundColor: af.red, borderColor: af.red },
  tabText: { ...afType.micro, color: af.textSecondary },
  tabTextOn: { color: af.onRed },
  challenge: { marginTop: 16, padding: 16, gap: 12 },
  challengeTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  challengeTitle: { ...afType.bodyStrong, color: af.textPrimary, flexShrink: 1 },
  challengePct: { ...afType.bodyStrong, color: af.textSecondary, fontVariant: ['tabular-nums'] },
  // Hairline progress: a 2pt rule with a red fill (was an 8pt amber gradient bar).
  challengeTrack: { height: 2, backgroundColor: af.divider, overflow: 'hidden' },
  challengeFill: { height: '100%', backgroundColor: af.red },
  challengeUnavailable: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  challengeDetail: { ...afType.caption, color: af.textTertiary },
  standings: { marginTop: 24 },
  list: { marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: af.divider,
  },
  // The member's own row: alert surface + red hairline outline. Every border
  // is set explicitly so the row's own bottom rule cannot override the outline.
  rowYou: {
    marginTop: 8, paddingHorizontal: 12, borderRadius: afLayout.radiusCard,
    backgroundColor: af.surfaceAlert, borderWidth: 1, borderColor: af.borderAlert,
    borderBottomWidth: 1, borderBottomColor: af.borderAlert,
  },
  // Founder fix 2026-08-27: two-digit ranks wrapped vertically in a 22pt
  // column — minWidth lets the cell grow so 10+ (and 100+) stay on one line.
  rowRank: { ...afType.secondary, color: af.textTertiary, minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
  rowRankYou: { color: af.redText },
  rowAvatar: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: af.border,
  },
  rowAvatarText: { ...afType.eyebrow, color: af.textPrimary, letterSpacing: 0.5 },
  rowBody: { flex: 1, gap: 2 },
  rowNameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  rowName: { ...afType.bodyStrong, color: af.textPrimary },
  youTag: {
    ...afType.micro, color: af.redText, textTransform: 'uppercase',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
    borderWidth: 1, borderColor: af.red,
  },
  // Same pill geometry as youTag so the two read as one vocabulary, but with
  // the neutral line/text tokens: this marks provenance, not a state, and it
  // must never out-shout the member's own row.
  sampleTag: {
    ...afType.micro, color: af.textTertiary, textTransform: 'uppercase',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
    borderWidth: 1, borderColor: af.border,
  },
  verified: { width: 16, height: 16, borderRadius: 8, backgroundColor: af.cyan, alignItems: 'center', justifyContent: 'center' },
  verifiedGlyph: { color: af.canvas, fontSize: 10, fontWeight: '700' },
  rowSub: { ...afType.micro, color: af.textTertiary, textTransform: 'uppercase' },
  rowScore: { ...afType.title3, fontVariant: ['tabular-nums'] },
  rowMove: { ...afType.eyebrow, letterSpacing: 0, color: af.textTertiary, width: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rowMoveUp: { color: af.green },
  rowMoveDown: { color: af.redText },
  footnote: { ...afType.caption, color: af.textTertiary, marginTop: 14 },
});
