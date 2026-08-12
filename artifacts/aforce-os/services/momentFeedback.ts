/**
 * momentFeedback — prep-feedback store + pure lead-adaptation adapter
 * (Phase 4, DR-012). The DESIGN AMENDMENT recorded in DR-012 Ruling 1:
 * feedback lives here (capped, on-device, member-volunteered — same data
 * class as manual moments), NOT in the command ledger's reserved vocabulary.
 *
 * Score Protection: feedback is display-and-learning only. Nothing here
 * dispatches reducer actions or touches any scoring surface.
 *
 * Adaptation semantics (deriveLeadAdjustments — PURE, config-bounded):
 *   "too early"  → the signal came too far ahead → REDUCE the lead
 *                  (fire closer to the moment).
 *   "too late"   → INCREASE the lead (fire earlier).
 *   "just right" → counts toward samples, votes for zero.
 * Gates (DR-012 Ruling 3): ≥ MOMENT_FEEDBACK_MIN_SAMPLES per type in the
 * rolling window, strict majority, one step per net majority direction,
 * clamped to ±MOMENT_LEAD_ADJUST_MAX_MIN. The DR-010 interruption budget is
 * applied by the planner AFTER this adjustment — adaptation can never push a
 * signal into quiet hours or past the moment start.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { MomentType } from '@/types/moments';
import {
  MOMENT_FEEDBACK_MIN_SAMPLES,
  MOMENT_FEEDBACK_WINDOW_DAYS,
  MOMENT_LEAD_ADJUST_STEP_MIN,
  MOMENT_LEAD_ADJUST_MAX_MIN,
  MOMENT_FEEDBACK_ASK_MAX_PER_DAY,
  MOMENT_FEEDBACK_MAX_RECORDS,
} from '@/config/hydroStateModel';

const STORAGE_KEY = '@aforce/momentFeedback';

export type MomentPrepFeedback = 'just_right' | 'too_early' | 'too_late';

export interface MomentFeedbackRecord {
  momentId: string;
  momentType: MomentType;
  feedback: MomentPrepFeedback;
  atIso: string;
}

let records: MomentFeedbackRecord[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function sanitize(raw: unknown): MomentFeedbackRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r['momentId'] !== 'string' ||
    typeof r['momentType'] !== 'string' ||
    (r['feedback'] !== 'just_right' && r['feedback'] !== 'too_early' && r['feedback'] !== 'too_late') ||
    typeof r['atIso'] !== 'string' ||
    !Number.isFinite(Date.parse(r['atIso'] as string))
  ) {
    return null;
  }
  return r as unknown as MomentFeedbackRecord;
}

export async function hydrateMomentFeedback(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      records = parsed.map(sanitize).filter((r): r is MomentFeedbackRecord => r !== null);
    }
  } catch {
    records = [];
  }
  hydrated = true;
  notify();
}

export function getMomentFeedback(): MomentFeedbackRecord[] {
  return records;
}

export function recordMomentFeedback(record: MomentFeedbackRecord): void {
  if (records.some((r) => r.momentId === record.momentId)) return; // one per moment
  records = [...records, record].slice(-MOMENT_FEEDBACK_MAX_RECORDS);
  notify();
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records)).catch(() => {});
}

export function subscribeMomentFeedback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMomentFeedback(): MomentFeedbackRecord[] {
  return useSyncExternalStore(subscribeMomentFeedback, getMomentFeedback, getMomentFeedback);
}

// ─── Pure helpers (unit-tested; callers pass nowIso) ──────────────────────

/** DR-012 Ruling 2 selectivity: may we ASK on this moment right now? */
export function shouldAskFeedback(
  input: {
    momentId: string;
    importance: string;
    prepared: boolean;
    momentStartIso: string;
  },
  existing: readonly MomentFeedbackRecord[],
  nowIso: string,
): boolean {
  if (!input.prepared) return false;
  if (input.importance !== 'high') return false;
  if (Date.parse(input.momentStartIso) > Date.parse(nowIso)) return false; // not completed
  if (existing.some((r) => r.momentId === input.momentId)) return false; // once per moment
  const today = new Date(nowIso).toDateString();
  const askedToday = existing.filter((r) => new Date(r.atIso).toDateString() === today).length;
  return askedToday < MOMENT_FEEDBACK_ASK_MAX_PER_DAY;
}

/**
 * PURE: per-type lead adjustment in minutes (positive = fire EARLIER,
 * negative = fire LATER). Zero until the DR-012 gates pass.
 */
export function deriveLeadAdjustments(
  feedback: readonly MomentFeedbackRecord[],
  nowIso: string,
): Partial<Record<MomentType, number>> {
  const cutoffMs = Date.parse(nowIso) - MOMENT_FEEDBACK_WINDOW_DAYS * 86_400_000;
  const byType = new Map<MomentType, MomentFeedbackRecord[]>();
  for (const r of feedback) {
    const t = Date.parse(r.atIso);
    if (!Number.isFinite(t) || t < cutoffMs) continue;
    const list = byType.get(r.momentType) ?? [];
    list.push(r);
    byType.set(r.momentType, list);
  }

  const out: Partial<Record<MomentType, number>> = {};
  for (const [type, list] of byType) {
    if (list.length < MOMENT_FEEDBACK_MIN_SAMPLES) continue;
    const early = list.filter((r) => r.feedback === 'too_early').length;
    const late = list.filter((r) => r.feedback === 'too_late').length;
    const justRight = list.length - early - late;
    // Strict majority: the winning complaint must outnumber BOTH the
    // opposite complaint and the just-right votes.
    let direction = 0;
    if (late > early && late > justRight) direction = 1; // fire earlier
    else if (early > late && early > justRight) direction = -1; // fire later
    if (direction === 0) continue;
    // One step per full evidence quantum (net majority ÷ min samples),
    // at least one step once the gates pass, hard-clamped by config.
    const steps = Math.min(
      Math.max(1, Math.floor(Math.abs(late - early) / MOMENT_FEEDBACK_MIN_SAMPLES)),
      Math.floor(MOMENT_LEAD_ADJUST_MAX_MIN / MOMENT_LEAD_ADJUST_STEP_MIN),
    );
    out[type] = direction * steps * MOMENT_LEAD_ADJUST_STEP_MIN;
  }
  return out;
}
