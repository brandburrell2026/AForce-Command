/**
 * useAppStateGatedInterval — RC-1 Wave-3 P1 perf fix (audit P0-2).
 *
 * AppState-gates a periodic timer so it produces ZERO
 * dispatches/fetches while the app is backgrounded. Used by
 * `store/useAppStore.tsx` for its three long-lived timers (the 1s
 * countdown tick, the 30s /state poll, the 15min weather refresh) — all
 * three previously kept firing in the background, burning battery/data
 * for a screen nobody can see.
 *
 * This ONLY changes an interval's lifecycle (pause on background, resume
 * on foreground); it never changes what a tick does — callers pass the
 * exact same callback, cadence, and (indirectly, via the callback's own
 * closure) dispatch payloads they used with a plain `setInterval`. On
 * returning to the foreground the callback also fires once immediately
 * (rather than waiting for the next full interval), so a returning user
 * isn't stuck looking at stale state for up to a full cadence — most
 * notably the 30s poll and the 15min weather refresh, where "wait for the
 * next tick" could mean sitting on minutes-stale data.
 *
 * Extracted to its own module (rather than living inline in the very
 * large `useAppStore.tsx`) so it can be unit-tested in isolation: the
 * store file transitively imports a long chain of native/expo services
 * (phantom band BLE, TTS, secure storage, i18n, …) that currently fail to
 * even load under this repo's node-environment vitest run (a pre-existing
 * `__DEV__ is not defined` gap in `expo-modules-core`, unrelated to this
 * fix) — this hook's only dependency is `react-native`'s `AppState`, so
 * it has none of that baggage.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAppStateGatedInterval(callback: () => void, intervalMs: number): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    // Tracks the AppState value as of the last processed 'change' event
    // (seeded with the state at mount). RC-1 W3P1 fix-forward, should-fix
    // 3: resume-fire used to trigger on EVERY 'active' event unconditionally
    // — but cold-start permission dialogs (HealthKit, location,
    // notifications) and Control Center emit inactive → active pairs (or
    // even back-to-back 'active' events) without a genuine background stop
    // ever having happened, causing a spurious extra poll/weather fetch.
    // Resume-fire now only runs on a GENUINE non-active → active edge — i.e.
    // the previously-recorded state was itself not 'active' (a real `stop()`
    // ran). An active → active event still calls `start()` (a no-op, since
    // `start()` already guards on `interval != null`), just skips the
    // callback invocation.
    let previous: AppStateStatus = AppState.currentState;
    const start = () => {
      if (interval != null) return;
      interval = setInterval(() => callbackRef.current(), intervalMs);
    };
    const stop = () => {
      if (interval != null) {
        clearInterval(interval);
        interval = null;
      }
    };
    if (previous === 'active') start();
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasActive = previous === 'active';
      previous = next;
      if (next === 'active') {
        if (!wasActive) {
          // Genuine background/inactive → active edge: don't make a
          // returning user wait for the next tick.
          callbackRef.current();
        }
        start();
      } else {
        stop();
      }
    });
    return () => {
      stop();
      sub.remove();
    };
    // `intervalMs` is a literal constant at every call site in this repo —
    // this effect runs once per mount, same as a plain `setInterval` call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
