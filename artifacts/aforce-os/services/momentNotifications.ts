/**
 * momentNotifications — AForce Moments prep notifications (Phase 3a, DR-010).
 *
 * Two layers, mirroring the Day-cadence pair (notifications.ts +
 * pushNotifications.ts):
 *   1. A PURE planner — `planMomentNotifications(moments, prefs, nowIso)` —
 *      fully deterministic and unit-tested. It enforces every DR-010
 *      interruption-budget constraint from config/hydroStateModel.ts:
 *      quiet hours, ≥60-min gap, daily cap, high/moderate importance only
 *      (unless the user opts into all), never past-due, never after the
 *      moment starts, prepared/started moments dropped.
 *   2. A native bridge — schedule/cancel via lazy expo-notifications with
 *      `aforce.moment.<id>` tags and wipe-own-tags idempotency. Local only;
 *      no remote push; no background execution; web/sim no-op.
 *
 * Copy is BEHAVIORAL ONLY (DR-010 constraint 1): moment title, time, one
 * action — never a predicted value, score, or band. This stream is separate
 * from the Day-0/1/3/7 cadence; both caps bind independently.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Moment } from '@/types/moments';
import { buildRecommendation } from '@/services/momentRecommendation';
import {
  MOMENT_NOTIFY_MAX_PER_DAY,
  MOMENT_NOTIFY_MIN_GAP_MIN,
  MOMENT_NOTIFY_QUIET_START_HOUR,
  MOMENT_NOTIFY_QUIET_END_HOUR,
  MOMENT_NOTIFY_LEAD_PRESETS_MIN,
} from '@/config/hydroStateModel';

const TAG_PREFIX = 'aforce.moment.';
const PREFS_KEY = '@aforce/momentNotifyPrefs';
const MIN_MS = 60_000;

export type MomentNotifyMode = 'important' | 'all';

export interface MomentNotifyPrefs {
  mode: MomentNotifyMode;
  /** Minutes before the moment start; null = fire at prep-window start. */
  leadMin: number | null;
  /** Phase 4 (DR-012): feedback-tuned lead. Requires moments_learning_enabled;
   *  when true, leadMin is ignored and the window start shifts by the
   *  bounded per-type adjustment. */
  adaptive?: boolean;
}

export const DEFAULT_MOMENT_NOTIFY_PREFS: MomentNotifyPrefs = {
  mode: 'important',
  leadMin: null,
  adaptive: false,
};

export interface PlannedMomentNotification {
  momentId: string;
  tag: string;
  fireAtIso: string;
  /** i18n keys + params — resolved to strings at schedule time. */
  titleKey: string;
  titleParams: Record<string, string | number>;
  bodyKey: string;
  bodyParams: Record<string, string | number>;
}

function isQuietHour(date: Date): boolean {
  const h = date.getHours();
  // Window wraps midnight (22:00 → 07:00).
  return h >= MOMENT_NOTIFY_QUIET_START_HOUR || h < MOMENT_NOTIFY_QUIET_END_HOUR;
}

function clockLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
}

function localDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * PURE: decide which prep notifications may fire, applying every DR-010
 * guardrail. Output is chronological.
 */
export function planMomentNotifications(
  moments: readonly Moment[],
  prefs: MomentNotifyPrefs,
  nowIso: string,
  /** DR-012 per-type lead adjustments (minutes; + = earlier). Applied ONLY
   *  when prefs.adaptive; every DR-010 guardrail still applies after. */
  adjustments?: Partial<Record<Moment['type'], number>>,
): PlannedMomentNotification[] {
  const nowMs = Date.parse(nowIso);
  const candidates = [...moments]
    .filter((m) => !m.preparedAtIso) // already prepared → no ping
    .filter((m) => Date.parse(m.startAtIso) > nowMs) // started → never
    .filter((m) => (prefs.mode === 'important' ? m.importance !== 'low' : true))
    .sort((a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso));

  const planned: PlannedMomentNotification[] = [];
  const perDay = new Map<string, number>();
  let lastFireMs = Number.NEGATIVE_INFINITY;

  for (const m of candidates) {
    const startMs = Date.parse(m.startAtIso);
    const rec = buildRecommendation(m, {}, nowIso);
    const windowStartMs = Date.parse(rec.prepWindowStartIso);
    let fireMs =
      prefs.adaptive === true
        ? windowStartMs - (adjustments?.[m.type] ?? 0) * MIN_MS
        : prefs.leadMin != null
          ? startMs - prefs.leadMin * MIN_MS
          : windowStartMs;
    if (fireMs <= nowMs) continue; // never fire past-due prep
    if (fireMs >= startMs) fireMs = windowStartMs; // lead beyond start → window
    if (isQuietHour(new Date(fireMs))) continue; // quiet hours: drop, don't shift
    if (fireMs - lastFireMs < MOMENT_NOTIFY_MIN_GAP_MIN * MIN_MS) continue;
    const dayKey = localDayKey(fireMs);
    const dayCount = perDay.get(dayKey) ?? 0;
    if (dayCount >= MOMENT_NOTIFY_MAX_PER_DAY) continue;

    const minutesUntil = Math.round((startMs - fireMs) / MIN_MS);
    const action = rec.primaryAction;
    planned.push({
      momentId: m.id,
      tag: `${TAG_PREFIX}${m.id}`,
      fireAtIso: new Date(fireMs).toISOString(),
      titleKey: 'moments.notify.title',
      titleParams: { title: m.title, minutes: minutesUntil },
      bodyKey: action.bestBeforeIso ? 'moments.notify.body_best_before' : 'moments.notify.body',
      bodyParams: {
        action: '', // resolved at schedule time with the action label
        actionKey: action.labelKey,
        ...(action.labelParams ?? {}),
        ...(action.bestBeforeIso ? { time: clockLabel(action.bestBeforeIso) } : {}),
      },
    });
    perDay.set(dayKey, dayCount + 1);
    lastFireMs = fireMs;
  }
  return planned;
}

// ─── Prefs persistence (best-effort, defaults on any failure) ─────────────

export async function getMomentNotifyPrefs(): Promise<MomentNotifyPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_MOMENT_NOTIFY_PREFS;
    const parsed = JSON.parse(raw) as Partial<MomentNotifyPrefs>;
    const lead = parsed.leadMin;
    return {
      mode: parsed.mode === 'all' ? 'all' : 'important',
      adaptive: parsed.adaptive === true,
      leadMin:
        typeof lead === 'number' &&
        (MOMENT_NOTIFY_LEAD_PRESETS_MIN as readonly number[]).includes(lead)
          ? lead
          : null,
    };
  } catch {
    return DEFAULT_MOMENT_NOTIFY_PREFS;
  }
}

export async function setMomentNotifyPrefs(prefs: MomentNotifyPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort
  }
}

// ─── Native bridge (lazy, web/sim no-op — pushNotifications.ts pattern) ──

async function loadNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

/**
 * Idempotent re-sync: wipe every `aforce.moment.*` scheduled notification,
 * then schedule the current plan. `translate` resolves i18n at schedule time
 * (scheduled content is static).
 */
export async function syncMomentNotifications(
  plan: PlannedMomentNotification[],
  translate: (key: string, params?: Record<string, string | number>) => string,
): Promise<void> {
  const Notif = await loadNotifications();
  if (!Notif) return;
  try {
    const existing = await Notif.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((n) => n.identifier.startsWith(TAG_PREFIX))
        .map((n) => Notif.cancelScheduledNotificationAsync(n.identifier)),
    );
    const nowMs = Date.now();
    for (const p of plan) {
      const seconds = Math.max(1, Math.round((Date.parse(p.fireAtIso) - nowMs) / 1000));
      const actionLabel = translate(String(p.bodyParams['actionKey']), p.bodyParams);
      await Notif.scheduleNotificationAsync({
        identifier: p.tag,
        content: {
          title: translate(p.titleKey, p.titleParams),
          body: translate(p.bodyKey, { ...p.bodyParams, action: actionLabel }),
          sound: false,
        },
        trigger: {
          type: Notif.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
    }
  } catch {
    // Never let notification plumbing break the app.
  }
}

/** Cancel one moment's prep notification (I'M READY / delete). */
export async function cancelMomentNotification(momentId: string): Promise<void> {
  const Notif = await loadNotifications();
  if (!Notif) return;
  try {
    await Notif.cancelScheduledNotificationAsync(`${TAG_PREFIX}${momentId}`);
  } catch {
    // best-effort
  }
}
