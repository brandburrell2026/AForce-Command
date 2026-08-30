/**
 * E6-A — SCAN PRODUCER SAFETY: the wiring half.
 *
 * Founder ruling 2026-08-30 (D5 accepted): protect the existing production
 * Scan implementation BEFORE Editorial OS touches it. Three producers had
 * zero coverage anywhere in the repo — a repo-wide grep for `receipt_scanned`,
 * `usePostScan` / `postScanMut` and `stopSpeaking` returned ZERO test files
 * each. Dropping any of them is invisible to every existing suite.
 *
 * WHY THIS FILE IS A SOURCE CONTRACT AND NOT A RENDER TEST
 * `HydrationScanScreenV2` cannot be imported in this environment at all —
 * `await import(...)` fails with `SyntaxError: Unexpected token 'typeof'`
 * from untranspiled dependency source, the same load wall
 * readinessInsightsV2RenderCount.render.test.tsx documents for its own
 * screen. Mounting it would need a new expo-camera / reanimated /
 * expo-router / react-query mock harness, of which this repo has no
 * precedent.
 *
 * More decisive: a render test of THIS screen would not serve the purpose the
 * lane exists for. E6-B adds a SECOND screen and keeps this one as the
 * flag-OFF branch — so a test that mounts the old screen keeps passing while
 * the new one silently drops a producer. The protection has to be a REGISTRY
 * over every screen a scan route mounts, which is what this file is.
 *
 * The behavioural contracts these producers depend on are proven by real
 * execution elsewhere:
 *   analytics/__tests__/event_dispatcher.receiptScanned.test.ts  (6 tests)
 *   lib/__tests__/postScanClientSeam.test.ts                     (7 tests)
 *   services/__tests__/scanSpeechTeardown.test.ts                (5 tests)
 *
 * Lives in components/__tests__/ deliberately: components/scan/__tests__/
 * matches NO vitest include glob and would silently never run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');

/**
 * THE REGISTRY — every screen that renders the Scan experience.
 *
 * E6-B adds its editorial screen here. The completeness guard below makes
 * that non-optional: a scan route that mounts a component absent from this
 * list fails, and once listed, all three producer contracts run against it.
 */
const SCAN_EXPERIENCE_SCREENS: { component: string; file: string }[] = [
  { component: 'HydrationScanScreenV2', file: join('components', 'scan', 'HydrationScanScreenV2.tsx') },
  // E6-B (founder authorization 2026-08-30): the Editorial Scan joins the
  // registry, so every producer contract below runs against it unchanged.
  { component: 'EditorialScanScreen', file: join('components', 'editorial', 'scan', 'EditorialScanScreen.tsx') },
];

/** Route files that mount the Scan experience. Both must move together. */
const SCAN_ROUTES = [join('app', 'scan.tsx'), join('app', '(tabs)', 'scan.tsx')];

/** Balanced-brace slice of the `if (out.ok) { … }` success branch. */
function okBranch(src: string): string {
  const start = src.indexOf('if (out.ok)');
  if (start < 0) return '';
  const open = src.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return '';
}

describe('E6-A · the registry is complete — no scan route may mount an unlisted screen', () => {
  it('every component a scan route renders is in SCAN_EXPERIENCE_SCREENS', () => {
    const listed = new Set(SCAN_EXPERIENCE_SCREENS.map((s) => s.component));
    for (const route of SCAN_ROUTES) {
      const src = strip(read(join(AOS, route)));
      // Every <Foo /> the route can render.
      const rendered = [...src.matchAll(/<([A-Z][A-Za-z0-9_]*)\s*\/?>/g)].map((m) => m[1]!);
      expect(rendered.length, `${route} renders nothing`).toBeGreaterThan(0);
      for (const c of rendered) {
        expect(
          listed.has(c),
          `${route} mounts <${c} /> — add it to SCAN_EXPERIENCE_SCREENS so its producers are checked`,
        ).toBe(true);
      }
    }
  });

  it('BOTH scan routes exist and must move together', () => {
    // The twin-retirement ruling left two unflagged route files rendering the
    // same screen. Flagging only one would leave the other entry point on the
    // old composition — this pins that both are known.
    for (const route of SCAN_ROUTES) {
      expect(() => read(join(AOS, route)), `${route} missing`).not.toThrow();
    }
  });

  it('the registry is non-empty and every listed file exists', () => {
    expect(SCAN_EXPERIENCE_SCREENS.length).toBeGreaterThan(0);
    for (const s of SCAN_EXPERIENCE_SCREENS) {
      expect(() => read(join(AOS, s.file)), `${s.file} missing`).not.toThrow();
    }
  });
});

describe.each(SCAN_EXPERIENCE_SCREENS)(
  'E6-A · producer contract — $component',
  ({ file }) => {
    const src = () => strip(read(join(AOS, file)));

    // ── PRODUCER 1 — receipt_scanned ────────────────────────────────────
    it('P1 emits receipt_scanned exactly once, and only from the success branch', () => {
      const s = src();
      const all = s.match(/emit\(\s*'receipt_scanned'/g) ?? [];
      expect(all.length, 'exactly one emit call site').toBe(1);

      const ok = okBranch(s);
      expect(ok, 'the if (out.ok) success branch must exist').not.toBe('');
      expect(ok, 'the emit must sit INSIDE the success branch').toMatch(
        /emit\(\s*'receipt_scanned'/,
      );
    });

    it('P1 carries sourceKind, so the funnel can tell barcode from qr from manual', () => {
      expect(okBranch(src())).toMatch(/emit\(\s*'receipt_scanned',\s*\{\s*sourceKind:/);
    });

    it('P1 does not block the scan — the emit is fire-and-forget', () => {
      // `await`ing analytics would make a slow network stall the result card.
      expect(okBranch(src())).toMatch(/void emit\(\s*'receipt_scanned'/);
    });

    // ── PRODUCER 2 — the client postScan write ──────────────────────────
    it('P2 writes to the server exactly once, and only from the success branch', () => {
      const s = src();
      const all = s.match(/postScanMut\.mutate\(/g) ?? [];
      expect(all.length, 'exactly one client write call site').toBe(1);

      const ok = okBranch(s);
      expect(ok, 'the write must sit INSIDE the success branch').toMatch(/postScanMut\.mutate\(/);
    });

    it('P2 is wired to the real client seam, not a local reimplementation', () => {
      const s = src();
      expect(s).toMatch(/usePostScan/);
      expect(s, 'the screen must not call the raw api client directly').not.toMatch(
        /\bpostScan\(/,
      );
    });

    it('P2 sends the canonical payload — every field, by name', () => {
      // A dropped field is a silently degraded row on the server, which the
      // client seam test cannot catch because it is handed its payload.
      const ok = okBranch(src());
      for (const field of [
        'loggedAt',
        'source',
        'rawValue',
        'productId',
        'productName',
        'brand',
        'isAForce',
        'verdict',
        'fitScore',
        'scoreBefore',
        'scoreAfter',
        'performanceState',
        'recommendedProductId',
      ]) {
        expect(ok, `payload.${field}`).toMatch(new RegExp(`\\b${field}:`));
      }
    });

    it('P2 cannot double-write from re-entry — the scan is guarded before either producer', () => {
      const s = src();
      // `if (scanning) return;` must precede the producers in runScan, so a
      // second tap while a scan is in flight cannot reach them at all.
      const guard = s.indexOf('if (scanning) return');
      const emitAt = s.indexOf("emit('receipt_scanned'");
      const writeAt = s.indexOf('postScanMut.mutate(');
      expect(guard, 're-entrancy guard must exist').toBeGreaterThan(-1);
      expect(guard).toBeLessThan(emitAt);
      expect(guard).toBeLessThan(writeAt);
      expect(s, 'the guard must be set before the async work begins').toMatch(
        /if \(scanning\) return;\s*setScanning\(true\)/,
      );
    });

    it('P1 + P2 never fire on a failed scan — there is no producer outside the ok branch', () => {
      const s = src();
      const ok = okBranch(s);
      // Remove the success branch; neither producer may appear in what remains.
      const outside = s.replace(ok, '');
      expect(outside, 'no emit outside the success branch').not.toMatch(
        /emit\(\s*'receipt_scanned'/,
      );
      expect(outside, 'no server write outside the success branch').not.toMatch(
        /postScanMut\.mutate\(/,
      );
    });

    // ── PRODUCER 3 — speech teardown ────────────────────────────────────
    it('P3 stops speech on unmount, via a cleanup with no dependencies', () => {
      const s = src();
      expect(s).toMatch(/stopSpeaking/);
      // The cleanup must be an unmount cleanup — an empty dep array — or it
      // re-runs mid-narrative and cuts the coach off on every re-render.
      expect(s, 'unmount cleanup returning stopSpeaking()').toMatch(
        /useEffect\(\s*\(\)\s*=>\s*\{\s*return\s*\(\)\s*=>\s*\{\s*stopSpeaking\(\);\s*\}\s*;?\s*\}\s*,\s*\[\]\s*\)/,
      );
    });

    it('P3 also exposes a direct stop the coach card can call', () => {
      expect(src()).toMatch(/handleCoachStop\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{\s*stopSpeaking\(\)/);
    });
  },
);
