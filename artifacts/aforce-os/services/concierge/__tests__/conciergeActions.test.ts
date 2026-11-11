/**
 * Action executor — only working capabilities, validated details, duplicate-tap
 * protection, honest failure, undo where supported.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../conciergeReminders', () => ({
  scheduleConciergeReminder: vi.fn(),
  cancelConciergeReminder: vi.fn(),
}));

import { scheduleConciergeReminder, cancelConciergeReminder } from '../conciergeReminders';
import {
  ActionLedger,
  SCREEN_ROUTES,
  actionIdFor,
  executeAction,
  undoAction,
  validateAction,
} from '../conciergeActions';

const scheduleMock = vi.mocked(scheduleConciergeReminder);
const cancelMock = vi.mocked(cancelConciergeReminder);

function deps() {
  const ledger = new ActionLedger();
  const logIntake = vi.fn(async (): Promise<unknown> => ({}));
  const router = { push: vi.fn() };
  return { ledger, logIntake, router };
}

beforeEach(() => {
  scheduleMock.mockReset();
  cancelMock.mockReset();
});

describe('SCREEN_ROUTES — every target is a real route file', () => {
  const APP = join(__dirname, '..', '..', '..', 'app');
  const FILES: Record<string, string[]> = {
    '/': ['(tabs)/index.tsx'],
    '/journal': ['(tabs)/journal.tsx'],
    '/protocol': ['(tabs)/protocol.tsx'],
    '/competition': ['(tabs)/competition.tsx'],
    '/profile': ['(tabs)/profile.tsx'],
    '/urine-check': ['urine-check.tsx'],
    '/weekly-report': ['weekly-report.tsx'],
    '/performance-signal': ['performance-signal.tsx'],
    '/scan': ['scan.tsx', '(tabs)/scan.tsx'],
    '/notifications': ['notifications.tsx'],
    '/health-connected': ['health-connected.tsx'],
    '/moments': ['moments.tsx'],
    '/sweat': ['sweat.tsx'],
    '/concierge/memory': ['concierge/memory.tsx'],
  };
  it('names no destination that does not exist (NAVIGATION-DISPOSITIONS rule)', () => {
    for (const route of Object.values(SCREEN_ROUTES)) {
      const candidates = FILES[route];
      expect(candidates, `no file mapping for ${route}`).toBeDefined();
      expect(candidates!.some((f) => existsSync(join(APP, f))), `${route} has no route file`).toBe(true);
    }
  });
});

describe('validateAction', () => {
  it('bounds hydration amounts and refuses non-water', () => {
    expect(validateAction({ type: 'log_hydration', fluidType: 'water', oz: 16, label: 'x' })).toEqual({ ok: true });
    expect(validateAction({ type: 'log_hydration', fluidType: 'water', oz: 0, label: 'x' }).ok).toBe(false);
    expect(validateAction({ type: 'log_hydration', fluidType: 'water', oz: 65, label: 'x' }).ok).toBe(false);
    expect(validateAction({ type: 'log_hydration', fluidType: 'water', oz: 12.5, label: 'x' }).ok).toBe(false);
    expect(validateAction({ type: 'log_hydration', fluidType: 'aforce_stick' as never, oz: 16, label: 'x' }).ok).toBe(false);
  });
  it('validates reminder details', () => {
    expect(validateAction({ type: 'set_reminder', title: 'Water', timeLocal: '25:00', dateLocal: '2026-10-05', recurrence: 'once', label: 'x' }).ok).toBe(false);
    expect(validateAction({ type: 'set_reminder', title: '  ', timeLocal: '09:00', dateLocal: '2026-10-05', recurrence: 'once', label: 'x' }).ok).toBe(false);
    expect(validateAction({ type: 'set_reminder', title: 'Water', timeLocal: '09:00', dateLocal: '2026-10-05', recurrence: 'daily', label: 'x' })).toEqual({ ok: true });
  });
});

describe('executeAction', () => {
  it('logs water through the store intake path with entrySource concierge', async () => {
    const d = deps();
    const out = await executeAction('a1', { type: 'log_hydration', fluidType: 'water', oz: 16, label: 'Log' }, d);
    expect(out).toEqual({ ok: true, kind: 'logged', oz: 16 });
    expect(d.logIntake).toHaveBeenCalledWith('water', { ozOverride: 16, source: 'concierge' });
    expect(d.ledger.get('a1')).toBe('done');
  });

  it('refuses a second run of the same action (duplicate tap / retry) without touching intake again', async () => {
    const d = deps();
    const action = { type: 'log_hydration' as const, fluidType: 'water' as const, oz: 16, label: 'Log' };
    await executeAction('a1', action, d);
    const again = await executeAction('a1', action, d);
    expect(again).toEqual({ ok: false, kind: 'duplicate' });
    expect(d.logIntake).toHaveBeenCalledTimes(1);
  });

  it('refuses to run while a first run is still in flight', async () => {
    const d = deps();
    let release: () => void = () => {};
    d.logIntake.mockImplementationOnce(() => new Promise<unknown>((r) => { release = () => r({}); }));
    const action = { type: 'log_hydration' as const, fluidType: 'water' as const, oz: 16, label: 'Log' };
    const first = executeAction('a1', action, d);
    const second = await executeAction('a1', action, d);
    expect(second).toEqual({ ok: false, kind: 'duplicate' });
    release();
    expect((await first).ok).toBe(true);
    expect(d.logIntake).toHaveBeenCalledTimes(1);
  });

  it('reports a failed intake honestly and allows a retry afterwards', async () => {
    const d = deps();
    d.logIntake.mockRejectedValueOnce(new Error('network'));
    const action = { type: 'log_hydration' as const, fluidType: 'water' as const, oz: 16, label: 'Log' };
    const out = await executeAction('a1', action, d);
    expect(out).toEqual({ ok: false, kind: 'failed', detail: 'network' });
    expect(d.ledger.get('a1')).toBe('failed');
    const retry = await executeAction('a1', action, d);
    expect(retry.ok).toBe(true);
  });

  it('rejects invalid edited details before anything runs', async () => {
    const d = deps();
    const out = await executeAction('a1', { type: 'log_hydration', fluidType: 'water', oz: 99, label: 'Log' }, d);
    expect(out.ok).toBe(false);
    expect(out.kind).toBe('invalid');
    expect(d.logIntake).not.toHaveBeenCalled();
    expect(d.ledger.get('a1')).toBe('idle');
  });

  it('opens an allow-listed screen and the check-in surface', async () => {
    const d = deps();
    await executeAction('a2', { type: 'open_screen', screen: 'weekly_report', label: 'Open' }, d);
    expect(d.router.push).toHaveBeenCalledWith('/weekly-report');
    await executeAction('a3', { type: 'start_checkin', label: 'Check in' }, d);
    expect(d.router.push).toHaveBeenCalledWith('/urine-check');
  });

  it('sets a reminder via the planner and surfaces quiet-hours shifts; undo cancels it', async () => {
    const d = deps();
    scheduleMock.mockResolvedValueOnce({
      ok: true,
      plan: { identifier: 'aforce.concierge.reminder.a4', fireAt: new Date(), shifted: true, timeLocal: '07:00', recurrence: 'once' },
    });
    const action = { type: 'set_reminder' as const, title: 'Water before the gym', timeLocal: '23:30', dateLocal: '2026-10-05', recurrence: 'once' as const, label: 'Set' };
    const out = await executeAction('a4', action, d);
    expect(out).toEqual({ ok: true, kind: 'reminder_set', timeLocal: '07:00', shifted: true, canUndo: true });
    cancelMock.mockResolvedValueOnce(true);
    expect(await undoAction('a4', action, d.ledger)).toBe(true);
    expect(d.ledger.get('a4')).toBe('undone');
  });

  it('maps a permission refusal to an honest failure', async () => {
    const d = deps();
    scheduleMock.mockResolvedValueOnce({ ok: false, reason: 'permission' });
    const out = await executeAction('a5', { type: 'set_reminder', title: 'Water', timeLocal: '09:00', dateLocal: '2026-10-06', recurrence: 'once', label: 'Set' }, d);
    expect(out).toEqual({ ok: false, kind: 'reminder_failed', reason: 'permission' });
  });

  it('undo is not offered for intake (the audited correction path owns that)', async () => {
    const d = deps();
    expect(await undoAction('a1', { type: 'log_hydration', fluidType: 'water', oz: 16, label: 'Log' }, d.ledger)).toBe(false);
  });

  it('actionIdFor is stable per assistant message', () => {
    expect(actionIdFor('m1')).toBe('m1.action');
    expect(actionIdFor('m1')).toBe(actionIdFor('m1'));
  });
});
