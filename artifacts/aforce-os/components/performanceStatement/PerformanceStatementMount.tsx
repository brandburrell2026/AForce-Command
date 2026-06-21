/**
 * PerformanceStatementMount — delivers the once-per-local-day, VOICE-ONLY
 * Performance Statement™.
 *
 * Mirrors OpeningMount / VoiceCheckInMount: an AppShell-mounted side-effect that
 * touches NO routing and renders NOTHING (no quote card, no text, no archive, no
 * replay button — "if you miss it, you miss it"). It speaks a single short coach
 * identity line, then records the local day so it never repeats that day.
 *
 * Gating: flag on + opening dismissed + onboarding complete + service hydrated +
 * a real app route. It also never talks over the morning Voice Check-In — it
 * blocks while a check-in is DUE and for a short window AFTER one completes
 * (re-checked with a single revalidation timer, since the check-in store only
 * notifies on writes). If Voice Coach playback is muted it skips WITHOUT marking
 * delivered, so the statement can still play later the same day once unmuted.
 *
 * Score-Protection: the line is a display/audio-only projection — it dispatches
 * no reducer action and never awards, mutates, or fabricates score. When the
 * `performance_statements_enabled` flag is off this component returns null before
 * any effect runs, so the build is byte-identical with the feature dark.
 */
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';

import { useFeatureFlags } from '@/store/useAppStore';
import { usePerformanceStatement } from '@/hooks/usePerformanceStatement';
import { isVoicePlaybackEnabled, speak } from '@/services/textToSpeech';
import {
  selectIsCheckInDue,
  selectLatestRecord,
  useVoiceCheckInStore,
} from '@/services/voiceCheckIn';

const ONBOARDING_DONE_KEY = 'aforce.hasCompletedOnboarding';

/** Small settle delay before speaking so it never clips a screen transition. */
const SPEAK_DELAY_MS = 1200;
/** Don't speak within this window after a check-in completes (clears its audio). */
const RECENT_CHECKIN_MS = 90_000;

/**
 * Outer flag gate. Reads ONLY the feature flag and renders nothing when it is
 * off, so the inner component — and therefore every Performance Statement hook,
 * effect, AsyncStorage read, AppState listener, and timer — never runs while the
 * feature is dark. This is the flag-off inert lock ("byte-identical when off"):
 * with `performance_statements_enabled` false this component returns null before
 * any feature side-effect can fire.
 */
export function PerformanceStatementMount({
  openingDone,
}: {
  openingDone: boolean;
}) {
  const flags = useFeatureFlags();
  if (!flags.performance_statements_enabled) return null;
  return <PerformanceStatementMountInner openingDone={openingDone} />;
}

function PerformanceStatementMountInner({
  openingDone,
}: {
  openingDone: boolean;
}) {
  const flags = useFeatureFlags();
  const pathname = usePathname();
  const checkInState = useVoiceCheckInStore();
  const { hydrated, alreadySpokenToday, descriptor, text, level, markDelivered } =
    usePerformanceStatement();

  const [onboardingComplete, setOnboardingComplete] = React.useState(false);
  // Bumped to re-evaluate the time-based "recently completed" block when its
  // window expires (the check-in store only notifies on writes).
  const [, setRevalidateTick] = React.useState(0);
  const spokenRef = React.useRef(false);

  // Re-read the onboarding flag whenever the route changes so it flips true
  // immediately after the wizard finishes and routes into the tabs.
  React.useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(ONBOARDING_DONE_KEY)
      .then((v) => {
        if (alive) setOnboardingComplete(v === 'true');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  const routeOk =
    !pathname.startsWith('/onboarding') && !pathname.startsWith('/sign');

  // Never talk over the morning Voice Check-In: block while it is due, and for a
  // short window after the most recent one completed (covers its closing audio).
  const checkInDue =
    flags.voice_checkin_enabled && selectIsCheckInDue(checkInState);
  const latestCheckIn = selectLatestRecord(checkInState);
  const completedAgoMs = latestCheckIn
    ? Date.now() - latestCheckIn.completedAtMs
    : Number.POSITIVE_INFINITY;
  const recentlyCompletedCheckIn =
    flags.voice_checkin_enabled && completedAgoMs < RECENT_CHECKIN_MS;

  const gatesOpen =
    flags.performance_statements_enabled &&
    hydrated &&
    onboardingComplete &&
    openingDone &&
    routeOk &&
    !checkInDue &&
    !recentlyCompletedCheckIn;

  // When the only thing blocking is a recent check-in, schedule a single
  // re-check at the window's expiry so the statement can play afterwards.
  React.useEffect(() => {
    if (spokenRef.current || alreadySpokenToday) return;
    if (checkInDue || !recentlyCompletedCheckIn) return;
    const delay = RECENT_CHECKIN_MS - completedAgoMs;
    if (delay <= 0) return;
    const id = setTimeout(() => setRevalidateTick((t) => t + 1), delay + 50);
    return () => clearTimeout(id);
  }, [checkInDue, recentlyCompletedCheckIn, completedAgoMs, alreadySpokenToday]);

  React.useEffect(() => {
    if (spokenRef.current) return;
    if (!gatesOpen || alreadySpokenToday) return;
    if (!descriptor || !text) return;
    // Only deliver while the app is foregrounded.
    if (AppState.currentState !== 'active') return;
    // Muted: skip WITHOUT marking delivered so it retries later when unmuted.
    if (!isVoicePlaybackEnabled()) return;

    const timer = setTimeout(() => {
      if (spokenRef.current) return;
      // Re-check at speak time in case the app backgrounded or was muted during
      // the delay — never speak/mark while inactive or muted.
      if (AppState.currentState !== 'active') return;
      if (!isVoicePlaybackEnabled()) return;
      spokenRef.current = true;
      speak(text, { level });
      void markDelivered(descriptor.id);
    }, SPEAK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [gatesOpen, alreadySpokenToday, descriptor, text, level, markDelivered]);

  // Re-evaluate when the app returns to the foreground (covers a mute toggle or
  // a check-in completed while backgrounded).
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') setRevalidateTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  return null;
}
