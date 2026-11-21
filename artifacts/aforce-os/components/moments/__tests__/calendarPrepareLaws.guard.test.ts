/**
 * Connect calendars to Moments — standing laws (2026-11-21).
 *  - Android: expo-calendar adds WRITE_CALENDAR, which the app never uses. It
 *    is blocked in app.json and the pin below fails if that is removed.
 *  - No new storage keys: the only persisted calendar keys stay prefs and the
 *    prepared-marks map; no new file writes event data anywhere.
 *  - Sample events can be reviewed in a sample build, never sealed.
 *  - The flag stays off by default and out of the internal overlay.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(AOS, p), 'utf8');
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const app = JSON.parse(read('app.json')) as {
  expo: {
    android: { permissions: string[]; blockedPermissions?: string[] };
    plugins: Array<string | [string, unknown]>;
  };
};

describe('Android calendar permissions', () => {
  it('blocks WRITE_CALENDAR, which the app never uses', () => {
    expect(app.expo.android.blockedPermissions).toContain('android.permission.WRITE_CALENDAR');
  });
  it('never asks for WRITE_CALENDAR itself, and does not block the read it needs', () => {
    expect(app.expo.android.permissions).not.toContain('android.permission.WRITE_CALENDAR');
    expect(app.expo.android.blockedPermissions).not.toContain('android.permission.READ_CALENDAR');
  });
  it('still carries the calendar plugin with its read-only wording', () => {
    const entry = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-calendar') as
      | [string, { calendarPermission: string }]
      | undefined;
    expect(entry?.[1].calendarPermission).toMatch(/titles and times/i);
  });
});

describe('no new storage and no event data at rest', () => {
  const NEW_FILES = [
    'services/calendarOccurrence.ts',
    'services/calendarSourceLabel.ts',
    'components/moments/cinematic/MomentsCalendarScreen.tsx',
    'components/moments/cinematic/momentsCalendarLogic.ts',
  ];
  it.each(NEW_FILES)('%s has no storage key and no storage call', (f) => {
    const src = code(read(f));
    expect(src).not.toMatch(/@aforce\//);
    expect(src).not.toMatch(/scopedStorage|AsyncStorage|SecureStore|setItem\(/);
  });
  it('the sealed plan keeps only an opaque event id and start (no body, notes or attendees)', () => {
    const t = read('types/moments.ts');
    expect(t).toMatch(/calendarSource\?: \{ eventId: string; startAtIso: string \};/);
  });
});

describe('sample events are reviewed, never sealed', () => {
  const screen = code(read('components/oneBreath/MomentPreparationScreen.tsx'));
  const prep = code(read('services/momentPreparation.ts'));
  it('the real-moment law is untouched', () => {
    expect(prep).toMatch(/moment\.source !== "demo" &&\s*!moment\.id\.startsWith\("demo-"\) &&\s*!moment\.calendarEventId\?\.startsWith\("demo-"\)/);
  });
  it('sample review is available only in a sample build, outside Social', () => {
    expect(screen).toContain('const SAMPLE_BUILD = DEMO_MODE || CAPTURE_MODE;');
    expect(screen).toMatch(/existing &&\s*SAMPLE_BUILD &&\s*!social &&\s*isSampleCalendarMoment\(existing\)/);
  });
  it('planning is refused while a sample is under review, before anything can be sealed', () => {
    expect(screen).toMatch(/if \(sampleOnly\) \{\s*setError\(SAMPLE_CANNOT_SEAL\);\s*return null;/);
    expect(screen).toMatch(/calendarChanged \|\| sampleOnly\)/);
  });
  it('says the one line', () => {
    expect(screen).toContain('"This is a sample event. It cannot be sealed."');
  });
});

describe('the Legal gate and flag are untouched', () => {
  it('moments_calendar_enabled stays off by default and out of the internal overlay', () => {
    expect(read('featureFlags/flags.ts')).toContain('moments_calendar_enabled: false,');
    expect(code(read('featureFlags/internalTestflightOverlay.ts'))).not.toContain('moments_calendar_enabled');
  });
  it('the Prepare button opens One Breath for that event with proposal=1 and nothing else', () => {
    const screen = code(read('components/moments/cinematic/MomentsCalendarScreen.tsx'));
    expect(screen).toMatch(/router\.push\(\{ pathname: '\/one-breath', params: \{ momentId: id, proposal: '1' \} \}\)/);
  });
});
