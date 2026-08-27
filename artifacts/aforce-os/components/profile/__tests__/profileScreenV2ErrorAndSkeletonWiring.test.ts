// S2-10b(1): shell + kit scanned together (primitives + styles moved verbatim to profileKit.tsx).
// S2-10b(2): + panes/*.tsx — the tab blocks moved there (mechanism move, invariants intact).
/**
 * ProfileScreenV2 — provider-section skeleton + honest error rows
 * (RC-1 Wave-2B, items 2b and 4 / audit P1-7).
 *
 * `ProfileScreenV2` pulls in `useAppStore` / `expo-router` / the WHOOP,
 * Garmin, and Apple Health service modules — the same category of
 * store+router-connected container this repo's existing tests deliberately
 * never mount directly (see `components/home/__tests__/homeScreenV2Wiring.test.ts`'s
 * header). This file applies that same pattern: a source-text guard.
 *
 * Three defects under test:
 *  - `refreshAppleSnapshot` had NO try/catch at all — a failure was fully
 *    silent (and, since `connectAppleHealth` awaits it, could surface as an
 *    unhandled rejection). Now caught, surfaced via `AFInlineErrorRow`,
 *    retried via the EXISTING refresh affordance.
 *  - `refreshWhoopState`'s catch was `// leave the current state untouched`
 *    — a network failure had zero UI feedback. Now surfaced via
 *    `AFInlineErrorRow`, retried via the same `refreshWhoopState`.
 *  - The provider list rendered immediately against 'not_connected'
 *    defaults before the mount-time WHOOP/Garmin checks resolved. Now
 *    gated behind a `ProviderSectionSkeleton` until both have checked once.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = (readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8') + readFileSync(join(__dirname, '..', 'profileKit.tsx'), 'utf8')
  + readFileSync(join(__dirname, '..', 'panes', 'PerformancePane.tsx'), 'utf8')
  + readFileSync(join(__dirname, '..', 'panes', 'DevicesPane.tsx'), 'utf8')
  + readFileSync(join(__dirname, '..', 'panes', 'AccountPane.tsx'), 'utf8')
  + readFileSync(join(__dirname, '..', 'panes', 'DeveloperPane.tsx'), 'utf8')
);
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('ProfileScreenV2 — Apple Health fetch failure is no longer silent', () => {
  it('wraps fetchAppleHealthSnapshot in try/catch (previously had none)', () => {
    const fnBody = CODE.slice(CODE.indexOf('const refreshAppleSnapshot'), CODE.indexOf('const connectAppleHealth'));
    expect(fnBody).toMatch(/try\s*\{[\s\S]*fetchAppleHealthSnapshot\(\)[\s\S]*\}\s*catch\s*\(err\)\s*\{/);
    expect(fnBody).toContain('setAppleFetchError(');
  });

  it('clears appleFetchError on a successful fetch (no stale error survives a good retry)', () => {
    const fnBody = CODE.slice(CODE.indexOf('const refreshAppleSnapshot'), CODE.indexOf('const connectAppleHealth'));
    expect(fnBody).toContain('setAppleFetchError(null);');
  });

  it('renders AFInlineErrorRow gated on appleFetchError, retrying via the EXISTING refreshAppleSnapshot', () => {
    expect(CODE).toContain('testID="profile-apple-fetch-error"');
    const occurrences = CODE.split('onRetry={() => { void refreshAppleSnapshot(); }}').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(1);
  });

  it('the with-snapshot and no-snapshot error rows use distinct testIDs (RC-1 Wave-2 r2 dedupe — they are mutually exclusive branches but must not share a testID)', () => {
    expect(CODE).toContain('testID="profile-apple-fetch-error"');
    expect(CODE).toContain('testID="profile-apple-fetch-error-no-snapshot"');
    const genericOccurrences = CODE.split('testID="profile-apple-fetch-error"').length - 1;
    // Exactly one exact match of the base testID (the with-snapshot row); the
    // no-snapshot row's suffixed testID must not also count as a match here.
    expect(genericOccurrences).toBe(1);
  });
});

describe('ProfileScreenV2 — WHOOP status-check failure is no longer silent', () => {
  it('the refreshWhoopState catch sets whoopStatusError instead of only a comment', () => {
    const fnBody = CODE.slice(CODE.indexOf('const refreshWhoopState'), CODE.indexOf('useEffect(() => {\n    void refreshWhoopState'));
    expect(fnBody).toContain('setWhoopStatusError(');
  });

  it('clears whoopStatusError on a successful check', () => {
    const fnBody = CODE.slice(CODE.indexOf('const refreshWhoopState'), CODE.indexOf('useEffect(() => {\n    void refreshWhoopState'));
    expect(fnBody).toContain('setWhoopStatusError(null);');
  });

  it('renders AFInlineErrorRow gated on whoopStatusError, retrying via the EXISTING refreshWhoopState', () => {
    expect(CODE).toContain('testID="profile-whoop-status-error"');
    expect(CODE).toContain('onRetry={() => { void refreshWhoopState(); }}');
  });
});

describe('ProfileScreenV2 — provider-section mount-loading skeleton', () => {
  it('tracks whoopStatusChecked and garminStatusChecked, both flipped in a finally (checked on either outcome)', () => {
    expect(CODE).toContain('const [whoopStatusChecked, setWhoopStatusChecked] = useState(false);');
    expect(CODE).toContain('const [garminStatusChecked, setGarminStatusChecked] = useState(false);');
    const whoopFn = CODE.slice(CODE.indexOf('const refreshWhoopState'), CODE.indexOf('useEffect(() => {\n    void refreshWhoopState'));
    expect(whoopFn).toMatch(/finally\s*\{\s*setWhoopStatusChecked\(true\);/);
    const garminFn = CODE.slice(CODE.indexOf('const refreshGarminState'), CODE.indexOf('useEffect(() => {\n    void refreshGarminState'));
    expect(garminFn).toMatch(/finally\s*\{\s*setGarminStatusChecked\(true\);/);
  });

  it('imports the store-free ProviderSectionSkeleton', () => {
    expect(CODE).toContain("import { ProviderSectionSkeleton } from './ProviderSectionSkeleton';");
  });

  it('never calls the useAppStore() facade (RC-1 W3P2 regression guard — see the render-count harness for the behavioral proof)', () => {
    expect(CODE).not.toMatch(/useAppStore\(/);
  });

  it('gates the provider list on both checked flags, rendering the skeleton until both settle', () => {
    expect(CODE).toMatch(
      /\(!whoopStatusChecked\s*\|\|\s*!garminStatusChecked\)\s*\?\s*\(\s*<ProviderSectionSkeleton\s+count=\{HEALTH_PROVIDERS\.length\}\s*\/>\s*\)\s*:\s*sortedHealthProviders/,
    );
  });

  it('the health-providers list is sorted once via a memoized sortedHealthProviders, not re-sorted inline on every render (RC-1 W3P2, audit item 7)', () => {
    expect(CODE).toMatch(
      /const\s+sortedHealthProviders\s*=\s*React\.useMemo\(\s*\(\)\s*=>\s*\[\.\.\.HEALTH_PROVIDERS\]\.sort\(/,
    );
    // The regression this guards: a fresh `[...HEALTH_PROVIDERS].sort(...)`
    // spread+sort re-appearing directly in the JSX map call site.
    expect(CODE).not.toMatch(/:\s*\[\.\.\.HEALTH_PROVIDERS\]\.sort\(/);
  });
});
