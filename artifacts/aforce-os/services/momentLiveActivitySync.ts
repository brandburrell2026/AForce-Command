/**
 * Keeps the AFORCE Live Activity in step with the saved Moments.
 *
 * It follows state; it never changes it. Lock In, Quiet, completing and
 * cancelling all stay with their owners. This only watches the result and
 * shows or removes the mark, so every way of locking in (and every way a plan
 * ends, including sign-out) is covered by one rule and a second call for the
 * same state does nothing.
 */
import type { Moment } from '@/types/moments';
import { liveActivityDecision } from '@/utils/oneBreath/liveActivity';

export interface LiveActivityNative {
  isEnabled(): boolean;
  start(staleAtMs: number): Promise<boolean>;
  end(): Promise<number>;
  runningCount(): number;
}

export function createLiveActivitySync(native: LiveActivityNative) {
  /** What this process last asked for, so a repeat is a no-op. */
  let shown: string | null = null;
  let chain: Promise<void> = Promise.resolve();

  const apply = async (moments: readonly Moment[], nowMs: number): Promise<void> => {
    const decision = liveActivityDecision(moments, nowMs);
    if (decision.kind === 'run') {
      const key = `${decision.momentId}:${decision.staleAtMs}`;
      // Already showing for this Moment: leave it. (A fresh process finds the
      // card iOS kept and adopts it rather than starting a second one.)
      if (native.runningCount() > 0 && (shown === key || shown === null)) {
        shown = key;
        return;
      }
      // Live Activities switched off: nothing is shown and nothing else changes.
      if (!native.isEnabled()) {
        shown = null;
        return;
      }
      shown = (await native.start(decision.staleAtMs)) ? key : null;
      return;
    }
    if (shown !== null || native.runningCount() > 0) await native.end();
    shown = null;
  };

  return {
    /** Calls are applied one at a time, in order. */
    sync(moments: readonly Moment[], nowMs: number = Date.now()): Promise<void> {
      chain = chain.then(() => apply(moments, nowMs)).catch(() => undefined);
      return chain;
    },
  };
}
