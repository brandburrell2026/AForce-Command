/**
 * calendarBridge scope lock (DR-011 Ruling 3) — static source scan, the
 * appleHealth.healthKitScopes.test.ts pattern. The bridge must stay
 * read-only and minimal forever: no write/create/delete calls, no reminders
 * scope, no persistence of event data, and no reads of the excluded fields
 * (attendees, notes, location, organizer, url).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '..', '..', '..', 'services', 'calendarBridge.ts'),
  'utf8',
);
const MOMENTS_SRC = readFileSync(
  join(__dirname, '..', '..', '..', 'services', 'calendarMoments.ts'),
  'utf8',
);

describe('DR-011 read-only + minimization lock', () => {
  it('never requests write or reminders access, never mutates events', () => {
    for (const banned of [
      'createEventAsync',
      'updateEventAsync',
      'deleteEventAsync',
      'createCalendarAsync',
      'deleteCalendarAsync',
      'requestRemindersPermissionsAsync',
      'getRemindersAsync',
    ]) {
      expect(SRC, `calendarBridge must never call ${banned}`).not.toContain(banned);
    }
  });

  it('never reads the excluded event fields', () => {
    for (const banned of ['attendees', 'organizer', 'notes', 'location', 'url', 'alarms']) {
      expect(SRC.toLowerCase(), `calendarBridge must not touch event ${banned}`).not.toContain(
        `.${banned}`,
      );
    }
  });

  it('never persists event data (prefs-only storage keys)', () => {
    // The bridge's only AsyncStorage key is the prefs record; calendarMoments'
    // only key is the prepared-marks map. Any new key needs a DR amendment.
    const keys = [...SRC.matchAll(/@aforce\/[a-zA-Z]+/g)].map((m) => m[0]);
    expect([...new Set(keys)]).toEqual(['@aforce/calendarPrefs']);
    const momentKeys = [...MOMENTS_SRC.matchAll(/@aforce\/[a-zA-Z]+/g)].map((m) => m[0]);
    expect([...new Set(momentKeys)]).toEqual(['@aforce/momentPrepared']);
  });
});
