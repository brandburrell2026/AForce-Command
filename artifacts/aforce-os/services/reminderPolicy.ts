/**
 * Reminder level persistence — Priority #5.
 *
 * Stores the baseline reminder level (minimal / standard / aggressive)
 * in AsyncStorage, mirroring the existing `aforce.*` preference keys.
 * Default is 'standard'. There is NO settings panel: the level is set
 * programmatically and consumed by the adaptive policy gate. This keeps
 * the surface simple while leaving a clean seam for a future toggle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
    await AsyncStorage.setItem(STORAGE_KEY, level);
  } catch {
    /* non-fatal */
  }
}
