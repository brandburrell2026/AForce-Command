/**
 * Reminder level persistence — Priority #5.
 *
 * Stores the baseline reminder level (minimal / standard / aggressive)
 * per MEMBER (storage isolation PR C: ACCOUNT-SCOPED). How often a person
 * wants to be interrupted is a personal setting, not a property of the
 * handset, so on a shared device each member gets their own cadence.
 *
 * No in-memory cache: every call reads and writes through the scoped
 * facade, so there is no RAM to invalidate on an account switch. The
 * existing catch-to-default also makes the closed states safe — an
 * unresolvable scope yields the DEFAULT level, never another member's.
 * Default is 'standard'. There is NO settings panel: the level is set
 * programmatically and consumed by the adaptive policy gate. This keeps
 * the surface simple while leaving a clean seam for a future toggle.
 */
import { scopedStorage } from './scopedStorage';

import type { ReminderLevel } from '@/utils/reminders/adaptivePolicy';

const STORAGE_KEY = 'aforce.reminderLevel';
const DEFAULT_LEVEL: ReminderLevel = 'standard';
const VALID: ReadonlySet<ReminderLevel> = new Set([
  'minimal',
  'standard',
  'aggressive',
]);

export async function getReminderLevel(): Promise<ReminderLevel> {
  try {
    const raw = await scopedStorage.getItem(STORAGE_KEY);
    return raw && VALID.has(raw as ReminderLevel)
      ? (raw as ReminderLevel)
      : DEFAULT_LEVEL;
  } catch {
    return DEFAULT_LEVEL;
  }
}

export async function setReminderLevel(level: ReminderLevel): Promise<void> {
  if (!VALID.has(level)) return;
  try {
    await scopedStorage.setItem(STORAGE_KEY, level);
  } catch {
    /* non-fatal */
  }
}
