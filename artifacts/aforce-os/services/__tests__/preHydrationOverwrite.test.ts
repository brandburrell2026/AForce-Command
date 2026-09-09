/**
 * PRE-HYDRATION OVERWRITE LAWS — a mutation issued before the first disk read
 * must never destroy the member's stored history.
 *
 * THE DEFECT THESE PIN. Three stores flipped `hydrated: true` inside their
 * mutator and then persisted immediately:
 *
 *     setState({ records: [...], hydrated: true });
 *     return persist();
 *
 * `hydrate…()` begins with `if (current.hydrated) return Promise.resolve()`, so
 * that flag short-circuits the disk read that was supposed to merge stored
 * history — and `persist()` then writes a snapshot containing ONLY the new
 * record over the top of it. One tap after a cold start, silently, and the
 * member's history is gone.
 *
 * WHY IT WAS INVISIBLE. Module-evaluation hydration (`void hydrateX()` at
 * import) always started the read first, so `hydrating` was already non-null
 * and the mutator's call joined the in-flight load instead of short-circuiting
 * it. The bug was fully present and permanently masked by an import-time race.
 * Removing that hydration — because it read storage before identity existed,
 * under the pre-isolation GLOBAL key — is what exposed it.
 *
 * `hydroScanHistory` had a test for this and it went red immediately.
 * `intentCapture` and `voiceCheckIn` had the identical defect and NO test, so
 * they would have shipped the data loss. These are those two laws.
 *
 * The repaired shape is `commandLedger`'s, which was always correct: keep
 * `hydrated: current.hydrated`, and chain the persist behind hydration so the
 * write happens only after storage has been read and merged.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

vi.mock('../secureStorage', () => ({
  secureKV: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

beforeEach(() => {
  mem.clear();
});

/** Let the persist queue drain. */
async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('LAW — intentCapture: a record before first hydration keeps stored history', () => {
  it('does not clobber yesterday’s persisted intent', async () => {
    mem.set(
      '@aforce/intent-capture',
      JSON.stringify({
        records: [
          {
            dayKey: '2026-06-18',
            dayIndex: 20257,
            recordedAtMs: Date.UTC(2026, 5, 18, 9, 0),
            intent: 'ready',
            source: 'voiceCheckIn',
          },
        ],
      }),
    );

    vi.resetModules();
    const mod = await import('../intentCapture');
    // Record BEFORE awaiting hydration — exactly what a member does when they
    // act on the first screen after a cold start.
    const p = mod.recordIntent('recovering', 'voiceCheckIn', new Date(2026, 5, 19, 8, 0));
    await mod.hydrateIntentCapture();
    await p;
    await flush();

    const days = mod
      .getIntentCaptureState()
      .records.map((r) => r.dayKey)
      .sort();
    expect(days, 'the persisted day must survive the pre-hydration write').toEqual([
      '2026-06-18',
      '2026-06-19',
    ]);

    // And the DISK must agree — an in-memory merge that never reaches storage
    // would still lose the history on the next cold start.
    const onDisk = JSON.parse(mem.get('@aforce/intent-capture') as string) as {
      records: Array<{ dayKey: string }>;
    };
    expect(onDisk.records.map((r) => r.dayKey).sort()).toEqual([
      '2026-06-18',
      '2026-06-19',
    ]);
    // MUTATION: restore `hydrated: true` in recordIntent, or drop the
    // `hydrateIntentCapture().then(...)` chain → red.
  });
});

describe('LAW — voiceCheckIn: a check-in before first hydration keeps stored history', () => {
  it('does not clobber yesterday’s persisted check-in', async () => {
    mem.set(
      '@aforce/voice-checkin',
      JSON.stringify({
        records: [
          {
            dayKey: '2026-06-18',
            dayIndex: 20257,
            completedAtMs: Date.UTC(2026, 5, 18, 9, 0),
            answers: { energy: 3, stress: 2, goal: 'train' },
          },
        ],
        snoozedUntilMs: null,
      }),
    );

    vi.resetModules();
    const mod = await import('../voiceCheckIn');
    const p = mod.recordCheckIn(
      { energy: 4, stress: 1, goal: 'recover' },
      new Date(2026, 5, 19, 8, 0),
    );
    await mod.hydrateVoiceCheckIn();
    await p;
    await flush();

    const days = mod
      .getVoiceCheckInState()
      .records.map((r) => r.dayKey)
      .sort();
    expect(days, 'the persisted day must survive the pre-hydration write').toEqual([
      '2026-06-18',
      '2026-06-19',
    ]);
    // MUTATION: restore `hydrated: true` in recordCheckIn, or drop the
    // `hydrateVoiceCheckIn().then(...)` chain → red.
  });

  it('a snooze before first hydration does not clobber stored check-ins either', async () => {
    mem.set(
      '@aforce/voice-checkin',
      JSON.stringify({
        records: [
          {
            dayKey: '2026-06-18',
            dayIndex: 20257,
            completedAtMs: Date.UTC(2026, 5, 18, 9, 0),
            answers: { energy: 3, stress: 2, goal: 'train' },
          },
        ],
        snoozedUntilMs: null,
      }),
    );

    vi.resetModules();
    const mod = await import('../voiceCheckIn');
    const p = mod.snoozeCheckIn(Date.UTC(2026, 5, 19, 12, 0));
    await mod.hydrateVoiceCheckIn();
    await p;
    await flush();

    expect(mod.getVoiceCheckInState().records.map((r) => r.dayKey)).toEqual(['2026-06-18']);
    expect(mod.getVoiceCheckInState().snoozedUntilMs).toBe(Date.UTC(2026, 5, 19, 12, 0));
    // A snooze is the cheapest possible interaction and it could erase a
    // member's entire check-in history. MUTATION: restore `hydrated: true`
    // in snoozeCheckIn → red.
  });
});
