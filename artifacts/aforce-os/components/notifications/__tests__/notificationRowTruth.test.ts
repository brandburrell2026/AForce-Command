/**
 * Notification rows vs. what the app can actually deliver
 * (Wave-4 notification audit).
 *
 * Three of the six toggles promised a capability that does not exist anywhere
 * in the app: `morningKickoff` (no 06:30 scheduler), `challengeDeadlines`
 * (nothing schedules anything ahead of a challenge expiry — and it DEFAULTED
 * ON), and `circleActivity` (needs remote push; `services/pushNotifications.ts`
 * is local-cadence only and registers no device token). Rendering a switch for
 * those is a promise broken every day — Constitution §"trust over attention".
 *
 * The fix hides the rows without touching the persisted keys. This file locks
 * both halves of that: the rows are gone from BOTH screens, and the stored
 * shape is untouched so no user's saved settings need a migration.
 *
 * Source-text guard rather than a render: both screens are store + expo-router
 * connected containers, which this repo's suites deliberately never mount (the
 * convention is documented in `components/home/__tests__/homeScreenV2Wiring.test.ts`
 * and `components/health/__tests__/connectedHealthContainer.render.test.tsx`).
 * The persisted-shape and copy assertions below are real imports, not text.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettingKey } from '../../../types';
import en from '../../../locales/en.json';

const SCREENS = {
  NotificationsScreenV2: readFileSync(join(__dirname, '..', 'NotificationsScreenV2.tsx'), 'utf8'),
  NotificationsLegacy: readFileSync(join(__dirname, '..', 'NotificationsLegacy.tsx'), 'utf8'),
};

/** The `const ROWS: ToggleRow[] = [...]` literal, comments stripped. */
function rowKeys(source: string): NotificationSettingKey[] {
  const start = source.indexOf('const ROWS');
  const literal = source.slice(start, source.indexOf('];', start));
  const code = literal.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
  return [...code.matchAll(/key:\s*'([A-Za-z]+)'/g)].map((m) => m[1] as NotificationSettingKey);
}

/** No producer exists anywhere in the app for these. */
const UNDELIVERABLE: NotificationSettingKey[] = ['morningKickoff', 'circleActivity', 'challengeDeadlines', 'recheckReminders', 'scoreDecayAlerts', 'lowInventoryAlert'];

/** Honoured by `useRiskTimerVoice` / `useScoreBandVoice` respectively. */
const VOICE_BACKED: string[] = []; // S1-4: voice producers mount only in unreachable HomeScreenLegacy — no longer deliverable

describe.each(Object.entries(SCREENS))('%s — only deliverable rows render', (_name, source) => {
  it.each(UNDELIVERABLE)('renders no row for %s (nothing in the app can fire it)', (key) => {
    expect(rowKeys(source)).not.toContain(key);
  });

  // S1-4: no voice-backed rows remain — useRiskTimerVoice and
  // useScoreBandVoice mount only in HomeScreenLegacy, unreachable while
  // spec_home is on. When a producer mounts on a reachable surface,
  // move its key back out of UNDELIVERABLE and restore this block.
  if (VOICE_BACKED.length > 0) {
    it.each(VOICE_BACKED)('still renders %s (a voice producer honours it)', (key) => {
      expect(rowKeys(source)).toContain(key);
    });
  }

  it('documents why the hidden rows are hidden and what would restore them', () => {
    expect(source).toContain('Wave-4 notification audit');
    expect(source).toMatch(/no remote push|remote push/);
  });
});

describe('the two screens cannot drift apart', () => {
  it('renders the identical row set, so a dead row cannot come back on one screen only', () => {
    expect(rowKeys(SCREENS.NotificationsScreenV2)).toEqual(rowKeys(SCREENS.NotificationsLegacy));
  });
});

describe('persisted settings shape is untouched', () => {
  it.each(UNDELIVERABLE)('keeps %s in NotificationSettings so stored choices need no migration', (key) => {
    expect(DEFAULT_NOTIFICATION_SETTINGS).toHaveProperty(key);
  });

  it('defaults challengeDeadlines OFF — a default-ON switch for a capability that cannot fire', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.challengeDeadlines).toBe(false);
  });
});

describe('locale keys for the hidden rows survive', () => {
  // Deleting these would make restoring a row a copy-hunt instead of the
  // one-line change the hiding comment promises it is.
  it.each(UNDELIVERABLE)('keeps notifications.v2.row_%s_{label,hint}', (key) => {
    expect(en.notifications.v2).toHaveProperty(`row_${key}_label`);
    expect(en.notifications.v2).toHaveProperty(`row_${key}_hint`);
  });
});

describe('surviving hints describe what actually happens', () => {
  const v2 = en.notifications.v2 as unknown as Record<string, string>;

  it.each(VOICE_BACKED)('%s hint names the on-device voice delivery', (key) => {
    expect(v2[`row_${key}_hint`].toLowerCase()).toContain('on-device voice');
  });

  it.each(VOICE_BACKED)('%s hint does not promise a push notification', (key) => {
    expect(v2[`row_${key}_hint`]).not.toMatch(/\bpush\b(?!\.)/i);
  });

  it('the screen intro no longer claims push honours these toggles', () => {
    expect(v2.intro).not.toMatch(/Voice, push, and in-app badges/i);
    expect(v2.intro.toLowerCase()).toContain('no remote push');
  });

  it('the legacy screen keeps the no-remote-push truth and offers no voice-hint rows (S1-4)', () => {
    // The voice-backed rows are hidden on both screens now; the only
    // surviving inline truth statement is the no-remote-push notice.
    expect(SCREENS.NotificationsLegacy).toContain('AForce sends no remote push');
    expect(SCREENS.NotificationsLegacy).not.toContain('On-device voice, no push.');
  });
});
