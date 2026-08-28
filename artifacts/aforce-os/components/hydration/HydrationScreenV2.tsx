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
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  AFScreen,
  AFTopBar,
  AFCard,
  AFProgressRing,
  AFPrimaryButton,
  AFSecondaryButton,
  AFSectionLabel,
  AFListRow,
  AFEmptyState,
  AFOfflineBanner,
} from '@/components/ui';
import { af, afType } from '@/theme';
import { EM_DASH } from './signalV3Presentation';
import { useAppStore, useFeatureFlags } from '@/store/useAppStore';
import { useCycleSlice, useEngineSlice, useActionsSlice } from '@/store/slices';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';
import { WaterAmountModal } from '@/components/WaterAmountModal';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { fireMoment } from '@/services/haptics';
import { formatTimeAgo } from '@/data/mockData';
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

export function HydrationScreenV2() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
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

  return (
    <View style={styles.root}>
      <AFScreen scroll contentContainerStyle={{ paddingBottom: tabClearance }}>
      <AFTopBar eyebrow={t('hydration.v2.eyebrow')} title={t('hydration.v2.title')} />

      {/* RC-1 Wave-2B (item 1) — offline intake outbox visibility. */}
      <AFOfflineBanner pendingCount={outboxPendingCount} hasFailedItem={outboxHasFailedItem} />

      {/* Intake ring + stats */}
      <AFCard variant="raised" style={styles.mainCard}>
        <View style={styles.ringRow}>
          {/* The ring's only reading used to be the centered `{pct}%`, and
              AFProgressRing hid it — so the day's intake was unreachable by
              VoiceOver. Naming the ring makes it one announced progressbar
              ("Today's intake, 62% of your target") instead of a nameless bar
              or silence. */}
          <AFProgressRing
            progress={pct}
            size={110}
            stroke={9}
            accessibilityLabel={t('hydration.v2.ring_a11y', { pct: Math.round(pct * 100) })}
          >
            <Text style={styles.ringPct}>{Math.round(pct * 100)}%</Text>
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
                this is a presentation decision belonging to this screen. */}
            <View
              style={styles.recoveryRow}
              accessible
              accessibilityLabel={`${t('hydration.v2.recovery_label')} ${EM_DASH}`}
            >
              <Text style={styles.statLabel}>{t('hydration.v2.recovery_label')}</Text>
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
        <AFSectionLabel label={t('hydration.v2.recent_intake')} />
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
            {recent.map((e, i) => (
              <AFListRow
                key={e.id}
                icon={e.fluidType === 'water' ? 'droplet' : 'zap'}
                title={t(`hydration.v2.${FLUID_KEY[e.fluidType] ?? 'fluid_default'}`)}
                subtitle={formatTimeAgo(e.loggedAt)}
                value={t('hydration.v2.oz_value', { oz: Math.round(e.oz) })}
              />
            ))}
          </AFCard>
        )}
      </View>

      {/* 7-day strip (streak, honest) */}
      <View style={styles.section}>
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
                <View
                  style={[
                    styles.dayDot,
                    filled && styles.dayDotFilled,
                    isToday && styles.dayDotToday,
                  ]}
                />
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{d}</Text>
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
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1 },
  mainCard: { marginTop: 20 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringPct: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  stats: { flex: 1, gap: 12 },
  stat: { gap: 2 },
  statLabel: { ...afType.eyebrow, color: af.textTertiary },
  statValue: { ...afType.bodyStrong, color: af.textPrimary },
  recoveryRow: { gap: 4, alignItems: 'flex-start' },
  actions: { marginTop: 20, gap: 12 },
  section: { marginTop: 28, gap: 12 },
  recentCard: { paddingHorizontal: 16 },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 8, flex: 1 },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: 'transparent',
  },
  dayDotFilled: { backgroundColor: af.red, borderColor: af.red },
  dayDotToday: { borderColor: af.textPrimary },
  dayLabel: { ...afType.caption, color: af.textTertiary },
  dayLabelToday: { color: af.textPrimary },
});
