/**
 * CartScreenV2 — checkout-failure inline error row wiring
 * (RC-1 Wave-2B, item 4 / audit P1-7).
 *
 * `CartScreenV2` pulls in `useCart` / `expo-router` / real Stripe Checkout
 * (`createCartCheckoutSession`, `WebBrowser.openAuthSessionAsync`) — the same
 * category of store+router-connected container this repo's existing tests
 * deliberately never mount directly (see
 * `components/home/__tests__/homeScreenV2Wiring.test.ts`'s header). This
 * file applies that same pattern: a source-text guard.
 *
 * What changed: `createCartCheckoutSession`'s failure branch used to pop a
 * native `Alert.alert`. This asserts that path is gone, a `checkoutError`
 * state now carries the same message, an `AFInlineErrorRow` renders it with
 * a Retry action, and the retry calls the EXACT SAME `onCheckout` the
 * primary button calls (no new/duplicate retry logic invented). No pricing,
 * checkout-session, or Stripe call itself was touched — this is a
 * failure-surface UI change only.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'CartScreenV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('CartScreenV2 — no more Alert.alert on checkout-session failure', () => {
  it('no longer imports react-native Alert', () => {
    expect(CODE).not.toMatch(/\bAlert\b/);
  });

  it('the createCartCheckoutSession catch sets checkoutError instead of calling Alert.alert', () => {
    const catchBlock = CODE.slice(CODE.indexOf('createCartCheckoutSession({'), CODE.indexOf('WebBrowser.openAuthSessionAsync'));
    expect(catchBlock).toContain('setCheckoutError(msg);');
    expect(catchBlock).not.toMatch(/Alert\.alert/);
  });

  it('onCheckout clears checkoutError at the start of every attempt', () => {
    expect(CODE).toContain('setCheckoutError(null);');
  });
});

describe('CartScreenV2 — AFInlineErrorRow renders the failure with a working retry', () => {
  it('imports AFInlineErrorRow from the shared ui primitives', () => {
    expect(CODE).toMatch(/import\s*\{[^}]*AFInlineErrorRow[^}]*\}\s*from\s*['"]@\/components\/ui['"];/);
  });

  it('renders it gated on checkoutError, with onRetry calling the same onCheckout', () => {
    expect(CODE).toMatch(/\{checkoutError\s*&&\s*\([\s\S]*?<AFInlineErrorRow/);
    const rowBlock = CODE.slice(CODE.indexOf('<AFInlineErrorRow'), CODE.indexOf('<AFInlineErrorRow') + 400);
    expect(rowBlock).toContain('message={checkoutError}');
    expect(rowBlock).toMatch(/onRetry=\{\(\)\s*=>\s*\{\s*void onCheckout\(\);\s*\}\}/);
    expect(rowBlock).toContain("retryLabel={t('common.retry')}");
  });
});
