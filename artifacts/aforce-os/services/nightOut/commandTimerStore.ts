/**
 * Night Out command-timer persistence (NO-c).
 *
 * Persists the authoritative command-start record to LOCAL AsyncStorage so the
 * timer survives backgrounding / force-close / reopen / device restart (the view
 * is always re-derived from `startedAtMs` + `now`, never from an in-memory
 * counter).
 *
 * SCOPE / HONESTY: this is DEVICE-LOCAL only. There is NO server persistence for
 * this timer, so **cross-device restoration is NOT supported** and must not be
 * claimed. Building server persistence would be a schema/persistence decision
 * outside NO-c's approved scope.
 *
 * IO only — no scoring/intake/session mutation.
 */
import { scopedStorage } from '../scopedStorage';
import type { NightOutCommandTimer } from './commandTimer';

const KEY = 'aforce_night_out_command_timer_v1';

export async function saveCommandTimer(timer: NightOutCommandTimer): Promise<void> {
  try {
    await scopedStorage.setItem(KEY, JSON.stringify(timer));
  } catch {
    // best-effort; a failed persist just means restoration won't have this record
  }
}

export async function loadCommandTimer(): Promise<NightOutCommandTimer | null> {
  try {
    const raw = await scopedStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NightOutCommandTimer;
    if (
      parsed &&
      typeof parsed.startedAtMs === 'number' &&
      typeof parsed.windowMs === 'number' &&
      typeof parsed.commandId === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    // Corrupted payload → treat as no timer (the resolver renders a safe state).
    return null;
  }
}

export async function clearCommandTimer(): Promise<void> {
  try {
    await scopedStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
