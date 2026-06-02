/**
 * Unit tests for privacyService — the privacy chokepoint for AForce Circles.
 *
 * The most critical invariant: `projectSharedStatus` MUST be the only path
 * by which a user's status leaves the device, and it MUST honor every scope
 * + per-field toggle. This file pins those rules with tests so a future
 * refactor cannot silently regress them.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  getPrivacy, setScope, setField, projectSharedStatus, subscribePrivacy,
} from '../privacyService';
import type { SharedStatus } from '../../types/circle';

const fullStatus: SharedStatus = {
  userId: 'me',
  score: 87,
  state: 'Peak',
  streakDays: 14,
  protocolComplete: true,
  trend: 'up',
  updatedAt: '2026-04-21T14:00:00Z',
};

beforeEach(() => {
  // Restore default scope + all fields on for test isolation.
  setScope('circle');
  setField('score',    true);
  setField('state',    true);
  setField('streak',   true);
  setField('protocol', true);
  setField('trend',    true);
});

describe('privacyService — projectSharedStatus (PRIVATE scope)', () => {
  it('blanks every dimension including updatedAt — no "last seen" leak', () => {
    setScope('private');
    const p = projectSharedStatus(fullStatus);
    expect(p.userId).toBe('me');
    expect(p.score).toBe(0);
    expect(p.state).toBe('Balanced');
    expect(p.streakDays).toBe(0);
    expect(p.protocolComplete).toBe(false);
    expect(p.trend).toBe('flat');
    expect(p.updatedAt).toBe('');
  });

  it('private scope ignores per-field overrides (cannot accidentally re-leak)', () => {
    setScope('private');
    setField('score',  true);
    setField('streak', true);
    const p = projectSharedStatus(fullStatus);
    expect(p.score).toBe(0);
    expect(p.streakDays).toBe(0);
  });
});

describe('privacyService — projectSharedStatus (CIRCLE / TEAM_COACH / PUBLIC_CARD scopes)', () => {
  it('returns full status when every field is on', () => {
    setScope('circle');
    const p = projectSharedStatus(fullStatus);
    expect(p).toEqual(fullStatus);
  });

  it('blanks individual fields independently when toggled off', () => {
    setField('score',    false);
    setField('streak',   false);
    setField('protocol', false);
    const p = projectSharedStatus(fullStatus);
    expect(p.score).toBe(0);            // off
    expect(p.streakDays).toBe(0);       // off
    expect(p.protocolComplete).toBe(false); // off
    expect(p.state).toBe('Peak');       // still on
    expect(p.trend).toBe('up');         // still on
    expect(p.updatedAt).toBe(fullStatus.updatedAt); // non-private scopes keep timestamp
  });

  it('blanking state alone falls back to Balanced (safe neutral)', () => {
    setField('state', false);
    const p = projectSharedStatus(fullStatus);
    expect(p.state).toBe('Balanced');
  });

  it('blanking trend alone falls back to flat', () => {
    setField('trend', false);
    const p = projectSharedStatus(fullStatus);
    expect(p.trend).toBe('flat');
  });
});

describe('privacyService — getPrivacy returns a defensive clone', () => {
  it('mutating the returned object never affects internal state', () => {
    const a = getPrivacy();
    a.scope = 'public_card';
    a.fields.score = false;
    const b = getPrivacy();
    expect(b.scope).toBe('circle');     // unchanged
    expect(b.fields.score).toBe(true);  // unchanged
  });
});

describe('privacyService — subscribePrivacy', () => {
  it('notifies listeners on scope change and supports unsubscribe', () => {
    let calls = 0;
    const unsub = subscribePrivacy(() => { calls += 1; });
    setScope('team_coach');
    setScope('public_card');
    expect(calls).toBe(2);
    unsub();
    setScope('circle');
    expect(calls).toBe(2); // no further calls after unsubscribe
  });

  it('notifies on per-field toggle', () => {
    let calls = 0;
    const unsub = subscribePrivacy(() => { calls += 1; });
    setField('score', false);
    setField('score', true);
    expect(calls).toBe(2);
    unsub();
  });

  it('one bad listener does not break the rest', () => {
    let good = 0;
    const unsubBad  = subscribePrivacy(() => { throw new Error('boom'); });
    const unsubGood = subscribePrivacy(() => { good += 1; });
    setScope('team_coach');
    expect(good).toBe(1);
    unsubBad();
    unsubGood();
  });
});
