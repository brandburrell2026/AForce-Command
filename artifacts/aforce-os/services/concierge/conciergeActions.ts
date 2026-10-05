/**
 * AForce Concierge — action cards → working app capabilities.
 *
 * The server only PROPOSES an action; this module is the single place that
 * turns a confirmed proposal into a real effect, and only through paths that
 * already work in the app:
 *   log_hydration  → the store's `logIntake('water', …)` (the same idempotent
 *                    intake path Home's Log Water uses; entrySource 'concierge')
 *   open_screen    → expo-router navigation to an allow-listed route
 *   start_checkin  → opens /urine-check (the live check-in surface)
 *   set_reminder   → local notification via conciergeReminders (quiet hours, cap)
 *
 * Duplicate-tap protection: each action card carries a stable `actionId`
 * (assistant message id + ".action"). `ActionLedger` records in-flight and
 * completed ids so a second tap — or a retry after a flaky network — can never
 * double-execute. Undo is offered only where the underlying capability
 * supports it (reminders: cancel; navigation: back). Intake has no undo here
 * because the app's own correction path (`/intake/correction`) is the audited
 * way to amend a log — the card points the member to Hydration instead.
 */
import type { Router } from 'expo-router';
import type { FluidType } from '@/types';
import type { IntakeSource } from '@/services/intakeSource';
import { cancelConciergeReminder, scheduleConciergeReminder, type ScheduleReminderResult } from './conciergeReminders';
import type { ConciergeAction, ConciergeScreenId } from './conciergeTypes';

/** Allow-listed routes. Every target exists in app/ (locked by test). */
export const SCREEN_ROUTES: Record<ConciergeScreenId, string> = {
  home: '/',
  hydration: '/journal',
  protocol: '/protocol',
  circle: '/competition',
  profile: '/profile',
  urine_check: '/urine-check',
  weekly_report: '/weekly-report',
  performance_signal: '/performance-signal',
  scan: '/scan',
  notifications: '/notifications',
  health_connected: '/health-connected',
  moments: '/moments',
  sweat: '/sweat',
  concierge_memory: '/concierge/memory',
};

export interface LogIntakeFn {
  (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; source?: IntakeSource },
  ): Promise<unknown>;
}

export type ActionOutcome =
  | { ok: true; kind: 'logged'; oz: number }
  | { ok: true; kind: 'navigated'; route: string }
  | { ok: true; kind: 'reminder_set'; timeLocal: string; shifted: boolean; canUndo: true }
  | { ok: false; kind: 'duplicate' }
  | { ok: false; kind: 'invalid'; detail: string }
  | { ok: false; kind: 'reminder_failed'; reason: Exclude<ScheduleReminderResult, { ok: true }>['reason'] }
  | { ok: false; kind: 'failed'; detail: string };

export type ActionState = 'idle' | 'running' | 'done' | 'undone' | 'failed';

/** In-memory ledger of action ids — the duplicate-tap guard. */
export class ActionLedger {
  private readonly states = new Map<string, ActionState>();
  get(id: string): ActionState {
    return this.states.get(id) ?? 'idle';
  }
  /** Returns false when the action is already running or done. */
  begin(id: string): boolean {
    const s = this.get(id);
    if (s === 'running' || s === 'done') return false;
    this.states.set(id, 'running');
    return true;
  }
  finish(id: string, ok: boolean): void {
    this.states.set(id, ok ? 'done' : 'failed');
  }
  undo(id: string): void {
    this.states.set(id, 'undone');
  }
  reset(id: string): void {
    this.states.delete(id);
  }
}

export const OZ_MIN = 1;
export const OZ_MAX = 64;

/** Member-edited details are validated here before anything runs. */
export function validateAction(action: ConciergeAction): { ok: true } | { ok: false; detail: string } {
  switch (action.type) {
    case 'log_hydration': {
      if (!Number.isInteger(action.oz) || action.oz < OZ_MIN || action.oz > OZ_MAX) {
        return { ok: false, detail: `oz must be an integer ${OZ_MIN}–${OZ_MAX}` };
      }
      if (action.fluidType !== 'water') return { ok: false, detail: 'only water may be logged from the concierge' };
      return { ok: true };
    }
    case 'open_screen':
      return action.screen in SCREEN_ROUTES ? { ok: true } : { ok: false, detail: 'unknown screen' };
    case 'start_checkin':
      return { ok: true };
    case 'set_reminder': {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(action.timeLocal)) return { ok: false, detail: 'time must be HH:MM' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(action.dateLocal)) return { ok: false, detail: 'date must be YYYY-MM-DD' };
      if (!action.title.trim()) return { ok: false, detail: 'title required' };
      return { ok: true };
    }
    default:
      return { ok: false, detail: 'unsupported action' };
  }
}

export interface ExecuteDeps {
  ledger: ActionLedger;
  logIntake: LogIntakeFn;
  router: Pick<Router, 'push'>;
  now?: () => Date;
}

export async function executeAction(
  actionId: string,
  action: ConciergeAction,
  deps: ExecuteDeps,
): Promise<ActionOutcome> {
  const valid = validateAction(action);
  if (!valid.ok) return { ok: false, kind: 'invalid', detail: valid.detail };
  if (!deps.ledger.begin(actionId)) return { ok: false, kind: 'duplicate' };

  try {
    switch (action.type) {
      case 'log_hydration': {
        await deps.logIntake('water', { ozOverride: action.oz, source: 'concierge' });
        deps.ledger.finish(actionId, true);
        return { ok: true, kind: 'logged', oz: action.oz };
      }
      case 'open_screen': {
        const route = SCREEN_ROUTES[action.screen];
        deps.router.push(route as never);
        deps.ledger.finish(actionId, true);
        return { ok: true, kind: 'navigated', route };
      }
      case 'start_checkin': {
        deps.router.push(SCREEN_ROUTES.urine_check as never);
        deps.ledger.finish(actionId, true);
        return { ok: true, kind: 'navigated', route: SCREEN_ROUTES.urine_check };
      }
      case 'set_reminder': {
        const result = await scheduleConciergeReminder(
          {
            actionId,
            title: action.title,
            timeLocal: action.timeLocal,
            dateLocal: action.dateLocal,
            recurrence: action.recurrence,
          },
          deps.now?.() ?? new Date(),
        );
        if (!result.ok) {
          deps.ledger.finish(actionId, false);
          return { ok: false, kind: 'reminder_failed', reason: result.reason };
        }
        deps.ledger.finish(actionId, true);
        return { ok: true, kind: 'reminder_set', timeLocal: result.plan.timeLocal, shifted: result.plan.shifted, canUndo: true };
      }
    }
  } catch (err) {
    deps.ledger.finish(actionId, false);
    return { ok: false, kind: 'failed', detail: err instanceof Error ? err.message : String(err) };
  }
  deps.ledger.finish(actionId, false);
  return { ok: false, kind: 'failed', detail: 'unreachable' };
}

export async function undoAction(actionId: string, action: ConciergeAction, ledger: ActionLedger): Promise<boolean> {
  if (action.type !== 'set_reminder') return false;
  const ok = await cancelConciergeReminder(actionId);
  if (ok) ledger.undo(actionId);
  return ok;
}

/** Stable id for the action attached to an assistant message. */
export function actionIdFor(messageId: string): string {
  return `${messageId}.action`;
}
