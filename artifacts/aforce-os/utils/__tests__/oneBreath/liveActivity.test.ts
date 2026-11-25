import { describe, expect, it, vi } from 'vitest';
import type { Moment } from '@/types/moments';
import { LIVE_ACTIVITY_MAX_MS, liveActivityDecision, momentReturnRoute } from '@/utils/oneBreath/liveActivity';
import { createLiveActivitySync, type LiveActivityNative } from '@/services/momentLiveActivitySync';
import { afterSignInRoute, rememberMomentReturn, takeMomentReturn } from '@/services/momentReturn';

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-11-22T18:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

function plan(over: Record<string, unknown> = {}): Moment {
  return {
    id: 'm1',
    source: 'manual',
    title: 'Dinner with Lilia',
    type: 'personal',
    importance: 'high',
    startAtIso: iso(T0),
    createdAtIso: iso(T0 - HOUR),
    preparation: { context: 'one_breath', sealedAtIso: iso(T0 - HOUR), ...over },
  } as unknown as Moment;
}
const lockedIn = (over: Record<string, unknown> = {}) => plan({ lockedInAtIso: iso(T0 - 10 * 60_000), ...over });

describe('when the mark shows', () => {
  it('shows while a One Breath plan is locked in', () => {
    const d = liveActivityDecision([lockedIn()], T0);
    expect(d).toEqual({ kind: 'run', momentId: 'm1', staleAtMs: T0 + LIVE_ACTIVITY_MAX_MS });
  });

  it('does not show for a plan that is only sealed, or still a draft', () => {
    expect(liveActivityDecision([plan()], T0).kind).toBe('none');
    expect(liveActivityDecision([plan({ sealedAtIso: '' })], T0).kind).toBe('none');
  });

  it('ends when the plan is completed or cancelled', () => {
    expect(liveActivityDecision([lockedIn({ returnedAtIso: iso(T0 + HOUR) })], T0 + HOUR).kind).toBe('none');
    expect(liveActivityDecision([lockedIn({ cancelledAtIso: iso(T0 + HOUR) })], T0 + HOUR).kind).toBe('none');
  });

  it('expires: an abandoned Moment does not leave the card up', () => {
    expect(liveActivityDecision([lockedIn()], T0 + LIVE_ACTIVITY_MAX_MS - 1).kind).toBe('run');
    expect(liveActivityDecision([lockedIn()], T0 + LIVE_ACTIVITY_MAX_MS).kind).toBe('none');
  });

  it('nothing shows with no Moments (signed out, or a new account)', () => {
    expect(liveActivityDecision([], T0).kind).toBe('none');
  });

  it('carries no Moment title, place, time or score: only an id and an expiry', () => {
    const d = liveActivityDecision([lockedIn()], T0);
    expect(Object.keys(d).sort()).toEqual(['kind', 'momentId', 'staleAtMs']);
    expect(JSON.stringify(d)).not.toContain('Lilia');
  });
});

describe('where a tap goes', () => {
  it('to One Breath while the Moment is locked in', () => {
    expect(momentReturnRoute([lockedIn()], T0)).toBe('/one-breath');
  });
  it('to Moments when it has ended, expired or is not on this phone', () => {
    expect(momentReturnRoute([lockedIn({ returnedAtIso: iso(T0) })], T0)).toBe('/moments-tab');
    expect(momentReturnRoute([lockedIn()], T0 + LIVE_ACTIVITY_MAX_MS)).toBe('/moments-tab');
    expect(momentReturnRoute([], T0)).toBe('/moments-tab');
  });
});

function fakeNative(over: Partial<LiveActivityNative> = {}) {
  let running = 0;
  const native = {
    isEnabled: vi.fn(() => true),
    start: vi.fn(async () => { running = 1; return true; }),
    end: vi.fn(async () => { const n = running; running = 0; return n; }),
    runningCount: vi.fn(() => running),
    ...over,
  };
  return { native, setRunning: (n: number) => { running = n; } };
}

describe('keeping the activity in step', () => {
  it('starts once on Lock In, and a repeat for the same state does nothing', async () => {
    const { native } = fakeNative();
    const live = createLiveActivitySync(native);
    await live.sync([lockedIn()], T0);
    await live.sync([lockedIn()], T0 + 1000);
    await live.sync([lockedIn()], T0 + 2000);
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledWith(T0 + LIVE_ACTIVITY_MAX_MS);
    expect(native.end).not.toHaveBeenCalled();
  });

  it('ends on completion, on cancel and at expiry', async () => {
    for (const closed of [lockedIn({ returnedAtIso: iso(T0) }), lockedIn({ cancelledAtIso: iso(T0) })]) {
      const { native } = fakeNative();
      const live = createLiveActivitySync(native);
      await live.sync([lockedIn()], T0);
      await live.sync([closed], T0 + 1000);
      expect(native.end).toHaveBeenCalledTimes(1);
    }
    const { native } = fakeNative();
    const live = createLiveActivitySync(native);
    await live.sync([lockedIn()], T0);
    await live.sync([lockedIn()], T0 + LIVE_ACTIVITY_MAX_MS);
    expect(native.end).toHaveBeenCalledTimes(1);
  });

  it('a fresh launch adopts the card iOS kept instead of starting a second one', async () => {
    const { native, setRunning } = fakeNative();
    setRunning(1);
    const live = createLiveActivitySync(native);
    await live.sync([lockedIn()], T0);
    expect(native.start).not.toHaveBeenCalled();
  });

  it('a fresh launch clears a card left over from a Moment that has ended', async () => {
    const { native, setRunning } = fakeNative();
    setRunning(1);
    const live = createLiveActivitySync(native);
    await live.sync([], T0);
    expect(native.end).toHaveBeenCalledTimes(1);
  });

  it('with Live Activities switched off nothing is started and nothing throws', async () => {
    const { native } = fakeNative({ isEnabled: vi.fn(() => false) });
    const live = createLiveActivitySync(native);
    await expect(live.sync([lockedIn()], T0)).resolves.toBeUndefined();
    expect(native.start).not.toHaveBeenCalled();
  });

  it('a failed start is not remembered as shown, so the next check tries again', async () => {
    const start = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { native } = fakeNative({ start });
    const live = createLiveActivitySync(native);
    await live.sync([lockedIn()], T0);
    await live.sync([lockedIn()], T0 + 1000);
    expect(start).toHaveBeenCalledTimes(2);
  });
});

describe('sign-in recovery', () => {
  it('sign-in goes to Home unless a tap on the mark is waiting', () => {
    takeMomentReturn();
    expect(afterSignInRoute()).toBe('/(tabs)');
    rememberMomentReturn();
    expect(afterSignInRoute()).toBe('/moment-return');
  });
  it('the waiting tap is used once', () => {
    rememberMomentReturn();
    expect(takeMomentReturn()).toBe(true);
    expect(takeMomentReturn()).toBe(false);
    expect(afterSignInRoute()).toBe('/(tabs)');
  });
});
