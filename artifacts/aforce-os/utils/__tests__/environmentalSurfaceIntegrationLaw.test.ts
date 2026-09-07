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
