import { z } from 'zod';
import { journeyStorageKey, type TravelJourney, type JourneyStorage, type DepartureInput, type createJourneyRepository } from './journey';

export const TRAVEL_REMINDER_ID = 'aforce.travel.preparation.v1';
export type ReminderOwner = 'off' | 'aforce' | 'external';
const prefsSchema = z.object({ version: z.literal(1), owner: z.enum(['off', 'aforce', 'external']) }).strict();
export const reminderStorageKey = (owner: string) => `${journeyStorageKey(owner)}.reminders`;
export type ReminderState = 'off' | 'external' | 'scheduled' | 'quiet_hours' | 'too_late' | 'no_journey' | 'permission_required' | 'unsupported' | 'error';
export interface ReminderSnapshot { owner: string | null; state: ReminderState; fireAt: string | null }
export interface ReminderContext { owner: string | null; enabled: boolean; token: object; resolved?: boolean }
export interface ReminderPlan { fireAt: string | null; state: 'scheduled' | 'quiet_hours' | 'too_late' | 'no_journey' }

/** One reminder, two hours before the MANUALLY ENTERED departure. Quiet
 * hours use its entered airport offset, never a provider status or prediction. */
export function planTravelReminder(journey: TravelJourney | null, now = Date.now()): ReminderPlan {
  if (!journey || journey.completedAt) return { state: 'no_journey', fireAt: null };
  const fireMs = Date.parse(journey.departureAt) - 2 * 60 * 60_000;
  if (!Number.isFinite(fireMs) || fireMs <= now) return { state: 'too_late', fireAt: null };
  const offset = journey.details.utcOffset;
  const minutes = (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4))) * (offset[0] === '-' ? -1 : 1);
  const hour = new Date(fireMs + minutes * 60_000).getUTCHours();
  if (hour >= 22 || hour < 7) return { state: 'quiet_hours', fireAt: null };
  return { state: 'scheduled', fireAt: new Date(fireMs).toISOString() };
}

export interface TravelReminderNative {
  supported: boolean;
  permission(request: boolean): Promise<boolean>;
  cancel(): Promise<void>;
  purgeResponse?(): Promise<void>;
  schedule(fireAt: string, owner: string, journeyCreatedAt: string): Promise<void>;
}
export interface TravelClearResult { journey: boolean; preferences: boolean; reminders: boolean }
export class TravelClearError extends Error {
  constructor(public readonly result: TravelClearResult) {
    super('Some travel data or reminders could not be cleared. Retry Clear travel data; this does not delete your AForce or TravelGate account.');
    this.name = 'TravelClearError';
  }
}

/** One queue owns all travel schedule changes AND journey mutations. A scope
 * token comes from the app's identity authority, not a second identity cache. */
export function createTravelReminderController(deps: {
  context: () => ReminderContext;
  storage: JourneyStorage;
  journeys: ReturnType<typeof createJourneyRepository>;
  native: TravelReminderNative;
  now?: () => number;
  publish?: (snapshot: ReminderSnapshot) => void;
}) {
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.catch(() => undefined).then(task); queue = next; return next;
  };
  const current = (ctx: ReminderContext) => {
    const live = deps.context();
    return ctx.token === live.token && ctx.owner === live.owner && ctx.enabled === live.enabled;
  };
  const requireOwner = (ctx: ReminderContext, owner: string) => {
    if (!current(ctx) || !ctx.enabled || ctx.owner !== owner) throw new Error('Travel account changed.');
  };
  const publish = (ctx: ReminderContext, state: ReminderState, fireAt: string | null = null) => {
    if (current(ctx)) deps.publish?.({ owner: ctx.owner, state, fireAt });
  };
  const reconcile = async (ctx: ReminderContext, mayRequestPermission = false) => {
    // Always cancel before replacing a schedule. If cancellation fails, never
    // schedule another notification or claim reminders have been disabled.
    try {
      if (!current(ctx) || ctx.enabled && ctx.resolved === false) return;
      await deps.native.cancel();
      if (!current(ctx)) return;
      if (!ctx.enabled || !ctx.owner) { publish(ctx, 'off'); return; }
      if (!deps.native.supported) { publish(ctx, 'unsupported'); return; }
      const raw = await deps.storage.getItem(reminderStorageKey(ctx.owner));
      if (!current(ctx)) return;
      const choice = raw === null ? 'off' : prefsSchema.parse(JSON.parse(raw)).owner;
      if (choice !== 'aforce') { publish(ctx, choice); return; }
      const journey = await deps.journeys.load(ctx.owner);
      if (!current(ctx)) return;
      const plan = planTravelReminder(journey, deps.now?.() ?? Date.now());
      if (plan.state !== 'scheduled' || !plan.fireAt || !journey) { publish(ctx, plan.state); return; }
      const granted = await deps.native.permission(mayRequestPermission);
      if (!current(ctx)) return;
      if (!granted) { publish(ctx, 'permission_required'); return; }
      const stillPlanned = planTravelReminder(journey, deps.now?.() ?? Date.now());
      if (stillPlanned.state !== 'scheduled') { publish(ctx, stillPlanned.state); return; }
      await deps.native.schedule(plan.fireAt, ctx.owner, journey.createdAt);
      if (!current(ctx)) { await deps.native.cancel(); return; }
      publish(ctx, 'scheduled', plan.fireAt);
    } catch { publish(ctx, 'error'); }
  };
  return {
    sync() { const ctx = deps.context(); return enqueue(() => reconcile(ctx)); },
    choose(owner: string, choice: ReminderOwner) {
      const ctx = deps.context();
      return enqueue(async () => {
        requireOwner(ctx, owner);
        await deps.native.cancel(); requireOwner(ctx, owner);
        // Record only the explicit choice. Boot/foreground sync never asks
        // permission; only this user-initiated path may display the OS prompt.
        await deps.storage.setItem(reminderStorageKey(owner), JSON.stringify(prefsSchema.parse({ version: 1, owner: choice })));
        if (!current(ctx)) return;
        await reconcile(ctx, choice === 'aforce');
      });
    },
    changeJourney(owner: string, action: { kind: 'save' | 'update'; input: DepartureInput } | { kind: 'finish' } | { kind: 'remove' }) {
      const ctx = deps.context();
      return enqueue(async () => {
        requireOwner(ctx, owner);
        await deps.native.cancel(); requireOwner(ctx, owner);
        const journey = action.kind === 'save' ? await deps.journeys.save(owner, action.input)
          : action.kind === 'update' ? await deps.journeys.update(owner, action.input)
          : action.kind === 'finish' ? await deps.journeys.finish(owner) : await deps.journeys.remove(owner);
        await reconcile(ctx);
        return journey;
      });
    },
    clear(owner: string) {
      const ctx = deps.context();
      return enqueue(async () => {
        requireOwner(ctx, owner);
        const result: TravelClearResult = { journey: false, preferences: false, reminders: false };
        // Attempt every deletion even if one step fails. Bound storage keys to
        // the requesting owner; a late switch cannot erase the next account.
        let cancelled = false, responseCleared = false;
        try { await deps.native.cancel(); cancelled = true; } catch { /* reported below */ }
        try { await deps.native.purgeResponse?.(); responseCleared = true; } catch { /* reported below */ }
        result.reminders = cancelled && responseCleared;
        try { await deps.journeys.remove(owner); result.journey = true; } catch { /* reported below */ }
        try { await deps.storage.removeItem(reminderStorageKey(owner)); result.preferences = true; } catch { /* reported below */ }
        publish(ctx, Object.values(result).every(Boolean) ? 'off' : 'error');
        if (!Object.values(result).every(Boolean)) throw new TravelClearError(result);
        return result;
      });
    },
  };
}
