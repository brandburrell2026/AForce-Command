/**
 * Cruise Mode Screen — premium guest experience for life at sea (redesign).
 *
 * Cruise Mode is the **guest-facing** premium add-on. Crew / staff get
 * personalized hydration support through Social Mode, not this screen.
 *
 * This is a THIN CONTAINER. It gathers only REAL / first-party inputs —
 *   • live engine readiness score        (useEngineSlice().score)
 *   • real minutes since last intake      (useUserSlice().lastIntakeTime)
 *   • live OpenWeather environment        (fetchCruiseEnvironment)
 *   • the guest's own self-logged day     (local state; never assumed)
 * — resolves them with the pure `resolveCruiseModeView`, and renders the pure
 * `CruiseModeView`. No fabricated telemetry: the old demo-profile seeds are
 * gone (Constitution — never fabricate live data).
 *
 * Premium-gated via the `cruise_mode_enabled` feature flag (FeatureGate wrapper).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import * as Haptics from 'expo-haptics';
import { scopedStorage } from '@/services/scopedStorage';

import { GradientBackground } from '@/components/GradientBackground';
import { FeatureGate } from '@/components/FeatureGate';
import { af } from '@/theme/afTokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useCommandConfidence } from '@/hooks/useCommandConfidence';
import { useCycleSlice, useEngineSlice, useUserSlice, useActionsSlice, useFlagsSlice } from '@/store/slices';
import {
  fetchCruiseEnvironment,
  type CruiseLiveEnvironment,
} from '@/services/cruiseEnvService';
import {
  resolveCruiseModeView,
  EMPTY_SELF_LOG,
  clampSelfLog,
  encodeSelfLog,
  decodeSelfLog,
  type CruiseSelfLog,
  type CruiseLiveEnv,
} from '@/services/cruise/cruiseModeView';
import { CruiseModeView, type CruiseCrossNavItem } from '@/components/cruise/CruiseModeView';
import type { FluidType } from '@/types';

// Ports the user can switch the live environment to. Mirrors the api-server
// allow-list — adding one here without adding it on the server returns a 400.
const PORT_OPTIONS = [
  { id: 'miami', label: 'Miami' },
  { id: 'cozumel', label: 'Cozumel' },
  { id: 'nassau', label: 'Nassau' },
  { id: 'st_thomas', label: 'St. Thomas' },
  { id: 'cayman', label: 'Grand Cayman' },
  { id: 'juneau', label: 'Juneau' },
  { id: 'barcelona', label: 'Barcelona' },
] as const;

const CROSS_NAV: CruiseCrossNavItem[] = [
  { key: 'home', icon: 'droplet', label: 'Live Hydration Score', hint: 'Open command center' },
  { key: 'sweat', icon: 'activity', label: 'Sweat & Autopilot', hint: 'Sweat-rate calculator · recheck cadence' },
  { key: 'heat', icon: 'thermometer', label: 'Heat Mode', hint: 'Heat-index protocol · recovery' },
  { key: 'achievements', icon: 'award', label: 'Wellness Badges', hint: 'Streaks · achievements · progress' },
];

interface LogIntakeActions {
  logIntake: (fluidType: FluidType, opts?: { silent?: boolean; ozOverride?: number }) => Promise<void>;
  dismissSuccess: () => void;
}

const SELF_LOG_KEY = '@aforce/cruiseMode/selfLog';

/** Local calendar day (YYYY-MM-DD) — the self-log's scope. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toLiveEnv(env: CruiseLiveEnvironment): CruiseLiveEnv {
  return {
    portName: env.portName,
    conditions: env.conditions,
    ambientTempF: env.ambientTempF,
    humidityPct: env.humidityPct,
    sunExposureHours: env.sunExposureHours,
    windKts: env.windKts,
    source: env.source,
    // Wave-3 PR10: a fallback env has NO fetch time — em dash, never a
    // fabricated clock reading (honest-absence convention).
    fetchedAtLabel: env.fetchedAt ? formatClock(env.fetchedAt) : '\u2014',
  };
}

function CruiseModeBody() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const engine = useEngineSlice();
  const user = useUserSlice();
  const { logIntake, dismissSuccess } = useActionsSlice<LogIntakeActions>();
  const { showCycleSuccess, lastCycleResult } = useCycleSlice();
  // Section 58 — Command Confidence on the Guest Readiness readout, gated.
  const showConfidence = useFlagsSlice().spec_commandConfidenceDisplay;
  const commandConfidence = useCommandConfidence();

  const [portId, setPortId] = useState<string>('cozumel');
  const [liveEnv, setLiveEnv] = useState<CruiseLiveEnvironment | null>(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState(false);
  const [log, setLog] = useState<CruiseSelfLog>(EMPTY_SELF_LOG);
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick once a minute so minutes-since-last-intake (and the readiness it
  // feeds) can't go stale while the screen sits open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Hydrate today's persisted self-log on mount. Day-scoped: a log from a
  // different local day decodes to null (fresh day = fresh log — restoring
  // yesterday's drinks would fabricate today's load).
  useEffect(() => {
    let cancelled = false;
    scopedStorage.getItem(SELF_LOG_KEY)
      .then((raw) => {
        if (cancelled) return;
        const restored = decodeSelfLog(raw, todayKey());
        if (restored) setLog(restored);
      })
      .catch(() => { /* storage unavailable — keep the empty log */ });
    return () => { cancelled = true; };
  }, []);

  // Pull live conditions for the selected port. The api-server returns a
  // deterministic Caribbean baseline (source: 'fallback') when OpenWeather is
  // unavailable, so this never blocks the screen.
  useEffect(() => {
    let cancelled = false;
    setEnvLoading(true);
    setEnvError(false);
    fetchCruiseEnvironment(portId)
      .then((env) => { if (!cancelled) setLiveEnv(env); })
      .catch(() => { if (!cancelled) { setEnvError(true); setLiveEnv(null); } })
      .finally(() => { if (!cancelled) setEnvLoading(false); });
    return () => { cancelled = true; };
  }, [portId]);

  // Only trust the response when it matches the currently-selected port.
  const matchedEnv = liveEnv && liveEnv.port === portId ? liveEnv : null;

  // Real minutes since the last logged intake, recomputed on the minute tick
  // so it can't go stale on-screen. Guard the Date defensively — persisted
  // state can rehydrate it as a string.
  const minutesSinceLastIntake = useMemo<number | null>(() => {
    const t = user.lastIntakeTime;
    const ms = t instanceof Date ? t.getTime() : t ? new Date(t).getTime() : NaN;
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.round((now - ms) / 60000));
  }, [user.lastIntakeTime, now]);

  const hydrationScore = useMemo<number | null>(() => {
    const s = engine?.score;
    if (s == null || !Number.isFinite(s)) return null;
    return Math.max(0, Math.min(100, Math.round(s)));
  }, [engine?.score]);

  const view = useMemo(
    () =>
      resolveCruiseModeView({
        hydrationScore,
        minutesSinceLastIntake,
        env: matchedEnv ? toLiveEnv(matchedEnv) : null,
        envLoading,
        envError,
        portId,
        ports: PORT_OPTIONS,
        log,
        logWaterAvailable: typeof logIntake === 'function',
        reducedMotion,
      }),
    [hydrationScore, minutesSinceLastIntake, matchedEnv, envLoading, envError, portId, log, logIntake, reducedMotion],
  );

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as never);
  }, [router]);

  const onLogWater = useCallback(() => {
    if (typeof logIntake !== 'function') return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    void logIntake('water');
  }, [logIntake]);

  const onLogChange = useCallback((patch: Partial<CruiseSelfLog>) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setLog((prev) => {
      // Bound every patch (hours ≤ 24, drinks ≤ 20) and persist day-scoped so
      // navigating away doesn't silently zero the log (and quietly raise
      // readiness). Persistence is best-effort; the UI state is authoritative.
      const next = clampSelfLog({ ...prev, ...patch });
      scopedStorage.setItem(SELF_LOG_KEY, encodeSelfLog(next, todayKey())).catch(() => {});
      return next;
    });
  }, []);

  const onNavigate = useCallback((key: string) => {
    switch (key) {
      case 'home': router.replace('/(tabs)' as never); break;
      case 'sweat': router.push('/sweat' as never); break;
      case 'heat': router.push('/heat' as never); break;
      case 'achievements': router.push('/achievements' as never); break;
    }
  }, [router]);

  const topPadding = Platform.OS === 'web' ? 24 : insets.top;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <View style={[styles.tint]} pointerEvents="none" />
        <View style={{ flex: 1, paddingTop: topPadding }}>
          <CruiseModeView
            view={view}
            log={log}
            ports={PORT_OPTIONS}
            selectedPortId={portId}
            crossNav={CROSS_NAV}
            confidence={showConfidence ? commandConfidence ?? null : null}
            onBack={onBack}
            onSelectPort={setPortId}
            onLogWater={onLogWater}
            onLogChange={onLogChange}
            onNavigate={onNavigate}
          />
        </View>
      </GradientBackground>

      {/* S2-1 strand-proof: this screen's own "log a glass of water" write is
          non-silent, so the confirmation it raises must render HERE — before
          this mount, the raised showCycleSuccess stranded until the member
          visited Home, where it disabled the primary CTA. Rendered from the
          cycle slice's settled result, same contract as Home/Hydration. */}
      {showCycleSuccess && lastCycleResult && (
        <CycleSuccessOverlay result={lastCycleResult} onDismiss={dismissSuccess} />
      )}
    </View>
  );
}

export default function CruiseModeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: af.canvas }}>
      <FeatureGate
        flag="cruise_mode_enabled"
        title="Cruise Mode · Premium"
        description="Hydration intelligence for cruise guests at sea — live conditions, your self-logged day, and recovery demand in one place. Activate the demo to preview the full Cruise Mode product."
        accentColor={af.cyan}
        ctaLabel="Activate Cruise Demo"
      >
        <CruiseModeBody />
      </FeatureGate>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 8, 14, 0.35)' },
});
