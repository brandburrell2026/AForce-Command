/**
 * HomeScreenV2 — momentum wiring + honest doc-comment guard
 * (RC-1 audit, P0 vs founder's 3-second brief).
 *
 * `HomeScreenV2` pulls in `useAppStore` / `expo-router` / `@clerk/expo` — the
 * same category of store+router-connected container this repo's existing
 * tests deliberately never mount directly (see
 * `components/health/__tests__/connectedHealthContainer.render.test.tsx`'s
 * header, which documents the convention and points at
 * `components/cruise/__tests__/cruiseModeView.render.test.tsx` mounting the
 * presentational `CruiseModeView`, never the connected `CruiseModeScreen`).
 * This file applies that same established pattern: a source-text guard
 * asserting the fix's wiring is present, rather than fabricating a store +
 * router + Clerk harness this suite has no existing pattern for.
 *
 * `LiveStatusLine` itself is already covered independently (it is a pure,
 * tested presentational component per the audit finding); this file is
 * scoped to whether HomeScreenV2 actually imports and renders it under the
 * score arc, and whether the doc comment stopped making a false claim.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('HomeScreenV2 — LiveStatusLine momentum wiring (RC-1 P0)', () => {
  it('imports the existing, tested LiveStatusLine component', () => {
    expect(CODE).toContain("import { LiveStatusLine } from './LiveStatusLine';");
  });

  it('imports the same trend hook + status-verb service the legacy Home uses', () => {
    expect(CODE).toContain("import { useScoreTrend } from '@/hooks/useScoreTrend';");
    expect(CODE).toContain("import { getStatusVerb } from '@/services/statusVerb';");
  });

  it('renders <LiveStatusLine> in the JSX (not just imported and unused)', () => {
    expect(CODE).toMatch(/<LiveStatusLine\s/);
  });

  it('renders LiveStatusLine inside the same block as the arc, tinted with the V2 accent (not a hardcoded legacy color)', () => {
    const arcToCommand = CODE.slice(CODE.indexOf('AFReadinessArc'), CODE.indexOf('One command'));
    expect(arcToCommand).toContain('<LiveStatusLine');
    expect(arcToCommand).toMatch(/accent=\{accent\}/);
  });
});

describe('HomeScreenV2 — pre-hydration skeleton wiring (RC-1 Wave-2B, item 2a)', () => {
  it('imports the store-free HomeSkeleton, not a redeclared inline copy', () => {
    expect(CODE).toContain("import { HomeSkeleton } from './HomeSkeleton';");
  });

  it('reads isHydrated off the sliced bootstrap context (migrated off the useAppStore facade in RC-1 W3P2)', () => {
    expect(CODE).toMatch(/const\s*\{\s*isHydrated\s*\}\s*=\s*useBootstrapSlice\(\);/);
  });

  it('never calls the useAppStore() facade (RC-1 W3P2 regression guard — see the render-count harness for the behavioral proof)', () => {
    expect(CODE).not.toMatch(/useAppStore\(/);
  });

  it('renders <HomeSkeleton /> when NOT hydrated, and the real arc/command/tiles otherwise (mutually exclusive)', () => {
    expect(CODE).toMatch(/!isHydrated\s*\?\s*\(\s*<HomeSkeleton\s*\/>\s*\)\s*:\s*\(/);
    // The real content branch still contains the arc + command card + signals
    // section, i.e. the skeleton did not silently replace them outright.
    const skeletonBranch = CODE.slice(CODE.indexOf('!isHydrated'));
    expect(skeletonBranch).toContain('AFReadinessArc');
    expect(skeletonBranch).toContain('AFCommandCard');
    expect(skeletonBranch).toContain('signalOrder.map');
  });
});

describe('HomeScreenV2 — offline intake outbox visibility (RC-1 Wave-2B, item 1)', () => {
  it('imports AFOfflineBanner and the honest outbox selectors', () => {
    expect(CODE).toMatch(/AFOfflineBanner/);
    expect(CODE).toContain(
      "import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';",
    );
  });

  it('gates the outbox signal on the offline_intake_outbox_enabled flag (flag-off stays byte-identical/inert)', () => {
    expect(CODE).toMatch(/flags\.offline_intake_outbox_enabled\s*\?\s*selectPendingCount\(outboxState\)\s*:\s*0/);
    expect(CODE).toMatch(/flags\.offline_intake_outbox_enabled\s*\?\s*selectHasFailedItem\(outboxState\)\s*:\s*false/);
  });

  it('mounts <AFOfflineBanner> wired to those exact two computed values', () => {
    expect(CODE).toMatch(
      /<AFOfflineBanner\s+pendingCount=\{outboxPendingCount\}\s+hasFailedItem=\{outboxHasFailedItem\}\s*\/>/,
    );
  });

  it('mounts the banner above the fold — after the header, before the hydration-gated content', () => {
    // Anchor updated for ruling E (item 1): the freshness line moved from a
    // static `t('home.v2.freshness')` call to `<HomeFreshnessLabel>` — see
    // `homeFreshness.test.ts` / `HomeFreshnessLabel.render.test.tsx` for
    // that change's own coverage. This test only cares that the anchor
    // still marks the top of the header block.
    const headerToSkeleton = CODE.slice(CODE.indexOf('<HomeFreshnessLabel'), CODE.indexOf('!isHydrated'));
    expect(headerToSkeleton).toContain('<AFOfflineBanner');
  });
});

describe('HomeScreenV2 — doc-comment honesty guard (RC-1 P0)', () => {
  it('the file header no longer claims the legacy detail zones were relocated with "nothing missing"', () => {
    expect(SOURCE).not.toMatch(/now live[\s\S]{0,40}founder ruling: relocate, never delete/);
    expect(SOURCE).not.toMatch(/nothing users had access to on\s*\* the legacy Home went missing/);
  });

  it('the file header states the zones are orphaned pending a founder decision', () => {
    expect(SOURCE.toLowerCase()).toContain('orphaned');
    expect(SOURCE.toLowerCase()).toContain('founder decision');
  });
});
