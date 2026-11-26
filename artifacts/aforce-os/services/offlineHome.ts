import type { UserState, IntakeEvent } from '@/types';
import type { OutboxItem } from '@/utils/intakeOutbox';
import type { JourneyStorage } from './travel/journey';
import { createChunkStorage } from './travel/chunkStorage';

const day = (ms: number) => new Date(ms).toDateString();
const ownerKey = (owner: string) => `aforce.offline-home.v1.${Array.from(owner).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}`;

/** An account-owned snapshot, never evidence of a fresh server response. */
export function createOfflineHomeRepository(storage: JourneyStorage) {
  const chunks = createChunkStorage(storage);
  let writes = Promise.resolve();
  return {
    save(owner: string, state: UserState, now = Date.now()): Promise<void> {
      const raw = JSON.stringify({ version: 1, owner, savedAt: now, state });
      const task = writes.then(() => chunks.setItem(ownerKey(owner), raw));
      writes = task.catch(() => {});
      return task;
    },
    async load(owner: string): Promise<{ state: Record<string, unknown>; savedAt: number } | null> {
      const raw = await chunks.getItem(ownerKey(owner));
      if (!raw) return null;
      try {
        const value = JSON.parse(raw);
        const state = value.state;
        if (value.version !== 1 || value.owner !== owner || !Number.isFinite(value.savedAt) || !state ||
          !['unitsConsumedToday', 'ozConsumedToday', 'aforceUnitsToday', 'ozTarget', 'dailyTarget'].every(k => typeof state[k] === 'number' && Number.isFinite(state[k]) && state[k] >= 0)) return null;
        return { state, savedAt: value.savedAt };
      } catch { return null; }
    },
  };
}

/** Restore frozen events, once each. Yesterday's totals never become today's. */
export function projectOfflineHome(base: UserState, savedAt: number, items: readonly OutboxItem[], now = Date.now()): UserState {
  const state = { ...base, intakeEvents: [...(base.intakeEvents ?? [])] };
  if (day(savedAt) !== day(now)) {
    state.unitsConsumedToday = 0;
    state.ozConsumedToday = 0;
    state.aforceUnitsToday = 0;
  }
  const known = new Set(state.intakeEvents.map(e => e.id));
  for (const item of items) {
    const p = item.prepared, at = Date.parse(p.event.loggedAt);
    if (known.has(p.event.id) || !Number.isFinite(at)) continue;
    // Retain recent events for the existing absorption model; daily counters
    // follow the local day, while old entries remain queued for historical replay.
    if (at <= now && now - at < 86400000) {
      state.intakeEvents.push({ ...p.event, loggedAt: new Date(at) } as IntakeEvent);
      known.add(p.event.id);
    }
    if (day(at) !== day(now) || at > now) continue;
    state.unitsConsumedToday += 1;
    state.ozConsumedToday += p.ozAmount;
    state.aforceUnitsToday += p.fluidType.startsWith('aforce_') ? 1 : 0;
    if (at >= state.lastIntakeTime.getTime()) {
      state.lastIntakeTime = new Date(at);
      state.lastIntakeType = p.event.fluidType;
    }
  }
  return state;
}
