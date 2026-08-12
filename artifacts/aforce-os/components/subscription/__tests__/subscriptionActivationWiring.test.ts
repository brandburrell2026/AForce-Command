/**
 * Wave-3 PR3 — client purchase→activation wiring locks (source-guard
 * pattern, per the cartScreenV2CheckoutErrorWiring convention: V2
 * containers are store/router-coupled, so assert the wiring in source).
 *
 * Invariants:
 *  - purchase-success UI is NOT entitlement authority: no local
 *    subscription write exists in the screen; activation goes through
 *    the entitlement authority (waitForEntitlement → refreshEntitlement).
 *  - activation WAITS (bounded poll), not a single-shot refresh.
 *  - the iOS App-Store posture gate is present (was lost in V2).
 *  - a cold-start return deep link verifies the forwarded session
 *    server-side (fetchCheckoutSession) before any activation wait.
 *  - API failures surface real reasons (ApiRequestError is an Error).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const screenSrc = readFileSync(
  resolve(__dirname, '../SubscriptionScreenV2.tsx'),
  'utf8',
);

describe('SubscriptionScreenV2 activation wiring', () => {
  it('never writes subscription state locally (redirect is not a trust boundary)', () => {
    expect(screenSrc).not.toContain('setSubscription(');
    expect(screenSrc).toContain('fetchCheckoutSession');
  });

  it('activation waits for authoritative entitlement (bounded poll, not single-shot)', () => {
    expect(screenSrc).toContain('waitForEntitlement');
    expect(screenSrc).toMatch(/for \(let attempt = 0; attempt < \d+; attempt\+\+\)/);
    expect(screenSrc).toContain('refreshEntitlement()');
    expect(screenSrc).toContain('activation_pending_title');
  });

  it('carries the iOS App-Store posture gate (ported from legacy)', () => {
    expect(screenSrc).toMatch(/Platform\.OS === 'ios' && !state\.featureFlags\.ios_direct_checkout_enabled/);
  });

  it('handles a cold-start checkout return: verify server-side, never grant from the URL', () => {
    expect(screenSrc).toMatch(/params\.session_id/);
    expect(screenSrc).toMatch(/\^cs_\[A-Za-z0-9_\]\+\$/);
    const coldStart = screenSrc.slice(screenSrc.indexOf('coldReturnFiredRef'));
    expect(coldStart).toContain('fetchCheckoutSession(sessionId)');
    expect(coldStart).toContain('waitForEntitlement');
  });
});

describe('ApiRequestError (B3 — failures become legible)', () => {
  it('is a real Error carrying status + server message', async () => {
    const { ApiRequestError } = await import('../../../lib/api');
    const err = new ApiRequestError(400, 'returnUrl scheme not allowed');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.message).toContain('returnUrl');
  });
});
