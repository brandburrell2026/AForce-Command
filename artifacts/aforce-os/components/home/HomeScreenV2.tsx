/**
 * HomeScreenV2 — the Phase 2 · S3 Home redesign (spec §8.2), rendered only when
 * `spec_home` is on. The spec's reduced hierarchy: wordmark + freshness →
 * dominant readiness value with a thin arc → one "Your next move" command card →
 * three quiet signal metrics. One score, one command, one CTA.
 *
 * Same live engine data as the legacy Home (score, command, signals) — no
 * scoring change (statusColor/scoringEngine untouched).
 *
 * HONEST STATUS (RC-1 verdict-pass correction — a prior version of this
 * comment claimed the legacy Home's four detail zones were "relocated" into
 * Readiness Insights with "nothing missing," then a later version claimed
 * they were "still reachable" because `spec_home` defaults OFF; both claims
 * are false): the legacy Home's four detail zones — MetabolicReadinessZone,
 * PerformanceAgeZone, VoiceCheckInZone, ActivationJourneyZone (all in
 * components/home/) — are rendered ONLY by HomeScreenLegacy
 * (`components/home/HomeScreenLegacy.tsx`, React.lazy-loaded from
 * `app/(tabs)/index.tsx`). Tapping the arc opens Readiness Insights, which
 * shows a chart + drivers + insight, not those four zones.
 *
 * `featureFlags/flags.ts` sets `spec_home: true` in `DEFAULT_FLAGS`, and
 * `app/(tabs)/index.tsx`'s `HomeScreen` is a ternary —
 * `specHome ? <HomeScreenV2 /> : <HomeScreenLegacy />` — that
 * renders EITHER this component OR the legacy screen, never both. There is
 * no code path today where both render "alongside" each other. That means
 * the four legacy detail zones are ALREADY orphaned/unreachable in today's
 * default build, not merely "at risk of becoming orphaned" on some future
 * flag flip. Restoring them (in some form, somewhere) or explicitly retiring
 * them needs a founder decision — this file must not claim that decision
 * has already happened, and must not understate that the orphaning has
 * already occurred.
 *
 * E1 — Elite Home (flag `elite_home_experience_enabled`, default OFF):
 * PRESENTATION-ONLY elevation layered on the exact same data. When the flag is
 * off the render below is byte-for-byte the shipped Home. When on, it adds a
 * band-tinted arc accent, a ring reveal + truthful score count-up, staggered
 * entrance, and band-aware signal ordering — all decided by the pure, tested
 * `homePresentation.ts`. It never touches the score, command, eligibility,
 * timing, or safety logic (Score-Protection); reduced-motion collapses every
 * animation back to the static Home.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/expo';
import Animated, {
  FadeInDown,
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';

import {
  AFScreen,
  AFReadinessArc,
  AFCommandCard,
  AFSectionLabel,
  AFOfflineBanner,
} from '@/components/ui';
import { useRouter } from 'expo-router';
import { af, afType, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { useAppStore, useFeatureFlags } from '@/store/useAppStore';
import { useEngineSlice, useActionsSlice } from '@/store/slices';
import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';
import { HomeSkeleton } from './HomeSkeleton';
import { parseEngineActionCopy, parseDoseOz } from '@/utils/recovery/recoveryCommandFromStore';
import {
  resolveHomePresentation,
  resolveArcAnimation,
  type SignalKey,
} from './homePresentation';
import { findVoice } from '@/services/voiceCatalog';
import { coachEyebrow, coachLead, formatCommandForCoach } from '@/services/voice/coachPhrasing';
import type { FluidType } from '@/types';
import { LiveStatusLine } from './LiveStatusLine';
import { useScoreTrend } from '@/hooks/useScoreTrend';
import { getStatusVerb } from '@/services/statusVerb';

interface HomeActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
}

/** Heat-load band → i18n key suffix (translated at the call site). */
function heatBand(heatLoad: number): 'high' | 'moderate' | 'low' {
  if (heatLoad >= 60) return 'high';
  if (heatLoad >= 30) return 'moderate';
  return 'low';
}

function titleCase(level: string): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

/** Compact signal tile — fixed-width column so word values never collide. */
function Signal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signal} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.signalLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.signalValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/**
 * Elite score numeral — counts up between two *real* values (never from zero),
 * else renders the value outright. Reduced-motion is handled upstream by
 * `countUp=false`. Presentation-only; the value shown is the engine's score.
 */
function EliteScoreNumber({
  score,
  fromScore,
  countUp,
  style,
}: {
  score: number;
  fromScore: number;
  countUp: boolean;
  style: StyleProp<TextStyle>;
}) {
  const sv = useSharedValue(countUp ? fromScore : score);
  const [shown, setShown] = React.useState(countUp ? Math.round(fromScore) : score);
  React.useEffect(() => {
    if (countUp) {
      sv.value = fromScore;
      sv.value = withTiming(score, { duration: 900, easing: Easing.out(Easing.cubic) });
    } else {
      sv.value = score;
      setShown(score);
    }
  }, [score, fromScore, countUp, sv]);
  useAnimatedReaction(
    () => sv.value,
    (v) => runOnJS(setShown)(Math.round(v)),
  );
  return (
    <Text style={style} numberOfLines={1} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
      {shown}
    </Text>
  );
}

export function HomeScreenV2() {
  const { t } = useTranslation();
  const { state, selectedVoiceId, isHydrated } = useAppStore();
  const engine = useEngineSlice();
  const flags = useFeatureFlags();
  const { logIntake } = useActionsSlice<HomeActions>();
  const clerkUser = useUser().user;
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  // RC-1 Wave-2B (item 1) — offline intake outbox visibility. Flag-gated:
  // while `offline_intake_outbox_enabled` is off the outbox is never
  // hydrated/written (see `services/intakeOutbox.ts`), so this stays at its
  // inert 0/false default and `AFOfflineBanner` renders nothing.
  const outboxState = useIntakeOutboxStore();
  const outboxPendingCount = flags.offline_intake_outbox_enabled ? selectPendingCount(outboxState) : 0;
  const outboxHasFailedItem = flags.offline_intake_outbox_enabled ? selectHasFailedItem(outboxState) : false;

  const { userState } = state;
  const score = Math.max(0, Math.min(100, Math.round(engine.score)));
  const { title, instruction } = parseEngineActionCopy(engine.command.action);
  const hydrationPct =
    userState.dailyTarget > 0
      ? Math.round((userState.unitsConsumedToday / userState.dailyTarget) * 100)
      : 0;
  const greeting = clerkUser?.firstName ?? t('home.v2.greeting_default');

  // ── E1 elite presentation (flag-gated, presentation-only) ──────────────────
  const elite = flags.elite_home_experience_enabled;
  const presentation = resolveHomePresentation(engine.performanceState.level);
  const prevScoreRef = React.useRef<number | null>(null);
  const arcPlan = resolveArcAnimation({
    elite,
    reducedMotion,
    score,
    prevScore: prevScoreRef.current,
  });
  React.useEffect(() => {
    prevScoreRef.current = score;
  }, [score]);

  const accent = elite ? presentation.accent : af.red;
  const reveal = (idx: number) =>
    elite && !reducedMotion ? FadeInDown.duration(420).delay(idx * 90) : undefined;

  // RC-1 fix (P0 vs founder's 3-second brief): momentum was missing from
  // Home — the tested, existing `LiveStatusLine` (trend arrow + delta
  // window + status verb) lived only on the legacy Home. Same hook/service
  // pair the legacy screen uses (app/(tabs)/index.tsx), tinted with V2's own
  // `accent` so it stays in this screen's spare visual language instead of
  // reaching into the legacy band-color selector.
  const trend = useScoreTrend(score);
  const statusVerb = React.useMemo(
    () => getStatusVerb(engine.performanceState.level, trend.direction),
    [engine.performanceState.level, trend.direction],
  );

  // ── E4 elite voice-coach delivery (flag-gated; phrasing/delivery ONLY) ──────
  // Same command/dose/timing/evidence for every coach — only the eyebrow + tone
  // change, via the fail-safe, §64-guarded coachPhrasing adapter.
  const voiceElite = flags.elite_voice_coach_enabled;
  const archetype = findVoice(selectedVoiceId)?.archetype ?? 'push';
  const commandEyebrow = voiceElite ? coachEyebrow(archetype) : undefined;
  const commandInstruction = voiceElite
    ? instruction
      ? formatCommandForCoach(instruction, archetype)
      : coachLead(archetype)
    : instruction;

  const signalTiles: Record<SignalKey, React.ReactNode> = {
    hydration: <Signal label={t('home.v2.signal_hydration')} value={`${hydrationPct}%`} />,
    heat: <Signal label={t('home.v2.signal_heat')} value={t(`home.v2.heat_${heatBand(userState.heatLoad)}`)} />,
    recovery: <Signal label={t('home.v2.signal_recovery')} value={titleCase(engine.performanceState.level)} />,
  };
  const signalOrder: SignalKey[] = elite
    ? presentation.signalOrder
    : ['hydration', 'heat', 'recovery'];

  return (
    <AFScreen scroll>
      {/* Wordmark + freshness */}
      <Animated.View entering={reveal(0)} style={styles.header}>
        <Text style={styles.welcome}>{t('home.welcome', { name: greeting })}</Text>
        <Text style={styles.brand}>{t('home.subtitle_title')}</Text>
        <Text style={styles.freshness}>{t('home.v2.freshness')}</Text>
      </Animated.View>

      {/* RC-1 Wave-2B (item 1) — offline intake outbox visibility. */}
      <AFOfflineBanner pendingCount={outboxPendingCount} hasFailedItem={outboxHasFailedItem} />

      {!isHydrated ? (
        <HomeSkeleton />
      ) : (
        <>
          {/* Dominant readiness value + thin arc (tap → insights) */}
          <Animated.View entering={reveal(1)}>
            <Pressable
              style={styles.arcWrap}
              onPress={() => router.push('/weekly-report')}
              accessibilityRole="button"
              accessibilityLabel={`${t('home.v2.readiness_a11y', { score })} ${engine.performanceState.level}`}
              testID="home-readiness-arc"
            >
              <AFReadinessArc score={score} size={240} color={accent} animate={arcPlan.animateRing} alive={elite}>
                {elite ? (
                  <EliteScoreNumber
                    score={score}
                    fromScore={arcPlan.fromScore}
                    countUp={arcPlan.countUp}
                    style={styles.score}
                  />
                ) : (
                  <Text style={styles.score} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{score}</Text>
                )}
                <Text style={styles.scoreLabel}>{t('home.v2.readiness_label')}</Text>
                {elite ? (
                  <View style={[styles.statePill, { borderColor: accent }]}>
                    <Text style={[styles.statePillText, { color: accent }]}>
                      {engine.performanceState.level}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.stateLabel}>{engine.performanceState.level}</Text>
                )}
              </AFReadinessArc>
            </Pressable>
            <LiveStatusLine
              direction={trend.direction}
              delta={trend.delta}
              ageSec={trend.ageSec}
              verb={statusVerb}
              accent={accent}
              testID="home-v2-live-status-line"
            />
          </Animated.View>

          {/* One command */}
          <Animated.View entering={reveal(2)}>
            <AFCommandCard
              eyebrow={commandEyebrow}
              title={title || t('home.v2.default_command_title')}
              instruction={commandInstruction}
              primaryLabel={t('home.v2.log_water')}
              onPrimary={() => {
                void logIntake('water', { silent: true, ozOverride: parseDoseOz(engine.command.action) });
              }}
              rationale={engine.command.explanation || undefined}
            />
            {voiceElite && (
              <Text style={styles.trust} testID="home-coach-trust">
                {t('coach.trust_line')}
              </Text>
            )}
          </Animated.View>

          {/* Three quiet signals */}
          <Animated.View entering={reveal(3)} style={styles.signalsSection}>
            <AFSectionLabel label={t('home.v2.signals_label')} />
            <View style={styles.signals}>
              {signalOrder.map((key) => (
                <React.Fragment key={key}>{signalTiles[key]}</React.Fragment>
              ))}
            </View>
          </Animated.View>
        </>
      )}

      <View style={{ height: 40 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 8, marginBottom: 8 },
  welcome: { ...afType.secondary, color: af.textTertiary },
  brand: { ...afType.title1, color: af.textPrimary },
  freshness: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  arcWrap: { alignItems: 'center', marginVertical: 24 },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  scoreLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  stateLabel: { ...afType.caption, color: af.redText, marginTop: 6 },
  // Elite: band-tinted state pill (accent from homePresentation; never statusColor).
  statePill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statePillText: { ...afType.eyebrow },
  signalsSection: { marginTop: 28, gap: 12 },
  signals: { flexDirection: 'row', gap: 12 },
  signal: {
    flex: 1,
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
  },
  signalLabel: { ...afType.eyebrow, color: af.textTertiary },
  signalValue: { ...afType.title3, color: af.textPrimary },
  trust: { ...afType.caption, color: af.textTertiary, marginTop: 10, lineHeight: 17 },
});
