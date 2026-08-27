/**
 * Contrast + touch-target locks for the Phase-1 surfaces (Wave-5 Parts 20/21,
 * extended by the final Phase-1 accessibility pass).
 *
 * Source-scan rather than render: these are static style/prop facts, and a
 * scan holds for every state of the screen rather than the one a harness
 * happens to mount. The contrast case in particular is a VALUE choice
 * (`af.red` vs `af.redText`) that no render assertion would catch, because
 * both render "some red text". The same is true of the iOS-only props below:
 * this repo's react-native-web build maps neither `accessible` nor
 * `accessibilityElementsHidden` / `importantForAccessibility` to ARIA, so a
 * DOM harness literally cannot observe them — asserting them there would lock
 * in react-native-web's behaviour rather than the app's. Where a fact IS
 * observable at render it is locked at render instead, in
 * `components/ui/__tests__/AF*.a11y.render.test.tsx`.
 *
 * Accessibility is a beta gate, so these fail CI rather than living in a doc.
 * (Until this pass they did neither: the file matched no vitest include glob
 * and had never run. See vitest.config.ts.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(resolve(PKG, rel), 'utf8');

/**
 * Blank comments char-for-char (line numbers preserved), the same technique
 * theme/__tests__/brandTokenLiterals.lock.test.ts uses. Needed for the banned-
 * prop scans below: each fix leaves a breadcrumb naming the prop it removed,
 * and a naive `toContain` would read that breadcrumb as the defect itself.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

const manageSub = read('components/subscription/ManageSubscriptionScreenV2.tsx');
const subscription = read('components/subscription/SubscriptionScreenV2.tsx');
const circle = read('components/community/CircleScreenV3.tsx');
const tokens = read('theme/afTokens.ts');
const progressRing = read('components/ui/AFProgressRing.tsx');
const disclosureSheet = read('components/ui/AFDisclosureSheet.tsx');
const topBar = read('components/ui/AFTopBar.tsx');
const hydration = read('components/hydration/HydrationScreenV2.tsx');
const home = read('components/home/HomeScreenV2.tsx');
const protocol = read('components/protocol/ProtocolScreenV2.tsx');
const scan = read('components/scan/HydrationScanScreenV2.tsx');

describe('contrast — Signal Red is never TEXT on a dark surface', () => {
  it('the token file still documents the failure and still provides redText', () => {
    // If this ever stops being true the rule below is arguing with nothing.
    expect(tokens).toMatch(/fails WCAG AA/i);
    expect(tokens).toMatch(/redText:\s*'#E4564A'/);
  });

  it('subscription status TEXT uses the AA token, not the brand fill red', () => {
    // A canceled or past-due subscription is the status a member most needs
    // to be able to read; it was rendering at ~3.1:1 in 9px type.
    expect(manageSub).toContain('const statusTextColor =');
    expect(manageSub).toMatch(/statusTextColor\s*=\s*statusColor === af\.red \? af\.redText/);
    expect(manageSub).toContain('color: statusTextColor');
    expect(manageSub).not.toMatch(/styles\.statusText,\s*\{\s*color: statusColor\s*\}/);
  });

  it('the pill fill, border and dot still use brand red (fills are exempt)', () => {
    // The token guidance is explicit: fills/borders/dots keep `red`; only
    // text and icons move to redText. Over-applying redText would drift the
    // brand mark.
    expect(manageSub).toContain('backgroundColor: statusColor');
    expect(manageSub).toMatch(/borderColor: `\$\{statusColor\}/);
  });
});

describe('touch targets + tab semantics', () => {
  it('Circle scope tabs are tabs inside a tablist, per the repo idiom', () => {
    // AFSegmentedControl is the house pattern: role="tab" within role="tablist".
    expect(circle).toContain('accessibilityRole="tablist"');
    expect(circle).toContain('accessibilityRole="tab"');
    expect(circle).not.toMatch(/accessibilityRole="button"\n\s*accessibilityState=\{\{ selected: tab === key \}\}/);
  });

  it('Circle scope tabs carry hitSlop to reach the 44pt minimum', () => {
    // 9pt padding + an 18pt caption line is ~36pt of real estate.
    const tabBlock = circle.slice(circle.indexOf('circle-v3-tabs'), circle.indexOf('circle-v3-tab-') + 400);
    expect(tabBlock).toContain('hitSlop');
  });

  it('subscription category filters are a tablist and carry hitSlop', () => {
    expect(subscription).toMatch(/styles\.filterRow\} accessibilityRole="tablist"/);
    const filterBlock = subscription.slice(
      subscription.indexOf('availableFilters.map'),
      subscription.indexOf('filterTextActive'),
    );
    expect(filterBlock).toContain('hitSlop');
    expect(filterBlock).toContain('accessibilityRole="tab"');
  });

  it('the disclosure sheet\'s close control clears 44pt', () => {
    // This is now the ONE sheet behind Performance Signal's day/week detail and
    // Protocol's WHY, so it is the most-tapped small control in Phase-1. An
    // 18pt glyph needs >=13pt of slop per edge; it shipped with 12 (42pt).
    const closeBlock = disclosureSheet.slice(
      disclosureSheet.indexOf('accessibilityRole="button"'),
      disclosureSheet.indexOf('<ScrollView'),
    );
    const slop = /hitSlop=\{(\d+)\}/.exec(closeBlock);
    expect(slop, 'the close control must declare a numeric hitSlop').not.toBeNull();
    expect(18 + 2 * Number(slop![1])).toBeGreaterThanOrEqual(44);
  });
});

describe('focus order — nothing stands in front of the sheet it belongs to', () => {
  it('the disclosure backdrop is not an assistive-tech element', () => {
    // It was an absolutely-filled Pressable labelled "Dismiss", declared BEFORE
    // the panel: a screen reader entering the sheet landed on a full-screen
    // control instead of the title, and heard an untranslated English word.
    // Tap-outside still dismisses; the header Close button is the reader's path.
    const backdropBlock = disclosureSheet.slice(
      disclosureSheet.indexOf('styles.backdrop'),
      disclosureSheet.indexOf('styles.panel'),
    );
    expect(backdropBlock).toContain('accessibilityElementsHidden');
    expect(backdropBlock).not.toContain('accessibilityRole="button"');
    expect(backdropBlock).not.toContain('"Dismiss"');
  });

  it('the sheet\'s own close control is translated, not hardcoded English', () => {
    expect(disclosureSheet).toContain("t('common.close')");
  });
});

describe('charts + rings always leave a text alternative', () => {
  it('AFProgressRing becomes an element only when it is named', () => {
    // A View is not an accessibility element on iOS unless `accessible` is set
    // — the AFCard fact. Declaring role/value without it exposed nothing.
    expect(progressRing).toMatch(/const named = accessibilityLabel != null && accessibilityLabel !== ''/);
    expect(progressRing).toContain('accessible={named}');
  });

  it('AFProgressRing hides its centered reading ONLY when it has named itself', () => {
    // The shipped bug was the unconditional pair below: no name AND no
    // children left the ring silent. Either half alone is the regression.
    expect(progressRing).toContain('accessibilityElementsHidden={named}');
    expect(progressRing).toMatch(/importantForAccessibility=\{named \? 'no-hide-descendants' : undefined\}/);
    expect(progressRing).not.toMatch(/accessibilityElementsHidden\s*\n\s*importantForAccessibility="no-hide-descendants"/);
  });

  it('the Hydration intake ring names itself', () => {
    // The only consumer that hid a real reading. Its `{pct}%` was unreachable.
    const ringBlock = hydration.slice(
      hydration.indexOf('<AFProgressRing'),
      hydration.indexOf('</AFProgressRing>'),
    );
    expect(ringBlock).toContain("t('hydration.v2.ring_a11y'");
  });
});

describe('state is never left to colour or a glyph alone', () => {
  it('AFTimeline speaks each step\'s state instead of drawing it only', () => {
    const timeline = read('components/ui/AFTimeline.tsx');
    expect(timeline).toContain('export function timelineStepA11yLabel');
    expect(timeline).toContain('accessibilityLabel={timelineStepA11yLabel(step, stateLabels)}');
  });

  it('the Hydration week strip says logged / not logged / today in words', () => {
    // The dots said it by fill and border colour; `accessibilityState.selected`
    // is not announced on a plain non-interactive View, so the strip spoke
    // seven weekday names and no week.
    expect(hydration).toContain("'hydration.v2.day_logged'");
    expect(hydration).toContain("'hydration.v2.day_not_logged'");
    expect(hydration).toContain("t('common.today')");
  });

  it('Circle\'s own-rank movement pill says which way it moved', () => {
    // A bare "↑" glyph is read inconsistently or skipped. Reuses the leader
    // rows' existing move strings rather than inventing a second vocabulary.
    const spotsBlock = circle.slice(
      circle.indexOf('you.deltaSpots != null'),
      circle.indexOf('styles.statsRow'),
    );
    expect(spotsBlock).toContain("'community.v3.row_move_up'");
    expect(spotsBlock).toContain("'community.v3.row_move_down'");
  });

  it('Circle\'s you-card stats are composed pairs, not loose numeral+label Texts', () => {
    // Same defect AFStatPair exists to end; the leader rows below had already
    // been collapsed to one sentence each while these stayed ten fragments.
    expect(circle).toContain('AFStatPair');
    expect(circle).not.toMatch(/<Text style=\{styles\.statValue\}>\{value\}<\/Text>/);
  });
});

describe('Dynamic Type — Phase-1 values reflow, they do not shrink', () => {
  // `adjustsFontSizeToFit` makes text SMALLER as the member's chosen size
  // grows. On a value or a heading that is the inversion of Dynamic Type, and
  // AF_MAX_DISPLAY_FONT_SCALE is the documented tool for the real problem it
  // was papering over (an oversized display face blowing out a fixed layout).
  const cases: [string, string][] = [
    ['AFTopBar (heads 9 Phase-1 screens)', topBar],
    ['Home signal tiles', home],
    ['Protocol V3 signal tiles', protocol],
  ];
  for (const [name, src] of cases) {
    it(`${name} carries no adjustsFontSizeToFit`, () => {
      expect(stripComments(src)).not.toContain('adjustsFontSizeToFit');
    });
  }

  it('AFTopBar caps the title with the display ceiling instead', () => {
    expect(topBar).toContain('maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}');
  });

  it('self-test: stripComments hides a breadcrumb but not a real call site', () => {
    // Without this the three scans above could pass for the wrong reason —
    // stripping too much, and blinding themselves to the prop they exist to ban.
    expect(stripComments('// removed adjustsFontSizeToFit here\n')).not.toContain(
      'adjustsFontSizeToFit',
    );
    expect(stripComments('<Text adjustsFontSizeToFit>{v}</Text>')).toContain(
      'adjustsFontSizeToFit',
    );
  });
});

describe('contrast — red icons on Phase-1 surfaces use the AA token', () => {
  it('HydroScan renders no brand-red glyph anywhere (S2-8: the tinted CTA became a sheet row)', () => {
    // The token rule is text AND icons take redText on dark (~3.1:1 vs 5.3:1).
    // S2-8 collapsed the Smart Capture CTA into a default-tint AFListRow
    // inside the disclosure sheet, so the stronger invariant now holds:
    // this surface colors NO icon with brand red at all.
    expect(tokens).toMatch(/redText: '#E4564A'/);
    expect(scan).not.toContain('color={af.red}');
    expect(scan).toContain('testID="hydroscan-smart-capture"');
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * S2-12 — the guard goes app-wide.
 *
 * Until now this suite covered a handful of named files; the classes of
 * defect the Stage-2 program just spent five PRs killing (shrink-to-fit
 * defeating Dynamic Type, dark-on-red literals failing AA, numeric clamp
 * literals drifting from the house token) could quietly return anywhere
 * else. These walks make the whole production surface the coverage.
 * ──────────────────────────────────────────────────────────────────────── */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walkProduction(): Array<{ rel: string; code: string }> {
  const out: Array<{ rel: string; code: string }> = [];
  const roots = ['components', 'app', 'screens', 'hooks'];
  const visit = (dir: string) => {
    for (const name of readdirSync(resolve(PKG, dir))) {
      const rel = join(dir, name);
      const full = resolve(PKG, rel);
      if (statSync(full).isDirectory()) {
        if (name === 'node_modules' || name === '__tests__') continue;
        visit(rel);
        continue;
      }
      if (!/\.tsx?$/.test(name) || name.includes('.test.')) continue;
      const src = readFileSync(full, 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
      out.push({ rel, code });
    }
  };
  for (const r of roots) visit(r);
  return out;
}

describe('S2-12 — Dynamic Type is never opted out of, app-wide', () => {
  const files = walkProduction();

  it('allowFontScaling={false} appears nowhere in production', () => {
    const hits = files.filter((f) => f.code.includes('allowFontScaling={false}')).map((f) => f.rel);
    expect(hits).toEqual([]);
  });

  it('shrink-to-fit exists only on the fixed-canvas share ARTWORK (and the flag-dead legacy queued for S2-13)', () => {
    // Share cards render to an image at fixed dimensions — shrink-to-fit is
    // correct there and documented at the call sites. The two legacy screens
    // are unreachable at flag defaults and are deleted by S2-13; listing
    // them here keeps the walk total instead of blessing them.
    const ALLOW = new Set([
      'components/ShareCard.tsx',
      'components/ShareStory.tsx',
      // Route-imported flag-OFF fallbacks (rollback paths): retirement is
      // a founder ruling, not a cleanup — S2-13's census corrected the
      // earlier 'S2-13 deletes' note.
      'screens/SweatCalculatorScreen.tsx',
      'screens/CirclesScreen.tsx',
    ]);
    const hits = files
      .filter((f) => f.code.includes('adjustsFontSizeToFit') && !ALLOW.has(f.rel))
      .map((f) => f.rel);
    expect(hits).toEqual([]);
  });

  it('every Dynamic Type clamp is the house token, never a numeric literal', () => {
    const hits = files
      .filter((f) => /maxFontSizeMultiplier=\{\s*[\d.]/.test(f.code))
      .map((f) => f.rel);
    expect(hits).toEqual([]);
  });
});

describe('S2-12 — the canvas-as-ink AA failure class is extinct, app-wide', () => {
  it("no text/icon color is '#0A0A0F' (the literal behind every real AA failure found)", () => {
    // All three measured AA failures used the dark-canvas literal as ink on
    // an af.red fill. Generic '#000' on LIGHT fills (gold badges, green
    // pills) measures AA-passing and is judged by the S2-14 device pass,
    // not banned statically. The three flag-dead legacy screens are
    // allowlisted pending their S2-13 deletion.
    const ALLOW = new Set([
      'components/auth/SignInLegacy.tsx', //   flag-dead — S2-13 deletes
      'components/auth/SignUpLegacy.tsx', //   flag-dead — S2-13 deletes
      'components/profile/ProfileLegacy.tsx', // flag-dead — S2-13 deletes
    ]);
    const rx = /(?<![A-Za-z])color\s*[:=]\s*["'{]*["']#0A0A0F["']/;
    const hits = walkProduction()
      .filter((f) => rx.test(f.code) && !ALLOW.has(f.rel))
      .map((f) => f.rel);
    expect(hits).toEqual([]);
  });
});

describe('S2-12b — measured sub-AA text classes are extinct, app-wide', () => {
  /**
   * Style-object co-location: a `{...}` carrying BOTH fontSize and the value
   * under test is one rendered element, so these scans have no false
   * pairings. Thresholds are measured, not aspirational:
   *
   * - White-alpha text below 0.45 fails 4.5:1 on EVERY app surface (0.40
   *   composites to 3.81:1 over the darkest canvas — the most favorable
   *   ground — and only gets worse on lighter surfaces). 0.45-and-up is
   *   ground-dependent and stays with the device pass, exactly like the
   *   '#000'-on-light call in the rule above.
   * - Black-alpha text is not scanned statically: it sits on colored/light
   *   fills whose ground cannot be read from the style object.
   */
  it('white-alpha text never dips below the 0.45 measured floor', () => {
    const ALLOW = new Set([
      'app/modules.tsx', //                    developer launcher — route-clamped by developerControlsAvailable()
      'components/home/MembershipCard.tsx', // preview-STATE dimming of sample values (deliberate, sample-data honesty pattern)
    ]);
    const rx = /color:\s*'rgba\(255,\s*255,\s*255,\s*(0?\.\d+)\)'/;
    const hits: string[] = [];
    for (const f of walkProduction()) {
      if (ALLOW.has(f.rel)) continue;
      for (const m of f.code.matchAll(/\{[^{}]*\}/g)) {
        if (!m[0].includes('fontSize')) continue;
        const c = m[0].match(rx);
        if (c && parseFloat(c[1]) < 0.45) hits.push(`${f.rel} (${c[1]})`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('no text style carries a fixed height — text boxes grow with Dynamic Type (minHeight is the pattern)', () => {
    const ALLOW = new Set([
      // Route-imported flag-OFF fallback (rollback path) — retirement is the
      // founder ruling pending in #832, same standing as the lists above.
      'screens/HydrationScanScreen.tsx',
    ]);
    const hits: string[] = [];
    for (const f of walkProduction()) {
      if (ALLOW.has(f.rel)) continue;
      for (const m of f.code.matchAll(/\{[^{}]*\}/g)) {
        if (m[0].includes('fontSize') && /(?<![a-zA-Z])height:\s*\d/.test(m[0])) hits.push(f.rel);
      }
    }
    expect(hits).toEqual([]);
  });
});
