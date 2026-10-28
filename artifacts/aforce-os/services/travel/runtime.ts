import { getScopeState } from '@/services/userScope';
import { journeyRepository, travelStorage } from './storage';
import { createTravelReminderController, type ReminderContext, type ReminderSnapshot } from './reminders';
import { travelReminderNative, travelOwnerHash } from './reminderNative';

let enabled = false;
let snapshot: ReminderSnapshot = { owner: null, state: 'off', fireAt: null };
const listeners = new Set<() => void>();
function context(): ReminderContext {
  const state = getScopeState();
  return { owner: state.status === 'AUTHENTICATED' ? state.userId : null, token: state, enabled, resolved: state.status === 'AUTHENTICATED' || state.status === 'ANONYMOUS' };
}
const controller = createTravelReminderController({
  context, storage: travelStorage, journeys: journeyRepository, native: travelReminderNative,
  publish(next) { snapshot = next; for (const listener of listeners) listener(); },
});
export const travelRuntime = {
  ...controller,
  setEnabled(value: boolean) { enabled = value; },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  snapshot: () => snapshot,
  captureOwner(owner: string) {
    const captured = context();
    return () => {
      const live = context();
      return captured.owner === owner && live.owner === owner && captured.token === live.token && live.enabled && captured.enabled;
    };
  },
  async canOpenReminder(ownerHash: string, createdAt: string): Promise<boolean> {
    const ctx = context();
    if (!ctx.enabled || !ctx.owner) return false;
    const current = travelRuntime.captureOwner(ctx.owner);
    if (await travelOwnerHash(ctx.owner) !== ownerHash || !current()) return false;
    const journey = await journeyRepository.load(ctx.owner);
    return current() && !!journey && !journey.completedAt && journey.createdAt === createdAt;
  },
};
