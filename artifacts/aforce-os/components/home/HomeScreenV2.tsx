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
 * PRESENTATION-ONLY elevation layered on the exact same data. When on, it adds a
 * ring reveal + truthful score count-up, a larger arc, staggered entrance, a
 * state pill, and band-aware signal ordering — all decided by the pure, tested
 * `homePresentation.ts`. It never touches the score, command, eligibility,
 * timing, or safety logic (Score-Protection); reduced-motion collapses every
 * animation back to the static Home.
 *
 * WAVE 5 — the band accent is NOT part of that flag any more. It used to be:
 * flag-off pinned `accent = af.red` and the state word to `af.redText`, so the
 * arc, the trend line and the state word rendered in ALARM RED for every band —
 * a member at PEAK read "ASCENDING" in the same red a DEPLETED member sees.
 * Signal Red must be meaningful and restrained, and visual certainty must track
 * what the data says, so the accent now always comes from
 * `resolveHomePresentation(level)`. Text/glyphs take `accentText` (Signal Red
 * fails AA as text on dark — see theme/afTokens.ts); fills and strokes keep
 * `accent`. This intentionally changes the flag-off render.
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
import { af, afType, Spacing, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { useFeatureFlags } from '@/store/useAppStore';
import { HomeMomentsSection } from '@/components/moments/HomeMomentsSection';
import { useEngineSlice, useActionsSlice, useUserSlice, useVoiceSettingsSlice, useBootstrapSlice } from '@/store/slices';
import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';
import { HomeSkeleton } from './HomeSkeleton';
import { HomeFreshnessLabel } from './HomeFreshnessLabel';
import { freshestBiometricsFetchedAt } from './homeFreshness';
import { parseEngineActionCopy, parseDoseOz } from '@/utils/recovery/recoveryCommandFromStore';
import {
  resolveHomePresentation,
  resolveArcAnimation,
  resolveArcDimensions,
  type SignalKey,
} from './homePresentation';
import { findVoice } from '@/services/voiceCatalog';
import { coachEyebrow, coachLead, formatCommandForCoach } from '@/services/voice/coachPhrasing';
import type { FluidType } from '@/types';
import { LiveStatusLine } from './LiveStatusLine';
import { useScoreTrend } from '@/hooks/useScoreTrend';
import { getStatusVerb } from '@/services/statusVerb';
import { explainFieldArbitration } from '@/utils/biometricsAggregator';
import {
  formatSleepHours,
  formatHrvMs,
  formatHydrationPct,
  resolveHealthChip,
} from './homeV3Presentation';

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
  const userState = useUserSlice();
  const { selectedVoiceId } = useVoiceSettingsSlice();
  const { isHydrated } = useBootstrapSlice();
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

  // Fills/strokes take `accent`; text + icon glyphs take the AA-clean
  // `accentText` twin (Wave 5 — see the file header).
  const accent = presentation.accent;
  const accentText = presentation.accentText;
  const reveal = (idx: number) =>
    elite && !reducedMotion ? FadeInDown.duration(420).delay(idx * 90) : undefined;

  // Premium arc hero (elite): a larger, bolder, band-glowing readiness gauge so
  // it reads as the single instrument. Flag-off keeps the shipped 240/6 arc
  // byte-for-byte. Decision lives in the pure, tested homePresentation module.
  const arcDims = resolveArcDimensions(elite);

  // RC-1 fix (P0 vs founder's 3-second brief): momentum was missing from
  // Home — the tested, existing `LiveStatusLine` (trend arrow + delta
  // window + status verb) lived only on the legacy Home. Same hook/service
  // pair the legacy screen uses (app/(tabs)/index.tsx), tinted with V2's own
  // `accentText` so it stays in this screen's spare visual language instead of
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

  // ── Home V3 dashboard (flag-gated, presentation-only; founder comps
  // 2026-08-10) — every value below is derived from state this screen ALREADY
  // reads (userState / engine); no new store hooks, so the render-count
  // guarantees hold. Honest-data contract lives in homeV3Presentation.ts:
  // missing readings render an em dash and the chip renders nothing when no
  // provider has contributed. Sleep/HRV values come from
  // explainFieldArbitration — the SAME per-field winner the scoring path's
  // freshestNonNull selects (parity-proven in its test suite).
  const v3 = flags.home_v3_dashboard_enabled;
  const momentsOn = flags.moments_enabled;
  const v3Data = React.useMemo(() => {
    if (!v3) return null;
    const now = Date.now();
    const sleep = explainFieldArbitration(userState.biometrics, 'sleepHoursLastNight', now).winner;
    const hrv = explainFieldArbitration(userState.biometrics, 'hrvSdnn', now).winner;
    const sources = Object.entries(userState.biometrics ?? {})
      .filter(([, snap]) => snap != null)
      .map(([id]) => id as import('@/data/healthProviders').HealthProviderId);
    const chip = resolveHealthChip({
      sources,
      freshestFetchedAtMs: freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics),
      now,
    });
    return {
      chip,
      sleepText: formatSleepHours(sleep ? (sleep.value as number) : null),
      hrvText: formatHrvMs(hrv ? (hrv.value as number) : null),
      hydrationText: formatHydrationPct(userState.unitsConsumedToday, userState.dailyTarget),
    };
  }, [
    v3,
    userState.biometrics,
    userState.appleHealth,
    userState.unitsConsumedToday,
    userState.dailyTarget,
  ]);

  return (
    <AFScreen scroll contentContainerStyle={[styles.scrollContent, v3 && styles.scrollContentV3]}>
      {/* Wordmark + freshness (+ V3 health-connection chip — renders nothing
          when no provider has contributed data) */}
      <Animated.View entering={reveal(0)} style={styles.header}>
        <Text style={styles.welcome}>{t('home.welcome', { name: greeting })}</Text>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>{t('home.subtitle_title')}</Text>
          {v3Data?.chip ? (
            <View
              style={styles.v3Chip}
              accessible
              accessibilityLabel={`${v3Data.chip.label} ${v3Data.chip.live ? t('home.v3.chip_live') : t('home.v3.chip_synced')}`}
              testID="home-v3-health-chip"
            >
              <View style={[styles.v3ChipDot, !v3Data.chip.live && styles.v3ChipDotIdle]} />
              <Text style={styles.v3ChipText} numberOfLines={1}>
                {v3Data.chip.label} · {v3Data.chip.live ? t('home.v3.chip_live') : t('home.v3.chip_synced')}
              </Text>
            </View>
          ) : null}
        </View>
        <HomeFreshnessLabel
          fetchedAtMs={freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics)}
          style={styles.freshness}
          testID="home-v2-freshness"
        />
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
              style={[styles.arcWrap, elite && styles.arcWrapPremium]}
              onPress={() => router.push('/weekly-report')}
              accessibilityRole="button"
              accessibilityLabel={`${t('home.v2.readiness_a11y', { score })} ${engine.performanceState.level}`}
              testID="home-readiness-arc"
            >
              {/* a11yHidden: the Pressable above already announces score + band,
                  so an inner progressbar would make the hero speak twice. */}
              <AFReadinessArc score={score} size={arcDims.size} stroke={arcDims.stroke} color={accent} animate={arcPlan.animateRing} alive={elite} a11yHidden>
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
                    <Text style={[styles.statePillText, { color: accentText }]}>
                      {engine.performanceState.level}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.stateLabel, { color: accentText }]}>
                    {engine.performanceState.level}
                  </Text>
                )}
              </AFReadinessArc>
            </Pressable>
            <LiveStatusLine
              direction={trend.direction}
              delta={trend.delta}
              ageSec={trend.ageSec}
              verb={statusVerb}
              accent={accentText}
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

          {/* AForce Moments (Phases 1–2, flag OFF in production) — NEXT MOMENT
              + today's preparation-relevant list. Additive section; renders
              nothing when the flag is off or no moments exist. */}
          {momentsOn && (
            <Animated.View entering={reveal(3)} style={styles.momentsSection}>
              <HomeMomentsSection />
            </Animated.View>
          )}

          {/* Signals — V3: four live-signal tiles (Hydration / Recovery /
              Sleep / HRV, missing readings render an em dash); flag off: the
              shipped three-tile row, byte-identical. */}
          <Animated.View entering={reveal(3)} style={styles.signalsSection}>
            <AFSectionLabel label={t(v3 ? 'home.v3.live_signals' : 'home.v2.signals_label')} />
            {v3 && v3Data ? (
              <View style={styles.v3Grid}>
                <View style={styles.signals}>
                  <Signal label={t('home.v2.signal_hydration')} value={v3Data.hydrationText} />
                  <Signal label={t('home.v2.signal_recovery')} value={titleCase(engine.performanceState.level)} />
                </View>
                <View style={styles.signals}>
                  <Signal label={t('home.v3.signal_sleep')} value={v3Data.sleepText} />
                  <Signal label={t('home.v3.signal_hrv')} value={v3Data.hrvText} />
                </View>
              </View>
            ) : (
              <View style={styles.signals}>
                {signalOrder.map((key) => (
                  <React.Fragment key={key}>{signalTiles[key]}</React.Fragment>
                ))}
              </View>
            )}
          </Animated.View>

          {/* WAVE 5 — the V3 "Completed today" section (three protocol rows +
              n/N count + streak / recovery-trend stat tiles) was DELETED here.
              Two reasons, both about honesty and hierarchy:

              TRUST — the rows were derived from `deriveTodaysProtocol`, which
              checked off "Hydration Stick" at one logged serving and "AForce
              Can" at half the daily target. A member who drank tap water got a
              green check asserting they had consumed a specific AForce product.
              A green check is the strongest certainty signal on the screen and
              it was backed by the weakest evidence. (There is no can data —
              sticks only, per the founder.)

              HIERARCHY — the day-streak numeral rendered at afType.title2 26pt,
              the second-largest number on Home. HydroState must not read as
              points or a game score, and nothing should compete with the arc.

              Nothing is lost: the streak lives on StreakCard / Progress, and the
              trend is already the LiveStatusLine directly under the arc. */}
        </>
      )}
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  // Tokenized bottom breathing room (replaces a trailing <View height:40/> spacer).
  scrollContent: { paddingBottom: Spacing[10] },
  // V3's four-tile signal grid extends the scroll below the fold — clear the
  // floating tab bar (≈49pt bar + home-indicator inset) so the last row of
  // tiles is reachable.
  scrollContentV3: { paddingBottom: Spacing[24] + Spacing[8] },
  momentsSection: { marginTop: 4 },
  header: { marginTop: 8, marginBottom: 8 },
  welcome: { ...afType.secondary, color: af.textTertiary },
  brand: { ...afType.title1, color: af.textPrimary },
  freshness: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  arcWrap: { alignItems: 'center', marginVertical: 24 },
  // Premium arc hero gets more vertical presence (elite path only).
  arcWrapPremium: { marginVertical: Spacing[8] },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  scoreLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  // Colour is applied at the call site from the band's `accentText` — a fixed
  // red here made every band's state word read as an alarm (Wave 5).
  stateLabel: { ...afType.caption, marginTop: 6 },
  // Band-tinted state pill (accent from homePresentation; never statusColor).
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
  // ── Home V3 dashboard (home_v3_dashboard_enabled) ──
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  v3Chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  v3ChipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: af.green },
  v3ChipDotIdle: { backgroundColor: af.textTertiary },
  v3ChipText: { ...afType.caption, color: af.textSecondary },
  v3Grid: { gap: 12 },
});
