/**
 * S2-7 wave 1 — error language: failures speak, in-brand.
 *
 * Audit findings closed here:
 *   · Achievements swallowed a failed fetch into a silently-wrong grid
 *     (every achievement rendered locked). It now mounts AFErrorState
 *     with a retry, and a later success clears the flag.
 *   · Circle's weekly-challenge rollup failure was indistinguishable from
 *     "no challenge this week". A failed fetch now says so in words.
 *   · Urine reported its (correctly classified) save failure through a
 *     native OS Alert. The same writeFailure vocabulary now renders
 *     inline beside the CTA via AFInlineErrorRow, with retry.
 *
 * Destructive-action CONFIRMS remain Alert by design — the defect was
 * Alert-as-error-display, not Alert-as-confirm.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(PKG, rel), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

describe('S2-7 — Achievements failure is visible and retryable', () => {
  const src = strip(read('components/achievements/AchievementsScreenV2.tsx'));
  it('the catch raises a rendered failure state, not only a console line', () => {
    expect(src).toMatch(/catch[\s\S]{0,200}?setLoadFailed\(true\)/);
    expect(src).toMatch(/<AFErrorState[\s\S]{0,400}?onPress: \(\) => void load\(\)/);
  });
  it('a later success clears the failure', () => {
    expect(src).toMatch(/setUnlocks\(res\.unlocks\);\s*setLoadFailed\(false\)/);
  });
});

describe('S2-7 — Circle challenge failure says so', () => {
  const src = strip(read('components/community/CircleScreenV3.tsx'));
  it('the silent .catch(() => {}) is gone from the rollup fetch', () => {
    expect(src).not.toMatch(/fetchJournalRollups[\s\S]{0,400}?\.catch\(\(\) => \{\}\)/);
    expect(src).toMatch(/setRollupsFailed\(true\)/);
  });
  it('the failure renders where the bar would have been', () => {
    expect(src).toMatch(/rollupsFailed \? \([\s\S]{0,300}?challenge_unavailable/);
  });
});

describe('S2-7 — Urine failure reads inline, same vocabulary, no OS modal', () => {
  const src = strip(read('components/urine/UrineCheckScreenV2.tsx'));
  it('Alert is gone from the screen entirely', () => {
    expect(src).not.toMatch(/\bAlert\b/);
  });
  it('the classified writeFailure copy renders through AFInlineErrorRow with retry', () => {
    expect(src).toMatch(/classifyWriteFailure/);
    expect(src).toMatch(/<AFInlineErrorRow[\s\S]{0,300}?onRetry=\{\(\) => void handleConfirm\(\)\}/);
  });
});
