/**
 * SLEEP MODE — container.
 *
 * Renders the redesigned, guided
 * pre-sleep protocol (`SleepModeView`, fed by the pure `resolveSleepModeView`).
 * The container owns real data + interaction; the view is pure. It NEVER fabricates a health metric
 * and NEVER mutates Recovery Capacity — hydration stays the primary driver.
 */
import React from 'react';
import { View, StyleSheet, Platform, ScrollView, AccessibilityInfo } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticNotify, hapticSelection } from '@/services/haptics';
import { scopedStorage } from '@/services/scopedStorage';

import { GradientBackground } from '@/components/GradientBackground';
import { useUserSlice, useFlagsSlice } from '@/store/slices';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { WEB_TOP_PADDING, WEB_BOTTOM_PADDING } from '@/constants/layout';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import {
  deriveCommandConfidence, commandConfidenceInputsFromState,
} from '@/utils/scoring/commandConfidence';
import {
  resolveSleepModeView, PRE_SLEEP_LEAD_MIN, RECOVERY_WINDOW_LEAD_MIN,
  CHECKLIST_DEFS, localDayKey, shouldFoldSleepAvg, foldSevenNightAvg, primaryCtaAction,
  type SleepPhase, type ChecklistItemDef,
} from '@/services/sleep/sleepModeView';
import { sleepSignalsForContainer } from '@/services/health/sleepSignals';
import { SleepModeView } from '@/components/sleep/SleepModeView';

const SLEEP_TIME_KEY = '@aforce/sleepMode/targetTimeHHMM';
const SEVEN_NIGHT_KEY = '@aforce/sleepMode/sevenNightAvg';
// H2 — last local calendar day the 7-night EMA folded (YYYY-MM-DD).
const LAST_FOLDED_KEY = '@aforce/sleepMode/lastFoldedDay';

interface ParsedTime { h: number; m: number }

function parseHHMM(s: string | null | undefined): ParsedTime | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (!(min >= 0 && min <= 59)) return null;
  if (ap) {
    if (!(h >= 1 && h <= 12)) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
  } else if (!(h >= 0 && h <= 23)) return null;
  return { h, m: min };
}
function formatHHMM(t: ParsedTime): string { return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`; }
function format12(t: ParsedTime): string {
  const ap = t.h >= 12 ? 'PM' : 'AM';
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  return `${h12}:${String(t.m).padStart(2, '0')} ${ap}`;
}
function minutesUntilNext(target: ParsedTime, now: Date): number {
  const next = new Date(now);
  next.setHours(target.h, target.m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return Math.round((next.getTime() - now.getTime()) / 60000);
}
function derivePhase(minsUntil: number, hour: number): SleepPhase {
  if (hour >= 5 && hour < 11) return 'morning';
  if (minsUntil <= RECOVERY_WINDOW_LEAD_MIN) return 'recovery_window';
  if (minsUntil <= PRE_SLEEP_LEAD_MIN) return 'pre_sleep';
  return 'idle';
}

function isFiniteNum(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v); }

export default function SleepModeScreen() {
  const flags = useFlagsSlice();
  // Flag OFF → untouched legacy screen. This keeps the redesign fully gated.
  // Founder ruling 2026-08-27: the spec_sleep_v2 legacy fallback is retired
  // (fifteen-twin retirement); the guided protocol renders unconditionally.
  return <SleepModeRedesign />;
}

function SleepModeRedesign() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useUserSlice();
  const flags = useFlagsSlice();
  const reducedMotion = useReducedMotion();

  const [target, setTarget] = React.useState<ParsedTime | null>({ h: 23, m: 0 });
  const [draft, setDraft] = React.useState('11:00 PM');
  const [editing, setEditing] = React.useState(false);
  const [sevenNightAvg, setSevenNightAvg] = React.useState<number | null>(null);
  const [lastFoldedDay, setLastFoldedDay] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState<Set<ChecklistItemDef['id']>>(new Set());
  const [now, setNow] = React.useState<Date>(() => new Date());
  const [hydrated, setHydrated] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const checklistY = React.useRef(0);

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedTime, storedAvg, storedFolded] = await Promise.all([
          scopedStorage.getItem(SLEEP_TIME_KEY), scopedStorage.getItem(SEVEN_NIGHT_KEY),
          scopedStorage.getItem(LAST_FOLDED_KEY),
        ]);
        if (cancelled) return;
        const parsed = parseHHMM(storedTime);
        if (parsed) { setTarget(parsed); setDraft(format12(parsed)); }
        if (storedAvg) { const n = Number(storedAvg); if (Number.isFinite(n)) setSevenNightAvg(n); }
        // Malformed/missing guard values are handled by shouldFoldSleepAvg —
        // store the raw string; validation happens at fold time.
        if (storedFolded) setLastFoldedDay(storedFolded);
      } catch { /* storage unavailable — keep defaults */ } finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  // W3.3 — canonical health-selector consumer. Behind `health_canonical_consumers`
  // (default OFF): flag OFF reproduces the screen's original inline
  // freshest-wins-across-snapshots / Apple-Health-only logic EXACTLY; flag ON
  // routes sleep hours, HRV, and resting HR through `resolveHealthSignals` so
  // HRV/RHR can come from ANY connected provider, honestly (never fabricated,
  // never presenting a stale/expired signal as connected-fresh). See
  // services/health/sleepSignals.ts.
  const signals = React.useMemo(
    () => sleepSignalsForContainer(
      { appleHealth: user.appleHealth, biometrics: user.biometrics },
      now.getTime(),
      flags.health_canonical_consumers,
    ),
    [user.appleHealth, user.biometrics, now, flags.health_canonical_consumers],
  );
  const sleepLastNight = signals.sleepLastNight;
  const recoveryMetrics = signals.recoveryMetrics;

  // H2 — fold last-night sleep into the 7-night EMA at most ONCE per local
  // calendar day. Gated on `hydrated` so the stored average + guard are loaded
  // before any fold (previously a mount could fold before storage resolved,
  // and every mount re-folded the same night, biasing the average the honest
  // morning comparison is built on).
  React.useEffect(() => {
    if (!hydrated || !isFiniteNum(sleepLastNight)) return;
    const today = localDayKey(Date.now());
    if (!shouldFoldSleepAvg(lastFoldedDay, today, sleepLastNight)) return;
    setSevenNightAvg((prev) => {
      const next = foldSevenNightAvg(prev, sleepLastNight);
      scopedStorage.setItem(SEVEN_NIGHT_KEY, String(next)).catch(() => {});
      return next;
    });
    setLastFoldedDay(today);
    scopedStorage.setItem(LAST_FOLDED_KEY, today).catch(() => {});
  }, [hydrated, sleepLastNight, lastFoldedDay]);

  const minsUntil = target ? minutesUntilNext(target, now) : null;
  const phase = minsUntil == null ? 'idle' : derivePhase(minsUntil, now.getHours());

  const confidence = deriveCommandConfidence(commandConfidenceInputsFromState(user, now.getTime()));

  const view = resolveSleepModeView({
    now: now.getTime(),
    mode: hydrated ? 'ready' : 'loading',
    phase,
    target,
    minutesUntilTarget: minsUntil,
    sleepLastNight,
    sevenNightAvg,
    recoveryMetrics,
    confidence,
    health: {
      // Canonical path attributes the actual winning provider; legacy path
      // (and any canonical "no reading" state) falls back to the honest
      // platform default — never a fabricated provider name.
      provider: signals.providerLabel ?? (Platform.OS === 'ios' ? 'Apple Health' : 'Google Health Connect'),
      chip: signals.chip,
      freshness: signals.freshness,
    },
    completed: Array.from(completed),
    // H1 — public kill switch keeps its semantics on the redesigned path:
    // when off, the view renders the loud internal-preview banner (legacy parity).
    sleepModeEnabled: flags.sleep_mode_enabled,
  });

  const haptic = (kind: 'light' | 'success') => {
    if (Platform.OS === 'web') return;
    if (kind === 'success') hapticNotify('success');
    else hapticSelection();
  };

  const onBack = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  const onEditTarget = () => setEditing(true);
  const onChangeTargetDraft = (s: string) => setDraft(s);
  const onSaveTarget = () => {
    const parsed = parseHHMM(draft);
    if (!parsed) { setDraft(target ? format12(target) : '11:00 PM'); setEditing(false); return; }
    setTarget(parsed);
    setEditing(false);
    scopedStorage.setItem(SLEEP_TIME_KEY, formatHHMM(parsed)).catch(() => {});
    haptic('light');
  };
  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const tabClearance = useTabBarClearance();
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : tabClearance;

  const announce = (msg: string) => {
    // Meaningful VoiceOver/TalkBack feedback for state changes the eye sees.
    try { AccessibilityInfo.announceForAccessibility(msg); } catch { /* no-op on web */ }
  };

  // Haptics + announcements run OUTSIDE state updaters (updaters must stay
  // pure — StrictMode double-invocation would double-fire them).
  const onToggleChecklist = (id: ChecklistItemDef['id']) => {
    const willAdd = !completed.has(id);
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (willAdd) {
      haptic(completed.size + 1 === CHECKLIST_DEFS.length ? 'success' : 'light');
    }
  };

  // H3 — observable, honest primary CTA: complete the primary product-backed
  // item (hydrate) when it isn't done; otherwise bring the checklist into view.
  // Still no score mutation and no fabricated health data.
  const onPrimaryCta = () => {
    if (primaryCtaAction(Array.from(completed)) === 'complete_hydrate') {
      const nextSize = completed.size + 1;
      setCompleted((prev) => new Set(prev).add('hydrate'));
      const allDone = nextSize === CHECKLIST_DEFS.length;
      haptic(allDone ? 'success' : 'light');
      announce(allDone ? 'Hydrate marked complete. All items complete.' : 'Hydrate marked complete.');
    } else {
      haptic('light');
      scrollRef.current?.scrollTo({
        y: Math.max(0, topPadding + checklistY.current - 8),
        animated: !reducedMotion,
      });
      announce(`Protocol checklist, ${view.checklist.progressLabel}.`);
    }
  };
  const onHealthCta = () => { haptic('light'); router.push('/(tabs)/journal'); };

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SleepModeView
            view={view}
            reducedMotion={reducedMotion}
            editingTarget={editing}
            targetDraft={draft}
            onChecklistLayout={(y) => { checklistY.current = y; }}
            onBack={onBack}
            onEditTarget={onEditTarget}
            onChangeTargetDraft={onChangeTargetDraft}
            onSaveTarget={onSaveTarget}
            onToggleChecklist={onToggleChecklist}
            onPrimaryCta={onPrimaryCta}
            onHealthCta={onHealthCta}
          />
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});
