/**
 * S2-3 — kept-promises pack locks (Stage-1-severity carryover from the
 * world-class-release Stage-2 audit).
 *
 * Three member-facing promises the app previously did not keep, now locked
 * to their REAL authorities — plus the removal of the audit's only dead
 * affordance:
 *
 *   B. Password reset — Clerk's own supported recovery strategy
 *      (reset_password_email_code), never custom credential recovery.
 *   C. Restore purchases — a forced re-sync of the server entitlement (the
 *      purchase authority on this Stripe architecture; there is no IAP
 *      receipt to replay), never a fake button.
 *   D. Connected Health — the no-op troubleshoot control is WITHHELD (null
 *      handler) rather than rendered dead, and the provider list scrolls.
 *
 *   A. Account deletion is deliberately NOT implemented here: the only
 *      existing endpoint is health-data-scoped (its own header says it does
 *      not delete the account), and a full deletion requires Clerk-side
 *      user deletion — held per the standing auth freeze. Reported, not
 *      faked; no lock claims otherwise.
 *
 * Source-scanned per the documented house convention for store-connected
 * containers.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..', '..');
function read(rel: string): string {
  return readFileSync(resolve(PKG, rel), 'utf8');
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
}

describe('S2-3(B) — password reset rides the Clerk-supported path only', () => {
  const reset = stripComments(read('components/auth/ResetPasswordScreenV2.tsx'));
  const signIn = stripComments(read('components/auth/SignInScreenV2.tsx'));

  it('the reset route exists and mounts the screen', () => {
    expect(existsSync(resolve(PKG, 'app/(auth)/reset-password.tsx'))).toBe(true);
    expect(read('app/(auth)/reset-password.tsx')).toContain('ResetPasswordScreenV2');
  });

  it('sign-in offers the recovery entry', () => {
    expect(signIn).toContain("router.push('/(auth)/reset-password')");
    expect(signIn).toContain('testID="signin-forgot-password"');
  });

  it("the flow is Clerk's reset_password_email_code — request then attemptFirstFactor", () => {
    expect(reset).toMatch(/signIn\.create\(\{\s*strategy:\s*'reset_password_email_code'/);
    expect(reset).toMatch(/signIn\.attemptFirstFactor\(\{\s*strategy:\s*'reset_password_email_code'/);
  });

  it('no custom credential recovery — the screen talks to no API of ours', () => {
    expect(reset).not.toMatch(/fetch\(|realApi|postJson|axios/);
  });

  it('completion activates the Clerk session; MFA surfaces honestly instead of pretending', () => {
    expect(reset).toMatch(/attempt\.status === 'complete'[\s\S]{0,200}?setActive\(\{ session: attempt\.createdSessionId \}\)/);
    expect(reset).toContain("t('auth.v2.signin_err_mfa')");
  });

  it('autofill/one-time-code hints are present (the audit gap)', () => {
    expect(reset).toContain('textContentType="oneTimeCode"');
    expect(reset).toContain('textContentType="newPassword"');
  });
});

describe('S2-3(C) — restore purchases re-syncs the real entitlement authority', () => {
  const sub = stripComments(read('components/subscription/SubscriptionScreenV2.tsx'));

  it('the control exists and calls refreshEntitlement — the server source of truth', () => {
    expect(sub).toContain('testID="subscription-restore"');
    expect(sub).toMatch(/import \{ refreshEntitlement \} from '@\/hooks\/useEntitlement';/);
    expect(sub).toMatch(/await refreshEntitlement\(\);/);
  });

  it('the outcome is reported from the re-synced entitlement slice, not assumed', () => {
    expect(sub).toMatch(/restore_done', \{ plan: entitlementNow\.planId/);
    expect(sub).toContain("t('subscription.v2.restore_error')");
  });

  it('busy state disables the control (no double-fire, no fake instant success)', () => {
    expect(sub).toMatch(/disabled=\{restoreState === 'busy'\}/);
  });
});

describe('S2-3(D) — Connected Health: no dead affordance, and the list scrolls', () => {
  const container = read('components/health/ConnectedHealthContainer.tsx');
  const containerCode = stripComments(container);
  const view = stripComments(read('components/health/ConnectedHealthView.tsx'));

  it('the no-op troubleshoot handler is gone — null withholds the button', () => {
    expect(containerCode).toMatch(/const onTroubleshoot = null;/);
    expect(containerCode).not.toMatch(/onTroubleshoot = useCallback/);
  });

  it('the view renders the troubleshoot control only when a real handler exists', () => {
    expect(view).toMatch(/hasAction && row\.troubleshoot\.label && onTroubleshoot \?/);
    expect(view).toMatch(/\(\(hasAction && onTroubleshoot\) \|\| row\.canDisconnect\)/);
  });

  it('the provider list lives in a ScrollView; the connect bar stays pinned outside it', () => {
    expect(containerCode).toMatch(/<ScrollView[\s\S]{0,400}?<ConnectedHealthView[\s\S]{0,600}?<\/ScrollView>/);
    const scrollClose = containerCode.indexOf('</ScrollView>');
    const connectBar = containerCode.indexOf('hcConnectBar');
    expect(scrollClose).toBeGreaterThan(0);
    expect(connectBar).toBeGreaterThan(scrollClose);
  });

  it('the stale unmounted-component claim is corrected', () => {
    expect(container).not.toContain('NOT REGISTERED TO ANY ROUTE');
    expect(container).toContain('app/health-connected.tsx');
  });
});
