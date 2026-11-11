/**
 * Client ↔ server contract parity (cross-boundary import, same pattern as
 * intakeSource.contract.test.ts): the screen allow-list, the capability list
 * and the message cap must be identical on both sides.
 */
import { describe, it, expect, vi } from 'vitest';

// Native edges the reminder service reaches at import (expo-notifications via
// pushNotifications; AsyncStorage via scopedStorage) — mocked per the repo's
// per-suite convention so the pure planner runs in node.
vi.mock('@/services/pushNotifications', () => ({ primePushPermission: vi.fn(async () => true) }));
vi.mock('@/services/scopedStorage', () => ({
  scopedStorage: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));
import {
  CAPABILITIES as SERVER_CAPABILITIES,
  CONCIERGE_SCREENS as SERVER_SCREENS,
} from '../../../../api-server/src/lib/concierge/types';
import { CONCIERGE_MAX_MESSAGE_CHARS as SERVER_MAX } from '../../../../api-server/src/lib/concierge/config';
import { CONCIERGE_CAPABILITIES, CONCIERGE_SCREENS } from '../conciergeTypes';
import { CONCIERGE_MAX_MESSAGE_CHARS } from '../../../config/hydroStateModel';
import { SCREEN_ROUTES } from '../conciergeActions';

describe('concierge client↔server contract', () => {
  it('screens match exactly', () => {
    expect([...CONCIERGE_SCREENS]).toEqual([...SERVER_SCREENS]);
  });
  it('capabilities match exactly', () => {
    expect([...CONCIERGE_CAPABILITIES]).toEqual([...SERVER_CAPABILITIES]);
  });
  it('composer cap matches the server cap', () => {
    expect(CONCIERGE_MAX_MESSAGE_CHARS).toBe(SERVER_MAX);
  });
  it('every server screen id has a client route', () => {
    for (const s of SERVER_SCREENS) expect(SCREEN_ROUTES[s]).toBeTruthy();
  });
});
