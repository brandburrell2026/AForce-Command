import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory AsyncStorage backing the service. Hoisted so the vi.mock factory
// (which is itself hoisted to the top of the file) can close over it, and so
// it survives a vi.resetModules() "cold restart".
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

import type { VoiceCheckInAnswers } from '../../utils/voiceCheckIn';

const MORNING = new Date(2026, 5, 19, 7, 0);

function answers(energy: number, stress: number, goal = 'train'): VoiceCheckInAnswers {
  return { energy, stress, goal } as VoiceCheckInAnswers;
}

async function freshService() {
  vi.resetModules();
  const mod = await import('../voiceCheckIn');
  await mod.hydrateVoiceCheckIn();
  return mod;
}

describe('voiceCheckIn service · recording', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('records today and clears any snooze', async () => {
    const svc = await freshService();
    await svc.snoozeCheckIn(MORNING.getTime() + 3_600_000);
    expect(svc.getVoiceCheckInState().snoozedUntilMs).not.toBeNull();

    await svc.recordCheckIn(answers(4, 2), MORNING);
    const state = svc.getVoiceCheckInState();
    expect(state.records).toHaveLength(1);
    expect(state.snoozedUntilMs).toBeNull();
    expect(svc.selectLastCompletedDayKey(state)).toBe('2026-06-19');
  });

  it('overwrites an existing same-day record (latest wins)', async () => {
    const svc = await freshService();
    await svc.recordCheckIn(answers(2, 5), MORNING);
    await svc.recordCheckIn(answers(5, 1), new Date(2026, 5, 19, 8, 0));
    const state = svc.getVoiceCheckInState();
    expect(state.records).toHaveLength(1);
    expect(svc.selectLatestRecord(state)?.answers.energy).toBe(5);
  });

  it('clamps out-of-range answers and falls back to a valid goal', async () => {
    const svc = await freshService();
    await svc.recordCheckIn(answers(99, 0, 'sleep'), MORNING);
    const latest = svc.selectLatestRecord(svc.getVoiceCheckInState());
    expect(latest?.answers.energy).toBe(5);
    expect(latest?.answers.stress).toBe(1);
    expect(latest?.answers.goal).toBe('train');
  });
});

describe('voiceCheckIn service · due logic', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('is due in the morning before today is recorded, not after', async () => {
    const svc = await freshService();
    expect(svc.selectIsCheckInDue(svc.getVoiceCheckInState(), MORNING)).toBe(true);
    await svc.recordCheckIn(answers(3, 3), MORNING);
    expect(svc.selectIsCheckInDue(svc.getVoiceCheckInState(), MORNING)).toBe(false);
  });
});

describe('voiceCheckIn service · persistence survives a cold restart', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('reloads recorded check-ins from storage after resetModules', async () => {
    const first = await freshService();
    await first.recordCheckIn(answers(4, 2), MORNING);
    expect(mem.size).toBe(1); // actually written to storage

    const restarted = await freshService();
    const state = restarted.getVoiceCheckInState();
    expect(state.hydrated).toBe(true);
    expect(state.records).toHaveLength(1);
    expect(restarted.selectLatestRecord(state)?.answers.energy).toBe(4);
  });

  it('drops malformed persisted rows on load', async () => {
    mem.set(
      '@aforce/voice-checkin',
      JSON.stringify({
        records: [
          { dayKey: '2026-06-18', dayIndex: 20622, completedAtMs: 1, answers: { energy: 3, stress: 3, goal: 'focus' } },
          { dayKey: 'bad', answers: { energy: 'x' } },
          { nonsense: true },
        ],
        snoozedUntilMs: null,
      }),
    );
    const svc = await freshService();
    expect(svc.getVoiceCheckInState().records).toHaveLength(1);
  });
});
