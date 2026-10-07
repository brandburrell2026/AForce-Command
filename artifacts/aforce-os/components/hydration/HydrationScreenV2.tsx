/**
 * HydrationScreenV2 — the Phase 2 · S5 Hydration redesign (spec §8.2), rendered
 * when `spec_hydration` is on. A live hydration dashboard (vs. the legacy
 * Performance Timeline): intake ring → water/target + electrolytes + recovery →
 * Scan a drink / Log manually → recent intake → a 7-day strip → the row that
 * pushes to Performance Signal (`/performance-signal`).
 *
 * Same store data as everywhere else; logging goes through the sanctioned
 * `logIntake` action (no scoring change). The legacy Performance Timeline is
 * PRESERVED behind the flag-off path (founder ruling: relocate, never delete).
 *
 * S2-1 (Stage-1-severity carryover, world-class-release audit): "Log
 * manually" used to be tap-is-the-commit with a dose scraped from command
 * copy — a fabricated amount, no picker, no confirmation, and (because the
 * write was non-silent with no local overlay mount) a stranded
 * `showCycleSuccess` that disabled Home's primary CTA. It now runs the
 * exact Home path: WaterAmountModal (explicit member-chosen amount) → one
 * guarded `logIntake` → CycleSuccessOverlay mounted HERE, so the success
 * state a Hydration log raises is rendered and dismissible on Hydration.
 * `source: 'hydration'` is preserved; no scoring change.
 *
 * BUILD-61: this screen is the Hydration TAB again. It shipped unreachable in
 * Build 60 because `app/(tabs)/journal.tsx` returned PerformanceSignalV3 ahead
 * of it; that history screen is now the pushed destination of the last row
 * here. This screen reads only the store — no network — so the root stays
 * useful even when that history cannot load.
 *
 * BLACK ISSUE (2026-10-07, PR 3): restyled to the Figma reference — masthead
 * + "HYDRATION / TODAY" breadcrumb, intake card, red Scan CTA, hairline
 * Recent intake rows, seven-dot week strip. PRESENTATION ONLY: every value is
 * the one this screen already derived; the Recovery reading stays an honest
 * em dash (the reference's "74 · HRV 58 MS" has no source here and is not
 * invented). The "Ask Concierge" entry that used to ride the top bar is kept
 * as a small control on the masthead's free right side (same hook, same
 * action, still absent while ai_concierge_enabled is off).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAskConciergeActions } from '@/components/concierge/AskConciergeAction';

import {
  AFScreen,
  AFMasthead,
  AFCard,
  AFProgressRing,
  AFPrimaryButton,
  AFSecondaryButton,
  AFSectionLabel,
  AFListRow,
  AFEmptyState,
  AFOfflineBanner,
} from '@/components/ui';
import { af, afType, afLayout, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { Icon } from '@/components/Icon';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { EM_DASH } from './signalV3Presentation';
import { useAppStore, useFeatureFlags } from '@/store/useAppStore';
import { useCycleSlice, useEngineSlice, useActionsSlice } from '@/store/slices';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';
import { WaterAmountModal } from '@/components/WaterAmountModal';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { fireMoment } from '@/services/haptics';
import type { FluidType, IntakeEvent } from '@/types';
import type { IntakeSource } from '@/services/intakeSource';

interface HydrationActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string; source?: IntakeSource },
  ) => Promise<void>;
  dismissSuccess: () => void;
}

/** FluidType → i18n key suffix under hydration.v2.fluid_* (translated at render). */
const FLUID_KEY: Record<FluidType, string> = {
  water: 'fluid_water',
  aforce_stick: 'fluid_aforce_stick',
  aforce_rtd: 'fluid_aforce_rtd',
  aforce_canister: 'fluid_aforce_canister',
  aforce_bulk_bag: 'fluid_aforce_bulk_bag',
};

/**
 * "TODAY · 9:12 AM" — the logged moment as a clock reading. Derived from the
 * event's own `loggedAt`; calendar-day comparison, never an elapsed-time guess.
 * Returns the day word and the time separately so the caller can tell whether
 * every shown entry is from today.
 */
function intakeWhen(
  loggedAt: Date | string | number,
  lang: string,
  words: { today: string; yesterday: string },
): { text: string; isToday: boolean } {
  const at = new Date(loggedAt);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  let time: string;
  try {
    time = at.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
  } catch {
    time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  let day: string;
  if (dayDiff === 0) day = words.today;
  else if (dayDiff === 1) day = words.yesterday;
  else {
    try {
      day = at.toLocaleDateString(lang, { weekday: 'short' });
    } catch {
      day = at.toLocaleDateString([], { weekday: 'short' });
    }
  }
  return { text: `${day} · ${time}`, isToday: dayDiff === 0 };
}

export function HydrationScreenV2() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const askConcierge = useAskConciergeActions('hydration');
  const { state } = useAppStore();
  const engine = useEngineSlice();
  const flags = useFeatureFlags();
  const { logIntake, dismissSuccess } = useActionsSlice<HydrationActions>();
  const { userState } = state;
  const { showCycleSuccess, lastCycleResult, isCompletingCycle } = useCycleSlice();
  const [waterPickerOpen, setWaterPickerOpen] = React.useState(false);

  // Synchronous double-tap guard — same reasoning as HomeScreenV2: two taps in
  // one frame both close over a pre-render `logIntake` whose own
  // `isCompletingCycle` guard has not seen the first tap yet.
  const confirmInFlightRef = React.useRef(false);

  // Opening the logger is NOT logging: no intake, no score, no haptic moment.
  const openWaterPicker = React.useCallback(() => {
    if (isCompletingCycle || confirmInFlightRef.current || showCycleSuccess) return;
    setWaterPickerOpen(true);
  }, [isCompletingCycle, showCycleSuccess]);

  const cancelWaterPicker = React.useCallback(() => {
    setWaterPickerOpen(false);
  }, []);

  // THE ONLY PLACE THIS SCREEN LOGS. The amount is the member's explicit
  // picker choice — never scraped from command copy. `silent` deliberately
  // not passed; the success overlay below renders the confirmation locally.
  const confirmWaterAmount = React.useCallback(
    (oz: number) => {
      if (confirmInFlightRef.current || isCompletingCycle || showCycleSuccess) return;
      confirmInFlightRef.current = true;
      setWaterPickerOpen(false);
      void logIntake('water', { ozOverride: oz, source: 'hydration' });
    },
    [logIntake, isCompletingCycle, showCycleSuccess],
  );

  // COMMAND COMPLETED on the CONFIRMED write only — settled cycle state, not
  // the promise, is the honest success signal (same contract as Home).
  React.useEffect(() => {
    if (!confirmInFlightRef.current) return;
    if (isCompletingCycle) return;
    confirmInFlightRef.current = false;
    if (!lastCycleResult) return;
    fireMoment('command_completed');
  }, [isCompletingCycle, lastCycleResult]);

  // RC-1 Wave-2B (item 1) — offline intake outbox visibility. Flag-gated:
  // while `offline_intake_outbox_enabled` is off the outbox is never
  // hydrated/written (see `services/intakeOutbox.ts`), so this stays at its
  // inert 0/false default and `AFOfflineBanner` renders nothing.
  const tabClearance = useTabBarClearance();
  const outboxState = useIntakeOutboxStore();
  const outboxPendingCount = flags.offline_intake_outbox_enabled ? selectPendingCount(outboxState) : 0;
  const outboxHasFailedItem = flags.offline_intake_outbox_enabled ? selectHasFailedItem(outboxState) : false;

  const pct =
    userState.ozTarget > 0
      ? Math.max(0, Math.min(1, userState.ozConsumedToday / userState.ozTarget))
      : 0;
  const recent: IntakeEvent[] = (userState.intakeEvents ?? []).slice(0, 5);
  const streak = Math.max(0, Math.min(7, userState.complianceStreak));
  const todayIdx = new Date(userState.lastIntakeTime).getDay();

  // Locale-aware weekday initials, Sunday-indexed to match getDay(). 2023-01-01
  // was a Sunday; English narrow → S M T W T F S (unchanged), other locales
  // localize. Falls back to English initials if Intl narrow is unavailable.
  const weekdayInitials = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        try {
          return new Date(2023, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: 'narrow' });
        } catch {
          return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i];
        }
      }),
    [i18n.language],
  );

  // Locale-aware full weekday names for screen readers — the narrow initial
  // ("S"/"M") is ambiguous spoken aloud.
  const weekdayLabels = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        try {
          return new Date(2023, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: 'long' });
        } catch {
          return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i];
        }
      }),
    [i18n.language],
  );

  const eyebrowType = useAFEyebrowType();
  const intakeRows = recent.map((e) => ({
    event: e,
    when: intakeWhen(e.loggedAt, i18n.language, {
      today: t('common.today'),
      yesterday: t('hydration.v2.when_yesterday'),
    }),
  }));
  const allRecentToday = intakeRows.length > 0 && intakeRows.every((r) => r.when.isToday);
  const recentMeta =
    intakeRows.length === 0
      ? undefined
      : [
          t('hydration.v2.recent_meta', { count: intakeRows.length }),
          allRecentToday ? t('common.today') : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <View style={styles.root}>
      <AFScreen scroll contentContainerStyle={{ paddingBottom: tabClearance }}>
      {/* Masthead: wordmark, red breadcrumb, statement. No right-hand meta —
          this screen has no city/temperature/clock source of its own, and the
          masthead never invents one. */}
      <View style={styles.mastheadWrap}>
        <AFMasthead
          breadcrumb={`${t('tabs.hydration')} / ${t('hydration.v2.eyebrow')}`}
          title={`${t('hydration.v2.title')}.`}
          testID="hydration-v2-masthead"
        />
        {askConcierge.length > 0 ? (
          <View style={styles.conciergeSlot}>
            {askConcierge.slice(0, 2).map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                hitSlop={4}
                style={({ pressed }) => [styles.conciergeBtn, pressed && styles.conciergePressed]}
              >
                <Icon name={a.icon} size={20} color={af.textPrimary} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* RC-1 Wave-2B (item 1) — offline intake outbox visibility. */}
      <AFOfflineBanner pendingCount={outboxPendingCount} hasFailedItem={outboxHasFailedItem} />

      {/* Intake ring + stats */}
      <AFCard style={styles.mainCard}>
        <View style={styles.ringRow}>
          {/* The ring's only reading used to be the centered `{pct}%`, and
              AFProgressRing hid it — so the day's intake was unreachable by
              VoiceOver. Naming the ring makes it one announced progressbar
              ("Today's intake, 62% of your target") instead of a nameless bar
              or silence. */}
          <AFProgressRing
            progress={pct}
            size={92}
            stroke={8}
            accessibilityLabel={t('hydration.v2.ring_a11y', { pct: Math.round(pct * 100) })}
          >
            <Text style={styles.ringPct} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
              {Math.round(pct * 100)}%
            </Text>
          </AFProgressRing>
          <View style={styles.stats}>
            <Stat
              label={t('hydration.v2.stat_water_logged')}
              value={t('hydration.v2.stat_water_value', {
                consumed: Math.round(userState.ozConsumedToday),
                target: userState.ozTarget,
              })}
            />
            <Stat
              label={t('hydration.v2.stat_electrolytes')}
              value={t('hydration.v2.stat_electrolytes_value', { count: userState.aforceUnitsToday })}
            />
            {/* CORRECTION-6 TWIN (command-authority wave 1, founder-authorized).
                This badge was NOT a recovery reading: it restated
                engine.performanceState.level — the band the engine already
                owns — title-cased under a "Recovery" label: a second verdict
                beside the intake hero, presenting a measurement nobody took.
                Home's identical Recovery tile was ruled out twice (founder §1
                2026-08-13; Correction 6, build-61 device QA). This mirrors
                Correction 6 exactly: the honest-data em dash until a real
                recovery input exists. The engine and its band are untouched —
                this is a presentation decision belonging to this screen.
                Black Issue: the reference's "STEADY · HRV 58 MS" line has no
                source on this screen, so it is not drawn. */}
            <View
              style={styles.recoveryRow}
              accessible
              accessibilityLabel={`${t('hydration.v2.recovery_label')} ${EM_DASH}`}
            >
              <Text style={[styles.statLabel, eyebrowType]}>{t('hydration.v2.recovery_label')}</Text>
              <Text style={styles.statValue}>{EM_DASH}</Text>
            </View>
          </View>
        </View>
      </AFCard>

      {/* Actions */}
      <View style={styles.actions}>
        <AFPrimaryButton label={t('hydration.v2.scan_a_drink')} icon="camera" onPress={() => router.push('/scan')} />
        <AFSecondaryButton
          label={t('hydration.v2.log_manually')}
          testID="hydration-log-manually"
          onPress={openWaterPicker}
        />
      </View>

      {/* Recent intake */}
      <View style={styles.section}>
        <AFSectionLabel label={t('hydration.v2.recent_intake')} meta={recentMeta} />
        {recent.length === 0 ? (
          <AFCard>
            <AFEmptyState
              icon="droplet"
              title={t('hydration.v2.empty_title')}
              message={t('hydration.v2.empty_message')}
            />
          </AFCard>
        ) : (
          <AFCard padded={false} style={styles.recentCard}>
            {intakeRows.map(({ event: e, when }, i) => {
              const title = t(`hydration.v2.${FLUID_KEY[e.fluidType] ?? 'fluid_default'}`);
              const amount = t('hydration.v2.oz_value', { oz: Math.round(e.oz) });
              return (
                <View
                  key={e.id}
                  style={[styles.intakeRow, i < intakeRows.length - 1 && styles.intakeRowRuled]}
                  accessible
                  accessibilityLabel={`${title}, ${when.text}, ${amount}`}
                >
                  {/* Hollow marker: shape, not colour, and decorative — the
                      row's composed label carries the content. */}
                  <View
                    style={styles.intakeDot}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <View style={styles.intakeText}>
                    <Text style={styles.intakeTitle}>{title}</Text>
                    <Text style={[styles.intakeWhen, eyebrowType]}>{when.text.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.intakeAmount, eyebrowType]}>{amount.toUpperCase()}</Text>
                </View>
              );
            })}
          </AFCard>
        )}
      </View>

      {/* 7-day strip (streak, honest) */}
      <View style={styles.section}>
        {/* No count caption: `streak` is the target-met compliance streak,
            not a count of days logged (PR #1090 review B1) — the dots and
            their per-day labels carry what is known. */}
        <AFSectionLabel label={t('hydration.v2.this_week')} />
        <View style={styles.strip}>
          {weekdayInitials.map((d, i) => {
            // Fill the most recent `streak` days up to and including today.
            const daysBack = (todayIdx - i + 7) % 7;
            const filled = daysBack < streak;
            const isToday = i === todayIdx;
            return (
              <View
                key={i}
                style={styles.dayCol}
                accessible
                /*
                 * A11y fix (Wave-5 Phase-1 pass — state by appearance alone):
                 * the label was the weekday and nothing else, so "logged" vs
                 * "not logged" — the entire point of the strip — existed only
                 * as a filled vs hollow dot, and "today" only as a lighter
                 * ring. `accessibilityState.selected` is not announced for a
                 * plain non-interactive View, so a screen-reader member heard
                 * seven weekday names and no week. The label now says all
                 * three facts in words; the dots keep saying them visually.
                 */
                accessibilityLabel={[
                  weekdayLabels[i],
                  isToday ? t('common.today') : null,
                  t(filled ? 'hydration.v2.day_logged' : 'hydration.v2.day_not_logged'),
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                {/* Today is a ring AROUND the dot; logged is a filled dot, not
                    logged a hollow one — three states told apart by shape. */}
                <View style={[styles.dayMark, isToday && styles.dayMarkToday]}>
                  <View style={[styles.dayDot, filled && styles.dayDotFilled]} />
                </View>
                <Text style={[styles.dayLabel, eyebrowType, isToday && styles.dayLabelToday]}>{d}</Text>
              </View>
            );
          })}
        </View>

        {/* HISTORY — one tap deeper, never in place of this screen.
            Build-61 correction: Performance Signal used to REPLACE this tab
            (app/(tabs)/journal.tsx branched on `signal_v3_dashboard_enabled`
            first), so the ring, the two log affordances and this strip were
            unreachable in production. It is a pushed detail route now — the
            same root → detail push Home uses for /weekly-report — which is
            also why the week fails softly: history lives entirely on the
            destination, so nothing above depends on it loading. */}
        <AFCard padded={false} style={styles.recentCard}>
          <AFListRow
            icon="bar-chart-2"
            title={t('hydration.v2.history_title')}
            subtitle={t('hydration.v2.history_subtitle')}
            disclosure
            onPress={() => router.push('/performance-signal')}
            testID="hydration-v2-history-link"
          />
        </AFCard>
      </View>

      </AFScreen>

      {/* Amount is an explicit member choice; cancel/backdrop/hardware-back
          all write nothing (WaterAmountModal routes them to one handler). */}
      <WaterAmountModal
        visible={waterPickerOpen}
        accentColor={af.red}
        onCancel={cancelWaterPicker}
        onConfirm={confirmWaterAmount}
      />

      {/* Rendered from the cycle slice's own settled result, so it can only
          appear for a write the store committed — and because it is mounted
          HERE, a Hydration log's success state is dismissed here instead of
          stranding until the member happens to visit Home. */}
      {showCycleSuccess && lastCycleResult && (
        <CycleSuccessOverlay result={lastCycleResult} onDismiss={dismissSuccess} />
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const eyebrowType = useAFEyebrowType();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.statLabel, eyebrowType]}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1 },
  mastheadWrap: { position: 'relative' },
  // Free right side of the wordmark row. 44pt target centred on the 20pt
  // wordmark line (top = (20 - 44) / 2).
  conciergeSlot: { position: 'absolute', top: -12, right: -12, flexDirection: 'row' },
  conciergeBtn: {
    width: afLayout.controlMinHeight,
    height: afLayout.controlMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: afLayout.controlMinHeight / 2,
  },
  conciergePressed: { backgroundColor: af.surfacePressed },
  mainCard: { marginTop: 24 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  ringPct: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  stats: { flex: 1, gap: 12 },
  stat: { gap: 2 },
  statLabel: { ...afType.eyebrow, color: af.textTertiary },
  statValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  recoveryRow: { gap: 2, alignItems: 'flex-start' },
  actions: { marginTop: 20, gap: 12 },
  section: { marginTop: 28, gap: 12 },
  recentCard: { paddingHorizontal: 16 },
  intakeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 10 },
  intakeRowRuled: { borderBottomWidth: afLayout.hairline, borderBottomColor: af.divider },
  intakeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: af.textTertiary,
  },
  intakeText: { flex: 1, gap: 2 },
  intakeTitle: { ...afType.body, color: af.textPrimary },
  intakeWhen: { ...afType.eyebrow, color: af.textTertiary },
  intakeAmount: { ...afType.eyebrow, color: af.textSecondary, flexShrink: 0 },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6, flex: 1, minHeight: 44 },
  // Ring slot: always 20pt so the strip never shifts when today moves.
  dayMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayMarkToday: { borderColor: af.textPrimary },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: af.textTertiary,
    backgroundColor: 'transparent',
  },
  dayDotFilled: { backgroundColor: af.red, borderColor: af.red },
  dayLabel: { ...afType.eyebrow, color: af.textTertiary },
  dayLabelToday: { color: af.textPrimary },
});
