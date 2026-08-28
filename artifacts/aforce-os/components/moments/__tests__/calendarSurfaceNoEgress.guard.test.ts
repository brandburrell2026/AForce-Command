/**
 * Calendar/Moments surface — no-egress standing guard (DR-011 close-out, A4).
 *
 * Static source scan (the calendarBridge.scopes.test.ts idiom) that converts
 * the previously audit-only invariants into test-enforced ones: the calendar
 * connect flow and every Moments surface must NEVER
 *   - fire analytics/telemetry (emit / event_dispatcher / @/services/analytics
 *     / recordLogAction) — so no event-id, event content, or derived category
 *     can leave the device via telemetry, and
 *   - make any network call (fetch / axios), or reference a third-party
 *     calendar-provider API host (Google Calendar API, Microsoft Graph,
 *     Outlook, Microsoft login) — reads go through the device EventKit only.
 *
 * Scans the seven calendar/Moments services plus every non-test file under
 * components/moments. Any regression fails here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SERVICES_DIR = join(__dirname, '..', '..', '..', 'services');
const MOMENTS_DIR = join(__dirname, '..');

const SERVICE_FILES = [
  'calendarBridge',
  'calendarMoments',
  'momentClassification',
  'momentNotifications',
  'momentFeedback',
  'momentRecommendation',
  'momentsStore',
].map((n) => join(SERVICES_DIR, `${n}.ts`));

const MOMENT_SURFACE_FILES = readdirSync(MOMENTS_DIR)
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => join(MOMENTS_DIR, f));

const FILES = [...SERVICE_FILES, ...MOMENT_SURFACE_FILES];

// Substrings for identifiers/hosts; call-shaped regexes for emit()/fetch() so
// prose (e.g. a comment about "emit paths") does not trip the guard.
const BANNED: Array<{ label: string; hit: (src: string) => boolean }> = [
  { label: 'analytics emit()', hit: (s) => /\bemit\s*\(/.test(s) },
  { label: "analytics dispatcher ('event_dispatcher')", hit: (s) => s.includes('event_dispatcher') },
  { label: "analytics service ('@/services/analytics')", hit: (s) => s.includes('@/services/analytics') },
  { label: 'recordLogAction', hit: (s) => s.includes('recordLogAction') },
  { label: 'network fetch()', hit: (s) => /\bfetch\s*\(/.test(s) },
  { label: 'network axios', hit: (s) => /\baxios\b/.test(s) },
  { label: 'Google Calendar API (googleapis)', hit: (s) => s.includes('googleapis') },
  { label: 'Microsoft Graph (graph.microsoft)', hit: (s) => s.includes('graph.microsoft') },
  { label: 'Google Calendar API (calendar/v3)', hit: (s) => s.includes('calendar/v3') },
  { label: 'Outlook API (outlook.office)', hit: (s) => s.includes('outlook.office') },
  { label: 'Microsoft login (login.microsoftonline)', hit: (s) => s.includes('login.microsoftonline') },
];

describe('calendar/Moments surface — no telemetry egress, no network, no provider APIs', () => {
  it('scans a non-empty, expected surface (fail-loud if the file set drifts)', () => {
    // Guards against a silently-empty scan (e.g. a moved directory).
    expect(SERVICE_FILES.length).toBe(7);
    expect(MOMENT_SURFACE_FILES.length).toBeGreaterThan(0);
  });

  for (const file of FILES) {
    const name = file.split('/').slice(-2).join('/');
    it(`${name} performs no analytics / network / provider-API egress`, () => {
      const src = readFileSync(file, 'utf8');
      for (const { label, hit } of BANNED) {
        expect(hit(src), `${name} must not reference ${label}`).toBe(false);
      }
    });
  }
});
