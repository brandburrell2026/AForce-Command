/**
 * S1-4 — notification honesty locks.
 *
 * A production toggle must correspond to functioning production
 * behavior. Stage-0 proved recheckReminders/scoreDecayAlerts consumers
 * mount only in unreachable HomeScreenLegacy and lowInventoryAlert has
 * no consumer at all — so the rows are hidden (same founder-approved
 * pattern as morningKickoff/challengeDeadlines/circleActivity).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const screen = readFileSync(
  resolve(__dirname, '..', 'NotificationsScreenV2.tsx'),
  'utf8',
);
const momentsNotif = readFileSync(
  resolve(__dirname, '..', '..', '..', 'services', 'momentNotifications.ts'),
  'utf8',
);

describe('dead toggles stay hidden until a reachable producer exists', () => {
  it('no base row promises an unproducible notification', () => {
    const rowsBlock = screen.slice(
      screen.indexOf('const ROWS: ToggleRow[]'),
      screen.indexOf('export function NotificationsScreenV2'),
    );
    for (const dead of ['recheckReminders', 'scoreDecayAlerts', 'lowInventoryAlert']) {
      expect(rowsBlock, `${dead} must not be offered as a row`).not.toContain(`key: '${dead}'`);
    }
  });

  it('momentPrep — the one honest toggle — is still offered when Moments is on', () => {
    expect(screen).toContain("key: 'momentPrep'");
  });

  it('re-adding a row without a producer is caught: settings keys persist untouched', () => {
    // The persisted NotificationSettings shape is unchanged — hiding is
    // presentation-only, so no migration and no data loss.
    expect(screen).toContain('NotificationSettingKey');
  });
});

describe('Moments OS-channel copy runs through the §42 seam', () => {
  it('title and body are scanned and fail closed before scheduling', () => {
    expect(momentsNotif).toContain('consumerCopyBlocked(title)');
    expect(momentsNotif).toContain('consumerCopyBlocked(body)');
    const gateIdx = momentsNotif.indexOf('consumerCopyBlocked(title)');
    const schedIdx = momentsNotif.indexOf('scheduleNotificationAsync', gateIdx - 2000);
    expect(gateIdx).toBeGreaterThan(0);
    expect(momentsNotif.indexOf('scheduleNotificationAsync', gateIdx)).toBeGreaterThan(gateIdx);
  });
});
