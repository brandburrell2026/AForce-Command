/**
 * Wave-5 — the simulate-scan tray must be unreachable in a production build.
 *
 * The "PREVIEW SCAN" tray (AForce-products tab, Other-Brands tab, SKU
 * dropdown) called the same `runScan()` a camera scan does, so a simulated
 * result landed in real persisted scan history — a member could author scan
 * records for products they never held, which is the sharpest "observation
 * never diagnosis" violation the audit found. The tray is now gated on
 * `PREVIEW_SCAN_ENABLED` (services/demoMode.ts): `__DEV__ || DEMO_MODE`, the
 * same predicate demo/galleryFixtures.ts uses for its own dev/demo guard.
 *
 * Two halves, because neither alone is proof:
 *
 *  1. BEHAVIORAL — `PREVIEW_SCAN_ENABLED` is a module-level constant read once
 *     at import (mirroring the build-time inlining babel-preset-expo gives it),
 *     so each case sets `__DEV__` / `EXPO_PUBLIC_DEMO_MODE`, calls
 *     `vi.resetModules()`, and re-imports. Same shape as
 *     `appleHealth.internalTestflightGate.test.ts` and
 *     `demo/__tests__/galleryFixtures.guard.test.ts`.
 *
 *  2. SOURCE-TEXT — both scan screens are store + router + Clerk-connected
 *     containers this suite deliberately never mounts (convention documented
 *     in `components/home/__tests__/homeScreenV2Wiring.test.ts`), so the
 *     wiring is asserted against source text: the tray's every entry point
 *     sits inside the guard, and the real scan path sits outside it.
 *
 * Mutation-tested: deleting `{PREVIEW_SCAN_ENABLED && (` from either screen,
 * and hardcoding the constant to `true`, each fail this file (see PR notes).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ORIGINAL_DEMO_ENV = process.env['EXPO_PUBLIC_DEMO_MODE'];

async function loadGate(
  devGlobal: boolean | undefined,
  demoEnv: string | undefined,
): Promise<boolean> {
  vi.resetModules();
  if (devGlobal === undefined) {
    vi.unstubAllGlobals();
  } else {
    vi.stubGlobal('__DEV__', devGlobal);
  }
  if (demoEnv === undefined) {
    delete process.env['EXPO_PUBLIC_DEMO_MODE'];
  } else {
    process.env['EXPO_PUBLIC_DEMO_MODE'] = demoEnv;
  }
  const mod = await import('../demoMode');
  return mod.PREVIEW_SCAN_ENABLED;
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_DEMO_ENV === undefined) {
    delete process.env['EXPO_PUBLIC_DEMO_MODE'];
  } else {
    process.env['EXPO_PUBLIC_DEMO_MODE'] = ORIGINAL_DEMO_ENV;
  }
  vi.resetModules();
});

describe('PREVIEW_SCAN_ENABLED — simulate-scan gate', () => {
  it('is OFF in a production build (__DEV__ false, no demo env) — the tray cannot render', async () => {
    expect(await loadGate(false, undefined)).toBe(false);
  });

  it('stays OFF in a production build when the demo env is present but not exactly "true"', async () => {
    expect(await loadGate(false, 'false')).toBe(false);
    expect(await loadGate(false, '1')).toBe(false);
    expect(await loadGate(false, 'TRUE')).toBe(false);
  });

  it('is OFF when __DEV__ is absent entirely (no Metro global — e.g. a bare node/server bundle)', async () => {
    expect(await loadGate(undefined, undefined)).toBe(false);
  });

  it('is ON under __DEV__ so engineering keeps the tray', async () => {
    expect(await loadGate(true, undefined)).toBe(true);
  });

  it('is ON in the internal demo build (EXPO_PUBLIC_DEMO_MODE=true) even when __DEV__ is false', async () => {
    expect(await loadGate(false, 'true')).toBe(true);
  });
});

// ─── Source-text wiring guard, both scan screens ──────────────────────────
const AFORCE_OS_ROOT = resolve(__dirname, '../..');

const SCREENS = [
  { label: 'HydrationScanScreenV2', path: 'components/scan/HydrationScanScreenV2.tsx' },
  { label: 'HydrationScanScreen (legacy)', path: 'screens/HydrationScanScreen.tsx' },
] as const;

/**
 * Source with comments stripped, so a guard can never be satisfied by prose.
 *
 * The line-comment pattern refuses a `//` preceded by `:` — otherwise the
 * `aforce://product/…` QR literal in the SKU picker is read as a comment and
 * the rest of that statement (including its closing paren) vanishes, which
 * silently breaks the paren matching below.
 */
function codeOf(relPath: string): string {
  return readFileSync(resolve(AFORCE_OS_ROOT, relPath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const GUARD_OPEN = '{PREVIEW_SCAN_ENABLED && (';

/**
 * Split source into [inside the guard, everything else].
 *
 * The block end is found by matching the guard's own opening paren, NOT by
 * searching for a landmark like `</AFModal>`: an earlier draft anchored on the
 * landmark and a mutant that moved the SKU-picker modal OUT of the guard still
 * passed, because the slice simply ran past the guard's `)}` to reach it.
 * Paren matching cannot be fooled that way. Comments are already stripped, and
 * no string literal in either screen contains an unbalanced paren.
 */
function splitOnGuard(code: string): { guarded: string; outside: string } {
  const start = code.indexOf(GUARD_OPEN);
  if (start === -1) throw new Error('guard opening not found');
  let depth = 0;
  let i = start + GUARD_OPEN.length - 1; // the `(` of `&& (`
  for (; i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    else if (code[i] === ')') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error('guard block never closes');
  const end = i + 1;
  return { guarded: code.slice(start, end), outside: code.slice(0, start) + code.slice(end) };
}

describe.each(SCREENS)('$label — preview tray is gated', ({ path }) => {
  const CODE = codeOf(path);

  it('imports the shared gate rather than re-deriving __DEV__ locally', () => {
    expect(CODE).toContain("import { PREVIEW_SCAN_ENABLED } from '@/services/demoMode';");
    // A local `__DEV__` read would be a second, drift-prone definition of the
    // same rule; the shared constant is the only source of truth.
    expect(CODE).not.toMatch(/__DEV__/);
  });

  it('opens the tray block with the guard', () => {
    expect(CODE).toMatch(/\{PREVIEW_SCAN_ENABLED && \(\s*<>/);
  });

  it('keeps every simulate control inside the guarded block', () => {
    const { guarded, outside } = splitOnGuard(CODE);

    for (const control of [
      'styles.trayCard',
      'preview-tab-aforce',
      'preview-tab-other',
      'preview-aforce-picker-open',
      'preview-aforce-picker-row-',
      'otherBrandChips.map',
      'aforcePickerRows.map',
      // The SKU-picker sheet is the second simulate entry point and must be
      // gated in its own right, not merely unreachable because its opener is.
      '<AFModal',
      'styles.pickerSheet',
    ]) {
      expect(guarded).toContain(control);
      expect(outside).not.toContain(control);
    }
  });

  it('leaves the real scan path outside the guard — camera, manual search and logging are untouched', () => {
    const { guarded, outside } = splitOnGuard(CODE);

    // Nothing that reaches the store or the camera may sit inside a block
    // that disappears from a release bundle.
    expect(guarded).not.toContain('logIntake');
    expect(guarded).not.toContain('CameraScanModal');

    // The camera viewfinder, its modal, the manual-search submit and the
    // intake-logging CTAs must all still render unconditionally.
    expect(outside).toMatch(/onPress=\{openCamera\}/);
    expect(outside).toMatch(/<CameraScanModal/);
    expect(outside).toMatch(/onSubmitEditing=\{onManualSubmit\}/);
    expect(outside).toMatch(/hydroscan-log-any-drink/);
    expect(outside).toMatch(/hydroscan-smart-capture/);
    // The gate must not have leaked onto the real scan handlers.
    expect(CODE).not.toMatch(/PREVIEW_SCAN_ENABLED[^\n]*runScan/);
    expect(CODE).not.toMatch(/const runScan[\s\S]{0,400}PREVIEW_SCAN_ENABLED/);
  });

  it('never tells the member to tap a preview control that is not mounted', () => {
    // The web empty-state hint points AT the tray, so it is conditioned on the
    // same gate; the fallback hint names only always-present affordances.
    expect(CODE).toMatch(/Platform\.OS === 'web' && PREVIEW_SCAN_ENABLED/);
    expect(CODE).not.toMatch(/use simulate scan/);
  });
});

describe('scan empty-state copy — no locale points at a gated control', () => {
  const LOCALES_DIR = resolve(AFORCE_OS_ROOT, 'locales');
  const LOCALES = [
    'ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt', 'zh',
  ] as const;

  // V2 reads this hint through i18n, so gating the tray in TSX is only half
  // the fix: every locale must also stop naming "simulate scan", which no
  // longer exists in a release build. All 11 files carry the same English
  // placeholder for this key (see docs/i18n/TRANSLATION-REVIEW.md), so the
  // assertion is exact rather than a per-locale allowlist.
  it.each(LOCALES)('%s.json hydroScan2.v2.empty_hint_native names only always-present affordances', (locale) => {
    const json = JSON.parse(readFileSync(resolve(LOCALES_DIR, `${locale}.json`), 'utf8'));
    const hint: string = json.hydroScan2.v2.empty_hint_native;
    expect(hint).toBe('Tap the viewfinder to open the camera, or search by name.');
  });
});

/**
 * Wave-5 motion pass — the scan surface is CALM.
 *
 * These replace (and strengthen) the earlier "the pulse is gated on
 * reduced-motion and torn down" assertions. The founder's brief removes
 * constant pulsing rather than tuning it down, so the ring pulse is gone
 * entirely — and "there is no unbounded loop to gate" is a strictly stronger
 * guarantee than "the loop is gated correctly". Asserted against source text
 * because both scan screens are store + router + Clerk-connected containers
 * this suite deliberately never mounts (same convention as the tray guard
 * above).
 */
describe.each(SCREENS)('$label — no unbounded animation on the scan surface', ({ path }) => {
  const CODE = codeOf(path);

  it('has no infinite withRepeat loop at all', () => {
    // Comments explaining the removal are allowed to name it; code is not.
    const withoutComments = CODE.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/withRepeat/);
  });

  it('no longer declares the pulsing scan-ring shared values', () => {
    expect(CODE).not.toMatch(/ringScale/);
    expect(CODE).not.toMatch(/ringOpacity/);
    expect(CODE).not.toMatch(/ringStyle/);
  });

  it('renders the framing ring as a plain, static View', () => {
    expect(CODE).toContain('<View style={styles.ring} />');
  });

  it('still cancels the finite success flash on unmount', () => {
    expect(CODE).toMatch(/cancelAnimation\(flashOpacity\)/);
  });
});

/**
 * Wave-5 haptic language — a scan reaches the member's hand for exactly two
 * reasons, both named in `components/ui/motionLogic.ts`.
 */
describe.each(SCREENS)('$label — haptics speak the four-moment language', ({ path }) => {
  const CODE = codeOf(path);

  it('fires hydration_logged when an intake is actually accepted', () => {
    expect(CODE).toContain("fireMoment('hydration_logged')");
  });

  it('fires state_transition ONLY for a verdict that needs attention', () => {
    expect(CODE).toMatch(
      /if \(out\.result\.verdict === 'avoid' \|\| out\.result\.verdict === 'suboptimal'\) \{\s*fireMoment\('state_transition'\);\s*\}/,
    );
  });

  it('no longer buzzes on a good verdict (every scan used to vibrate)', () => {
    // The old call passed a Success/Warning ternary straight to expo-haptics.
    expect(CODE).not.toMatch(/NotificationFeedbackType\.Warning\s*\n?\s*:\s*Haptics\.NotificationFeedbackType\.Success/);
  });
});
