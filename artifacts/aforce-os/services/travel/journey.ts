/** Travel v1: one manually entered journey. No provider status or score writes. */
import { z } from 'zod';

export const departureInputSchema = z.object({
  flightNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/, 'Enter a flight number, for example AA123.'),
  origin: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Enter the three-letter departure airport.'),
  destination: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Enter the three-letter arrival airport.'),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD for the departure date.'),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour departure time, for example 14:30.'),
  utcOffset: z.string().regex(/^[+-](0\d|1[0-4]):[0-5]\d$/, 'Enter the departure airport UTC offset, for example -04:00.'),
}).superRefine((input, ctx) => {
  if (input.origin === input.destination) ctx.addIssue({ code: 'custom', message: 'Choose different departure and arrival airports.', path: ['destination'] });
  if (/^[+-]14:(?!00)/.test(input.utcOffset)) ctx.addIssue({ code: 'custom', message: 'UTC offsets cannot exceed 14 hours.', path: ['utcOffset'] });
  // Date.parse alone normalizes February 30 into March. Reject that rollover.
  const date = new Date(`${input.departureDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.departureDate || date.getUTCFullYear() < 2000) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid departure date.', path: ['departureDate'] });
  }
});
export type DepartureInput = z.infer<typeof departureInputSchema>;

const journeySchema = z.object({
  version: z.literal(1),
  source: z.literal('manual'),
  details: departureInputSchema,
  departureAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
}).strict().superRefine((journey, ctx) => {
  const expected = new Date(`${journey.details.departureDate}T${journey.details.departureTime}:00${journey.details.utcOffset}`).toISOString();
  if (expected !== journey.departureAt) ctx.addIssue({ code: 'custom', message: 'Saved departure time is inconsistent.' });
});
export type TravelJourney = z.infer<typeof journeySchema>;

export function createJourney(input: DepartureInput, now = new Date()): TravelJourney {
  const details = departureInputSchema.parse(input);
  return journeySchema.parse({
    version: 1, source: 'manual', details,
    departureAt: new Date(`${details.departureDate}T${details.departureTime}:00${details.utcOffset}`).toISOString(),
    createdAt: now.toISOString(), completedAt: null,
  });
}

export interface JourneyStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Explicit ownership even when the app's older storage-isolation flag is off.
 * Hex encoding is injective and survives SecureStore key sanitization. */
export function journeyStorageKey(owner: string): string {
  if (!owner.trim() || owner.length > 200) throw new Error('Sign in to save a journey.');
  return `aforce.travel.v1.${Array.from(owner).map(c => c.codePointAt(0)!.toString(16)).join('_')}`;
}

export function createJourneyRepository(storage: JourneyStorage) {
  // Serialize edits for the same account. Reads wait for earlier edits, so a
  // delayed initial read cannot undo a successful save/finish/delete.
  const pending = new Map<string, Promise<unknown>>();
  const enqueue = <T,>(owner: string, operation: (key: string) => Promise<T>): Promise<T> => {
    const key = journeyStorageKey(owner);
    const next = (pending.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => operation(key));
    pending.set(key, next);
    void next.finally(() => { if (pending.get(key) === next) pending.delete(key); }).catch(() => undefined);
    return next;
  };
  const read = async (key: string) => {
    const raw = await storage.getItem(key);
    return raw === null ? null : journeySchema.parse(JSON.parse(raw));
  };
  return {
    load: (owner: string) => enqueue(owner, read),
    save: (owner: string, input: DepartureInput) => enqueue(owner, async key => {
      const existing = await read(key);
      if (existing && !existing.completedAt) throw new Error('Finish or remove your current journey before adding another.');
      const journey = createJourney(input);
      await storage.setItem(key, JSON.stringify(journey));
      return journey;
    }),
    finish: (owner: string) => enqueue(owner, async key => {
      const existing = await read(key);
      if (!existing) throw new Error('No journey to finish.');
      const journey = { ...existing, completedAt: existing.completedAt ?? new Date().toISOString() };
      await storage.setItem(key, JSON.stringify(journey));
      return journey;
    }),
    remove: (owner: string) => enqueue(owner, async key => { await storage.removeItem(key); return null; }),
  };
}
