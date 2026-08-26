/**
 * A failed urine save must be VISIBLE.
 *
 * `handleConfirm` used to catch with `console.error` and nothing else, so a lost
 * check-in told the member nothing and they believed it saved. That is what made
 * Build-67 Test A ambiguous: the confirm produced no server request, and neither
 * the founder nor the logs could distinguish "never fired" from "failed
 * silently".
 *
 * Source-scanned: the assertion is that the catch routes through the SAME
 * classifier and copy the intake path already uses, rather than inventing a
 * second failure vocabulary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('a failed urine save is surfaced to the member', () => {
  const SRC = readFileSync(
    resolve(__dirname, '..', 'UrineCheckScreenV2.tsx'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('no longer swallows the error to console only', () => {
    expect(
      /catch \(err\) \{\s*console\.error/.test(SRC),
      'handleConfirm must not report a failed save to console alone',
    ).toBe(false);
  });

  it('classifies through the shared write-failure classifier', () => {
    expect(SRC).toMatch(/classifyWriteFailure\(err\)/);
  });

  it('uses the existing copy keys, not a new failure vocabulary', () => {
    expect(SRC).toMatch(/common\.action_failed_title\.\$\{failure\.kind\}/);
    expect(SRC).toMatch(/common\.action_failed_body\.\$\{failure\.kind\}/);
  });

  it('tells the member something — inline, in-brand, with retry (S2-7)', () => {
    // The mechanism moved from an OS Alert to AFInlineErrorRow beside the
    // CTA; the invariant this file exists for — a failed save is SURFACED,
    // never console-only — is unchanged.
    expect(SRC).toMatch(/<AFInlineErrorRow/);
    expect(SRC).toMatch(/setSaveError\(/);
    expect(SRC).not.toMatch(/Alert\.alert\(/);
  });
});
