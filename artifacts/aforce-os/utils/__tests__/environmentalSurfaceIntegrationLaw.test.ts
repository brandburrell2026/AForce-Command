/**
 * LANE 3 NATIVE INTEGRATION LAWS.
 *
 * The view-model laws prove the truth cannot be fabricated. These prove the
 * SURFACE is wired correctly around it: that the flag really gates the member
 * route, that the two flags stay independent, and that nothing in the native
 * layer re-opens a door the truth layers closed.
 *
 * Source-level assertions here are deliberately anchored on CODE shapes
 * (imports, JSX props, gating expressions) rather than prose, because a
 * comment-matching scan passes on documentation — a trap this program has
 * already been caught by twice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';
import {
  buildEnvironmentalView,
} from '../environment/environmentalPresentation';
import { interpretEnvironment } from '../environment/environmentalInterpretation';
import { ATMOSPHERE } from '../environment/environmentalAtmosphere';
import {
  observe,
  type EnvironmentalEvidence,
  type EnvironmentalSignal,
  type EnvironmentalUnit,
} from '../environment/environmentalEvidence';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const PANE = read('components/profile/panes/PerformancePane.tsx');
const SCREEN = read('screens/EnvironmentalScreen.tsx');
const ROUTE = read('app/environment.tsx');
const FIELD = read('components/environment/EnvironmentalField.tsx');

const T0 = Date.UTC(2026, 8, 7, 12, 0, 0);
const seen = (s: EnvironmentalSignal, v: number, u: EnvironmentalUnit) =>
  observe({ signal: s, value: v, unit: u, observedAt: T0, provenance: 'provider',
    source: 'open-meteo', locationPrecision: 'coarse' }, T0) as EnvironmentalEvidence<number>;

// ── 1 · the member seam ─────────────────────────────────────────────────────

describe('LAW 1 — the presentation flag gates the member route row', () => {
  it('the row is rendered ONLY under the presentation flag', () => {
    expect(PANE).toContain('flags.environmental_surface_enabled ?');
  });

  it('there is EXACTLY ONE Environment row', () => {
    const rows = PANE.match(/testID="profile-environment-link"/g) ?? [];
    expect(rows).toHaveLength(1);
  });

  it('the row reaches /environment', () => {
    expect(PANE).toMatch(/router\.push\('\/environment'/);
  });

  it('the row gates on PRESENTATION, never on acquisition', () => {
    // Coupling them would mean showing the surface silently turns on
    // collection, or that collecting silently exposes an unreleased screen.
    const rowBlock = PANE.slice(
      PANE.indexOf('environmental_surface_enabled'),
      PANE.indexOf('testID="profile-environment-link"') + 400,
    );
    expect(rowBlock).not.toContain('environmental_acquisition_enabled');
  });

  it('no sixth tab and no third Profile group were added', () => {
    const layout = read('app/(tabs)/_layout.tsx');
    expect(layout).not.toContain('environment');
    // The IA lock: the performance tab returns exactly two top-level groups.
    expect(PANE).not.toContain('SectionHeader label="Environment"');
  });

  it('the route follows the thin re-export pattern', () => {
    expect(ROUTE).toContain("from \"@/screens/EnvironmentalScreen\"");
    expect(ROUTE.split('\n').filter((l) => l.trim()).length).toBeLessThanOrEqual(3);
  });
});

// ── 2 · flags stay independent, production stays off ────────────────────────

describe('LAW 2 — acquisition and presentation are independent', () => {
  it('both are OFF for production members', () => {
    expect(DEFAULT_FLAGS.environmental_surface_enabled).toBe(false);
    expect(DEFAULT_FLAGS.environmental_acquisition_enabled).toBe(false);
  });

  it('both are available to the internal cohort', () => {
    expect(DEMO_ALL_ON_FLAGS.environmental_surface_enabled).toBe(true);
    expect(DEMO_ALL_ON_FLAGS.environmental_acquisition_enabled).toBe(true);
  });

  it('each can move without the other', () => {
    const surfaceOnly = { ...DEFAULT_FLAGS, environmental_surface_enabled: true };
    expect(surfaceOnly.environmental_acquisition_enabled).toBe(false);
    const acquireOnly = { ...DEFAULT_FLAGS, environmental_acquisition_enabled: true };
    expect(acquireOnly.environmental_surface_enabled).toBe(false);
  });

  it('the routed screen dead-ends when the presentation flag is off', () => {
    // A stray deep link must not reach an unreleased surface.
    expect(SCREEN).toContain('if (!enabled) return <Redirect');
  });
});

// ── 3 · the screen cannot re-open a closed door ─────────────────────────────

describe('LAW 3 — the native layer authors nothing', () => {
  it('the screen never builds its own command text', () => {
    // The AForce plane takes a string prop. If the screen ever templated an
    // action itself, Environmental would have become a command authority.
    expect(SCREEN).toContain('commandAction');
    expect(SCREEN).toMatch(/engine\.command\?\.action/);
    for (const imperative of ['Drink ', 'Take ', 'oz water', 'sticks']) {
      expect(SCREEN, imperative).not.toContain(imperative);
    }
  });

  it('the command plane renders ONLY when the view model permits it', () => {
    expect(SCREEN).toMatch(/view\.showsCommand \?/);
  });

  it('and showsCommand is false for every non-attention state', () => {
    const clear = buildEnvironmentalView(interpretEnvironment({
      temperature: seen('temperature', 17, 'celsius'), humidity: seen('humidity', 45, 'percent'),
      uvIndex: seen('uvIndex', 2, 'uvIndex'), airQuality: seen('airQuality', 20, 'aqiUs') }, T0));
    const insufficient = buildEnvironmentalView(interpretEnvironment({}, T0));
    expect(clear.showsCommand).toBe(false);
    expect(insufficient.showsCommand).toBe(false);
  });

  it('the field renders NO imagery — atmosphere only', () => {
    // A drawn sun or cloud would be a claim about the sky.
    for (const banned of ['Image', 'require(', '.png', '.jpg', 'Lottie', 'svg']) {
      expect(FIELD, banned).not.toContain(banned);
    }
  });

  it('the field is hidden from assistive tech — the text announces the state', () => {
    expect(FIELD).toContain('accessibilityElementsHidden');
    expect(FIELD).toContain('importantForAccessibility="no-hide-descendants"');
  });
});

// ── 4 · truth cannot be undone at the last inch ─────────────────────────────

describe('LAW 4 — the surface preserves every earlier repair', () => {
  it('INSUFFICIENT can never render as CLEAR', () => {
    const insufficient = buildEnvironmentalView(interpretEnvironment({}, T0));
    const clear = buildEnvironmentalView(interpretEnvironment({
      temperature: seen('temperature', 17, 'celsius'), humidity: seen('humidity', 45, 'percent'),
      uvIndex: seen('uvIndex', 2, 'uvIndex'), airQuality: seen('airQuality', 20, 'aqiUs') }, T0));
    expect(insufficient.stateWord).not.toBe(clear.stateWord);
    expect(insufficient.line).not.toBe(clear.line);
    // ...and their atmospheres differ, so the two are not merely different words.
    expect(ATMOSPHERE.insufficient.unresolved).toBe(true);
    expect(ATMOSPHERE.clear.unresolved).toBe(false);
    expect(ATMOSPHERE.insufficient.base)
      .not.toEqual(ATMOSPHERE.clear.base);
  });

  it('every state has a DISTINCT atmosphere — colour is never the only carrier', () => {
    const A = ATMOSPHERE;
    const states = ['clear', 'aware', 'prepare', 'caution', 'insufficient'] as const;
    // Horizon height and vignette vary independently of hue, so the states
    // remain distinguishable in greyscale and for colour-blind members.
    expect(new Set(states.map((s) => A[s].glow)).size).toBe(5);
    expect(new Set(states.map((s) => `${A[s].horizon}:${A[s].vignette}`)).size).toBe(5);
  });

  it('HEAT can never acquire a display number in the native layer', () => {
    const caution = buildEnvironmentalView(interpretEnvironment({
      temperature: seen('temperature', 41, 'celsius'), humidity: seen('humidity', 75, 'percent'),
      airQuality: seen('airQuality', 165, 'aqiUs') }, T0));
    const heat = [caution.dominant, ...caution.secondary].find((r) => r?.signal === 'heat');
    expect(heat?.value ?? null).toBeNull();
    // The screen renders `value` only when non-null, so a null can never print.
    expect(SCREEN).toMatch(/value != null \?/);
  });

  it('raw band identifiers cannot reach consumer copy', () => {
    // Word-bounded: a bare /EPA/ matches inside "PREPARE".
    const blob = JSON.stringify(buildEnvironmentalView(interpretEnvironment({
      temperature: seen('temperature', 41, 'celsius'), humidity: seen('humidity', 75, 'percent'),
      uvIndex: seen('uvIndex', 9, 'uvIndex'), airQuality: seen('airQuality', 165, 'aqiUs') }, T0)));
    expect(blob).not.toMatch(/\b(NWS|WHO|EPA)\b/);
    // ...and the screen never reaches for the field that carries them.
    expect(SCREEN).not.toMatch(/\.band\b/);
  });

  it('unavailable evidence cannot become a favourable signal', () => {
    const denied = buildEnvironmentalView(interpretEnvironment({}, T0));
    expect(denied.state).toBe('insufficient');
    expect(denied.dominant).toBeNull();
    expect(denied.secondary).toHaveLength(0);
    expect(denied.showsCommand).toBe(false);
  });

  it('no observation age or policy version can be rendered', () => {
    expect(SCREEN).not.toMatch(/policyVersion|observedAt|minutes ago|updated/i);
  });
});

// ── 4b · back navigation (build 76 device finding) ─────────────────────────

describe('LAW 4b — the member can always get out of the Field', () => {
  // Scoped to the control's own body. Asserting `accessibilityRole="button"`
  // against the whole file passed even with the back control's props deleted,
  // because the resolution CTA carries the same props — the file-wide match
  // was proving the CTA's accessibility, not the back control's.
  const BACK_BODY = (() => {
    const i = SCREEN.indexOf('function BackControl');
    expect(i, 'BackControl is missing entirely').toBeGreaterThan(-1);
    const end = SCREEN.indexOf('\n}', i);
    const body = SCREEN.slice(i, end);
    // A prettier reflow or a stray top-level `}` could truncate this slice to
    // nothing, and every assertion below would then pass against an empty
    // string. Pin the span so the harness cannot quietly stop testing.
    expect(body.length, 'BackControl slice collapsed').toBeGreaterThan(200);
    expect(body).toContain('</Pressable>');
    return body;
  })();

  it('exposes EXACTLY ONE back control, and actually RENDERS it', () => {
    // A second exit would be a second thing to keep consistent, and on a
    // full-screen route with a hidden header it would also crowd the eyebrow.
    // Counting the RENDER SITES, not the testID literal: the testID lives
    // inside the component, so two `<BackControl />` usages would put two
    // buttons on screen while the literal still appeared exactly once.
    expect((SCREEN.match(/<BackControl\b/g) ?? [])).toHaveLength(1);
    expect((SCREEN.match(/function BackControl/g) ?? [])).toHaveLength(1);
    expect((SCREEN.match(/testID="environmental-back"/g) ?? [])).toHaveLength(1);

    // `onBack` is optional, so the render site alone proves nothing: deleting
    // `onBack={onBack}` from the routed default leaves the prop undefined, the
    // control renders as null, and the exact Build-76 defect returns with
    // every other law still green. The wiring IS the fix.
    expect(SCREEN).toMatch(/onBack=\{onBack\}/);
    expect(SCREEN).toMatch(/const onBack = React\.useCallback/);
  });

  it('uses navigation HISTORY, never a hard-coded destination', () => {
    // Environment may later be entered from Home or Moments, so sending it to
    // Profile would be wrong the moment a second entry point exists.
    // Asserted against CODE, not the file: a comment saying `router.back()`
    // satisfied the file-wide form of this law while the handler pushed a
    // fixed route.
    const HANDLER = SCREEN.slice(
      SCREEN.indexOf('const onBack = React.useCallback'),
      SCREEN.indexOf('const onRetry = React.useCallback'),
    );
    const CODE = HANDLER.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(CODE).toMatch(/if \(router\.canGoBack\(\)\) router\.back\(\);/);
    // No destination at all may be named in the happy path — not Profile, not
    // any other route. Only the empty-history fallback names one.
    expect(CODE).not.toMatch(/router\.push\(/);
    expect((CODE.match(/router\.replace\(/g) ?? [])).toHaveLength(1);
    expect(CODE).not.toMatch(/profile/i);
  });

  it('falls back to the repo’s established root, never leaving a member trapped', () => {
    // Reached by deep link with no history, `canGoBack()` is false. The
    // established guarded idiom — EdReturn, weekly-report, modules — is
    // replace('/'), not a dead button. (performance-signal shares the idiom
    // but falls back to its own /journal, so it is not a precedent for '/'.)
    // '/' is a real typed route
    // (app/index.tsx) that re-runs the root auth/onboarding gate, so it is
    // safe from any session state rather than merely non-crashing.
    const HANDLER = SCREEN.slice(
      SCREEN.indexOf('const onBack = React.useCallback'),
      SCREEN.indexOf('const onRetry = React.useCallback'),
    );
    const CODE = HANDLER.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(CODE).toMatch(/else router\.replace\('\/'\);/);
  });

  it('meets the accessible touch target — and APPLIES it', () => {
    // Both halves matter. The stylesheet entry alone proved nothing: the
    // control could carry a different style and the 44pt entry would sit
    // unused while this law stayed green.
    expect(SCREEN).toMatch(/back: \{\s*minWidth: 44,\s*minHeight: 44,/);
    expect(BACK_BODY).toContain('style={styles.back}');
    expect(BACK_BODY).toContain('hitSlop={12}');
  });

  it('is labelled and rolled for VoiceOver, from the existing i18n key', () => {
    expect(BACK_BODY).toContain('accessibilityRole="button"');
    expect(BACK_BODY).toMatch(/accessibilityLabel=\{label\}/);
    // `common.back` is the app-wide key every other back control already uses;
    // Environmental must not invent a second "Back" string to keep in sync.
    expect(SCREEN).toMatch(/label=\{t\('common\.back'\)\}/);
    const en = require('../../locales/en.json');
    expect(en.common.back).toBe('Back');
  });

  it('sits INSIDE the safe area, which the screen owns because it hides the header', () => {
    // headerShown:false means nothing else insets this screen. The control is
    // the first child of the scroll content, whose paddingTop is driven by the
    // live inset — so it cannot land under the notch or status bar.
    expect(SCREEN).toContain('headerShown: false');
    expect(SCREEN).toMatch(/paddingTop: insets\.top \+ \d+/);
    const CONTENT = SCREEN.slice(SCREEN.indexOf('showsVerticalScrollIndicator'));
    // First element in the content, above the eyebrow — the founder sanctioned
    // "above/beside", and above is what keeps the rail (see the next law).
    expect(CONTENT.indexOf('<BackControl')).toBeLessThan(CONTENT.indexOf('styles.eyebrow'));
  });

  it('does NOT move the approved Lane 3 composition off its rail', () => {
    // Measured on device: putting the eyebrow in a row beside the control
    // pushed ENVIRONMENT 42pt right of the 24pt content rail, so it no longer
    // lined up with AWARE, AIR and the line — the approved left alignment,
    // broken. The control stacks ABOVE instead, and the eyebrow stays exactly
    // the direct, unwrapped child it was on main.
    expect(SCREEN).toMatch(
      /<Text style=\{styles\.eyebrow\} accessibilityRole="header">\{t\('environment\.eyebrow'\)\}<\/Text>/,
    );
    expect(SCREEN).not.toContain('eyebrowRow');
    // And the control cannot stretch across the top swallowing taps, nor
    // re-indent itself away from the rail it was measured onto. Scoped to the
    // `back` style block: a file-wide match for alignSelf was satisfied by the
    // resolution CTA's own copy of it, so deleting the control's survived.
    const BACK_STYLE = SCREEN.slice(SCREEN.indexOf('  back: {'), SCREEN.indexOf('  eyebrow: {'));
    expect(BACK_STYLE.length, 'back style block not found').toBeGreaterThan(80);
    expect(BACK_STYLE).toMatch(/alignSelf: 'flex-start',/);
    expect(BACK_STYLE).toMatch(/marginLeft: -18,/);
  });

  it('LARGE TYPE cannot shrink the control', () => {
    // The box is fixed 44pt around a fixed-size Icon, and an Icon takes no
    // font scaling at all — so unlike every Text on this screen it cannot
    // reflow, wrap or clip. Assert both the fixed box and that nothing
    // font-scaled crept into it.
    expect(SCREEN).toMatch(/back: \{\s*minWidth: 44,\s*minHeight: 44,/);
    expect(BACK_BODY).toContain('<Icon name="chevron-left"');
    expect(BACK_BODY).not.toMatch(/<Text/);
    expect(BACK_BODY).not.toMatch(/fontSize|maxFontSizeMultiplier/);
  });

  it('adding it changed NO environmental behavior', () => {
    // The control is presentation-only: it reads no evidence, touches no flag,
    // and cannot reach interpretation or the command.
    for (const banned of ['view.', 'interpretEnvironment', 'command', 'flags', 'engine',
      'environmental_acquisition_enabled', 'requestLocationAccess', 'getLocationSnapshot']) {
      expect(BACK_BODY, banned).not.toContain(banned);
    }
    // And the handler is navigation only — it must not refetch, re-render the
    // read, or bump the acquisition nonce.
    const HANDLER = SCREEN.slice(
      SCREEN.indexOf('const onBack = React.useCallback'),
      SCREEN.indexOf('const onRetry = React.useCallback'),
    );
    expect(HANDLER).not.toContain('setNonce');
  });
});

// ── 5 · accessibility and motion ────────────────────────────────────────────

describe('LAW 5 — accessible and motion-safe by construction', () => {
  it('display text is capped for Dynamic Type rather than unbounded', () => {
    const caps = SCREEN.match(/maxFontSizeMultiplier=\{AF_MAX_DISPLAY_FONT_SCALE\}/g) ?? [];
    expect(caps.length).toBeGreaterThanOrEqual(5);
  });

  it('the screen scrolls, so large type cannot clip content', () => {
    expect(SCREEN).toContain('ScrollView');
  });

  it('every signal is its own labelled element for VoiceOver', () => {
    expect(SCREEN).toMatch(/accessibilityLabel=\{[\s\S]{0,120}r\.label/);
    expect(SCREEN).toMatch(/accessibilityLabel=\{`\$\{g\.label\}\. \$\{g\.reason\}`\}/);
  });

  it('the state is announced as text, not implied by colour', () => {
    expect(SCREEN).toContain('view.stateWord');
    expect(SCREEN).toContain("accessibilityRole=\"header\"");
  });

  it('the field carries no animation loop at all', () => {
    // The cheapest possible motion guarantee: there is nothing to disable,
    // so Reduce Motion is satisfied by construction and the screen costs no
    // continuous GPU work.
    for (const banned of ['useSharedValue', 'withRepeat', 'withTiming', 'Animated', 'requestAnimationFrame']) {
      expect(FIELD, banned).not.toContain(banned);
    }
  });
});
