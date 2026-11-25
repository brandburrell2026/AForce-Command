/**
 * The AFORCE Moment Live Activity (iOS 16.2+): the thin N–И mark in the
 * Dynamic Island and on the Lock Screen while a Moment is locked in.
 *
 * This module is handed NO Moment data, by design: no title, place, time or
 * score ever leaves the app. It is told only when the card goes stale.
 *
 * On Android, on older iOS and in a build without the native module, every
 * call is a quiet no-op.
 */
import { requireOptionalNativeModule } from 'expo';

type Native = {
  isEnabled(): boolean;
  start(staleAtMs: number): Promise<boolean>;
  end(): Promise<number>;
  runningCount(): number;
};

const native = requireOptionalNativeModule<Native>('MomentLiveActivity');

export const momentLiveActivityNative = {
  /** The native module is in this build. */
  present: native != null,
  isEnabled(): boolean {
    try {
      return native?.isEnabled() ?? false;
    } catch {
      return false;
    }
  },
  async start(staleAtMs: number): Promise<boolean> {
    try {
      return (await native?.start(staleAtMs)) ?? false;
    } catch {
      return false;
    }
  },
  async end(): Promise<number> {
    try {
      return (await native?.end()) ?? 0;
    } catch {
      return 0;
    }
  },
  runningCount(): number {
    try {
      return native?.runningCount() ?? 0;
    } catch {
      return 0;
    }
  },
};
