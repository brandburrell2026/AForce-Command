/**
 * SLEEP MODE — container.
 *
 * Behind `spec_sleep_v2` (default OFF) this renders the redesigned, guided
 * pre-sleep protocol (`SleepModeView`, fed by the pure `resolveSleepModeView`).
 * With the flag OFF it renders the untouched legacy screen. The container owns
 * real data + interaction; the view is pure. It NEVER fabricates a health metric
 * and NEVER mutates Recovery Capacity — hydration stays the primary driver.
 */
import React from 'react';
import { View, StyleSheet, Platform, ScrollView, AccessibilityInfo } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GradientBackground } from '@/components/GradientBackground';
import { useUserSlice, useFlagsSlice } from '@/store/slices';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { TAB_BAR_HEIGHT, WEB_TOP_PADDING, WEB_BOTTOM_PADDING } from '@/constants/layout';
import {
  deriveCommandConfidence, commandConfidenceInputsFromState,
} from '@/utils/scoring/commandConfidence';
import {
  resolveSleepModeView, PRE_SLEEP_LEAD_MIN, RECOVERY_WINDOW_LEAD_MIN,
  CHECKLIST_DEFS, localDayKey, shouldFoldSleepAvg, foldSevenNightAvg, primaryCtaAction,
  type SleepPhase, type SleepMetricInput, type HealthChip, type ChecklistItemDef,
} from '@/services/sleep/sleepModeView';
import { SleepModeView } from '@/components/sleep/SleepModeView';
import SleepModeScreenLegacy from './SleepModeScreenLegacy';

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
  if (!flags.spec_sleep_v2) return <SleepModeScreenLegacy />;
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
          AsyncStorage.getItem(SLEEP_TIME_KEY), AsyncStorage.getItem(SEVEN_NIGHT_KEY),
          AsyncStorage.getItem(LAST_FOLDED_KEY),
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

  const sleepLastNight: number | null = React.useMemo(() => {
    const fromApple = user.appleHealth?.sleepHoursLastNight;
    if (isFiniteNum(fromApple)) return fromApple;
    const bio = user.biometrics;
    if (!bio) return null;
    let best: { v: number; at: number } | null = null;
    for (const snap of Object.values(bio)) {
      const v = snap?.sleepHoursLastNight;
      if (!isFiniteNum(v)) continue;
      const at = snap?.fetchedAt ?? 0;
      if (!best || at > best.at) best = { v, at };
    }
    return best?.v ?? null;
  }, [user.appleHealth, user.biometrics]);

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
      AsyncStorage.setItem(SEVEN_NIGHT_KEY, String(next)).catch(() => {});
      return next;
    });
    setLastFoldedDay(today);
    AsyncStorage.setItem(LAST_FOLDED_KEY, today).catch(() => {});
  }, [hydrated, sleepLastNight, lastFoldedDay]);

  const minsUntil = target ? minutesUntilNext(target, now) : null;
  const phase = minsUntil == null ? 'idle' : derivePhase(minsUntil, now.getHours());

  // Honest health chip: real sleep signal ⇒ connected; a health object present but
  // no signal ⇒ waiting; nothing at all ⇒ not connected. No fabricated status.
  const hasHealthObject = user.appleHealth != null || (user.biometrics != null && Object.keys(user.biometrics).length > 0);
  const chip: HealthChip = sleepLastNight != null ? 'connected' : hasHealthObject ? 'waiting' : 'not_connected';
  const freshness: string | null = sleepLastNight != null ? 'Last night' : hasHealthObject ? 'No recent signal' : null;

  const confidence = deriveCommandConfidence(commandConfidenceInputsFromState(user, now.getTime()));

  // Only REAL biometric values become metrics (never a placeholder number).
  const recoveryMetrics: SleepMetricInput[] = React.useMemo(() => {
    const out: SleepMetricInput[] = [];
    const hrv = user.appleHealth?.hrvSdnn;
    const rhr = user.appleHealth?.restingHeartRate;
    if (isFiniteNum(hrv)) out.push({ key: 'hrv', label: 'HRV', value: Math.round(hrv), unit: 'ms', real: true });
    if (isFiniteNum(rhr)) out.push({ key: 'resting_hr', label: 'Resting HR', value: Math.round(rhr), unit: ' bpm', real: true });
    return out;
  }, [user.appleHealth]);

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
    health: { provider: Platform.OS === 'ios' ? 'Apple Health' : 'Google Health Connect', chip, freshness },
    completed: Array.from(completed),
    // H1 — public kill switch keeps its semantics on the redesigned path:
    // when off, the view renders the loud internal-preview banner (legacy parity).
    sleepModeEnabled: flags.sleep_mode_enabled,
  });

  const haptic = (kind: 'light' | 'success') => {
    if (Platform.OS === 'web') return;
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
  };

  const onBack = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  const onEditTarget = () => setEditing(true);
  const onChangeTargetDraft = (s: string) => setDraft(s);
  const onSaveTarget = () => {
    const parsed = parseHHMM(draft);
    if (!parsed) { setDraft(target ? format12(target) : '11:00 PM'); setEditing(false); return; }
    setTarget(parsed);
    setEditing(false);
    AsyncStorage.setItem(SLEEP_TIME_KEY, formatHHMM(parsed)).catch(() => {});
    haptic('light');
  };
  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT;

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
