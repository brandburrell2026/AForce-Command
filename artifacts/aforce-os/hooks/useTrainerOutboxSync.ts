/**
 * Binds the outbox scheduler to a screen's lifecycle.
 *
 * Everything decidable is decided in `trainerScheduler`, which is pure and
 * tested against an injected clock. This is the thin layer that supplies the
 * real clock, the real timers, AppState, and the queue the screen is holding
 * — and nothing else. Logic that lands here is logic that cannot be tested
 * without rendering, which is why there is so little of it.
 *
 * The queue lives in a ref as well as in state: the scheduler reads it on
 * every pass and must see what was enqueued a moment ago, not what React had
 * rendered when the pass started.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import type { OutboxItem } from "@/utils/trainerOutbox";
import { createOutboxScheduler, type Scheduler } from "@/utils/trainerScheduler";
import type { SyncTransport } from "@/utils/trainerSync";

export interface UseTrainerOutboxSyncArgs {
  queue: readonly OutboxItem[];
  /** Applies the scheduler's result to screen state AND to storage. */
  onQueueChange(next: OutboxItem[]): void | Promise<void>;
  /** Null while signed out or while the surface is disabled: nothing runs. */
  transport: SyncTransport | null;
  enabled?: boolean;
  onError?(err: unknown): void;
}

export function useTrainerOutboxSync({
  queue,
  onQueueChange,
  transport,
  enabled = true,
  onError,
}: UseTrainerOutboxSyncArgs): { flushNow: () => Promise<void> } {
  const queueRef = useRef<readonly OutboxItem[]>(queue);
  queueRef.current = queue;

  const onQueueChangeRef = useRef(onQueueChange);
  onQueueChangeRef.current = onQueueChange;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const schedulerRef = useRef<Scheduler | null>(null);

  const scheduler = useMemo(() => {
    if (!transport || !enabled) return null;
    return createOutboxScheduler({
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      getQueue: () => queueRef.current,
      setQueue: (next) => onQueueChangeRef.current(next),
      transport,
      onError: (err) => onErrorRef.current?.(err),
    });
  }, [transport, enabled]);

  schedulerRef.current = scheduler;

  useEffect(() => {
    if (!scheduler) return undefined;
    scheduler.start();
    return () => scheduler.stop();
  }, [scheduler]);

  // Foreground is the moment that matters: a trainer walking back into
  // signal with a morning's work queued.
  useEffect(() => {
    if (!scheduler) return undefined;
    const handler = (state: AppStateStatus): void => {
      if (state === "active") scheduler.onForeground();
      else scheduler.onBackground();
    };
    const subscription = AppState.addEventListener("change", handler);
    return () => subscription.remove();
  }, [scheduler]);

  // A new entry should not wait for the next timer.
  const pendingCount = queue.filter((q) => q.state === "pending").length;
  useEffect(() => {
    schedulerRef.current?.onEnqueued();
  }, [pendingCount]);

  const flushNow = useCallback(async () => {
    await schedulerRef.current?.flushNow();
  }, []);

  return { flushNow };
}
