/**
 * useNightOutCommandTimer (NO-c) — owns the accepted Water-First command timer.
 *
 * On mount it RESTORES the authoritative record from local persistence and
 * re-derives the live view from the stored `startedAtMs` (so background /
 * force-close / reopen restore correctly). It ticks once a second only to
 * refresh the derived view — the stored timestamp is the source of truth, never
 * an in-memory counter. No scoring/intake/session side effects.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  makeCommandTimer,
  resolveCommandTimerView,
  type NightOutCommandTimer,
  type NightOutTimerView,
} from '@/services/nightOut/commandTimer';
import {
  loadCommandTimer,
  saveCommandTimer,
  clearCommandTimer,
} from '@/services/nightOut/commandTimerStore';

export interface UseNightOutCommandTimer {
  /** null until restored/accepted; otherwise the live derived view. */
  view: NightOutTimerView | null;
  /** The accepted command id this timer belongs to, if any. */
  activeCommandId: string | null;
  /** Accept a command → create + persist the authoritative timer. */
  start: (commandId: string, windowMs: number) => Promise<void>;
  /** Clear the timer (on completion / cancel). */
  clear: () => Promise<void>;
  restored: boolean;
}

export function useNightOutCommandTimer(): UseNightOutCommandTimer {
  const timerRef = useRef<NightOutCommandTimer | null>(null);
  const [view, setView] = useState<NightOutTimerView | null>(null);
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const recompute = useCallback(() => {
    const t = timerRef.current;
    setView(t ? resolveCommandTimerView(t, Date.now()) : null);
  }, []);

  // Restore from local persistence on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await loadCommandTimer();
      if (cancelled) return;
      timerRef.current = t;
      setActiveCommandId(t?.commandId ?? null);
      recompute();
      setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [recompute]);

  // 1s tick — only refreshes the DERIVED view; source of truth is the timestamp.
  useEffect(() => {
    if (!activeCommandId) return;
    const id = setInterval(recompute, 1000);
    return () => clearInterval(id);
  }, [activeCommandId, recompute]);

  const start = useCallback(
    async (commandId: string, windowMs: number) => {
      const t = makeCommandTimer(commandId, windowMs, Date.now());
      timerRef.current = t;
      setActiveCommandId(commandId);
      recompute();
      await saveCommandTimer(t);
    },
    [recompute],
  );

  const clear = useCallback(async () => {
    timerRef.current = null;
    setActiveCommandId(null);
    setView(null);
    await clearCommandTimer();
  }, []);

  return { view, activeCommandId, start, clear, restored };
}
