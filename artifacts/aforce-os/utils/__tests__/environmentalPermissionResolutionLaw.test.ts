/**
 * PERMISSION-RESOLUTION LAWS — the member must never be stranded, and must
 * never be surprised.
 *
 * Build 75's device smoke found the defect these close: with location never
 * requested, Environmental correctly refused to invent HEAT / UV / AIR and
 * said so — and then offered no way to change it. The truth was right and the
 * member had nowhere to go.
 *
 * The repair has to hold two things at once that pull against each other:
 *
 *   NEVER SURPRISE — opening the screen still requests nothing. The
 *   acquisition lane exists so no mount, timer or background tick can raise an
 *   OS dialog, and that guarantee survives this change completely.
 *
 *   NEVER STRAND — exactly one deliberate tap may open that door.
 *
 * Both are proven below, along with the rule that a provider outage must never
 * be dressed up as something the member did.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildEnvironmentalView,
  type EnvironmentalResolution,
} from '../environment/environmentalPresentation';
import { interpretEnvironment } from '../environment/environmentalInterpretation';
import {
  observe, unobserved,
  type EnvironmentalEvidence,
  type EnvironmentalSignal,
  type EnvironmentalUnit,
  type UnobservedReason,
} from '../environment/environmentalEvidence';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';
import en from '../../locales/en.json';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const SCREEN = read('screens/EnvironmentalScreen.tsx');
const PRODUCER = read('services/locationIntelligenceService.ts');
const HOOK = read('hooks/useEnvironmentalAcquisition.ts');
const CITY = read('services/cityClimateService.ts');
const DOOR = read('services/locationPermissionRequest.ts');

const T0 = Date.UTC(2026, 8, 7, 12, 0, 0);
const seen = (s: EnvironmentalSignal, v: number, u: EnvironmentalUnit) =>
  observe({ signal: s, value: v, unit: u, observedAt: T0, provenance: 'provider',
    source: 'open-meteo', locationPrecision: 'coarse' }, T0) as EnvironmentalEvidence<number>;

/** A read where every signal is unavailable for `reason`. */
const allUnavailable = (reason: UnobservedReason) => buildEnvironmentalView(
  interpretEnvironment({
    temperature: unobserved('temperature', reason) as EnvironmentalEvidence<number>,
    humidity: unobserved('humidity', reason) as EnvironmentalEvidence<number>,
    uvIndex: unobserved('uvIndex', reason) as EnvironmentalEvidence<number>,
    airQuality: unobserved('airQuality', reason) as EnvironmentalEvidence<number>,
  }, T0));

const resolutionOf = (reason: UnobservedReason): EnvironmentalResolution =>
  allUnavailable(reason).resolution;

// ── 1 · mounting the route requests nothing ─────────────────────────────────

describe('LAW 1 — opening /environment never requests permission', () => {
  it('the screen does not call the permission request itself', () => {
    // It may only invoke the producer's member-initiated door, and only from a
    // press handler. A direct request in this file could fire on render.
    expect(SCREEN).not.toContain('requestForegroundPermissionsAsync');
    expect(SCREEN).not.toContain("from 'expo-location'");
  });

  it('the request lives behind a press handler, never an effect', () => {
    // `requestLocationAccess` appears exactly twice: the import, and inside the
    // onPress callback. If it were ever added to a useEffect body the count
    // would rise and this fails.
    const uses = SCREEN.match(/requestLocationAccess/g) ?? [];
    expect(uses).toHaveLength(2);
    expect(SCREEN).toMatch(/const onEnableLocation = React\.useCallback/);
  });

  it('acquisition still only CHECKS — the background path cannot prompt', () => {
    // The Lane 2 guarantee, re-proven here because this lane adds a request
    // function to the same module and must not have widened the door.
    expect(PRODUCER).toContain('getForegroundPermissionsAsync');
    expect(HOOK).not.toContain('expo-location');
    expect(CITY).not.toContain('requestForegroundPermissionsAsync');
  });

  it('the request lives OUTSIDE the provider closure, structurally', () => {
    // The repo's own mount guard walks AppProvider's import graph and fails on
    // any `request*PermissionsAsync` inside it — its docblock is explicit that
    // moving the call one module away does NOT escape, because the provider
    // imports that module too. `locationIntelligenceService` IS in that
    // closure (the provider owns acquisition), so the request cannot live
    // there. It lives in its own module that only the screen imports, which
    // makes "the provider cannot prompt" a structural fact rather than an
    // annotation — and keeps that guard passing with no exception carved out.
    expect(PRODUCER).not.toContain('requestForegroundPermissionsAsync');
    const uses = DOOR.match(/requestForegroundPermissionsAsync/g) ?? [];
    expect(uses).toHaveLength(1);
    expect(DOOR).toContain('export async function requestLocationAccess');
  });
});

// ── 2-5 · the right action for the right cause ──────────────────────────────

describe('LAW 2 — never_requested offers exactly one enable-location action', () => {
  it('resolution is enable_location', () => {
    expect(resolutionOf('never_requested')).toBe('enable_location');
  });

  it('the screen renders ONE CTA, never a menu of them', () => {
    // `ResolutionAction` returns a single Pressable, so the count of possible
    // buttons is structurally one regardless of state.
    const ctas = SCREEN.match(/testID=\{`environmental-resolve-\$\{resolution\}`\}/g) ?? [];
    expect(ctas).toHaveLength(1);
  });

  it('and the state stays INSUFFICIENT — a CTA is not evidence', () => {
    const v = allUnavailable('never_requested');
    expect(v.state).toBe('insufficient');
    expect(v.dominant).toBeNull();
    expect(v.secondary).toHaveLength(0);
    expect(v.showsCommand).toBe(false);
  });
});

describe('LAW 4 — permission_denied never re-asks, and offers Settings', () => {
  it('resolution is open_settings', () => {
    expect(resolutionOf('permission_denied')).toBe('open_settings');
  });

  it('a REFUSAL outranks an unasked signal', () => {
    // Mixed state: one signal never asked, another explicitly denied. Offering
    // "Enable Location" would either do nothing (iOS will not re-prompt) or
    // nag the member about a decision they already made.
    const v = buildEnvironmentalView(interpretEnvironment({
      temperature: unobserved('temperature', 'never_requested') as EnvironmentalEvidence<number>,
      uvIndex: unobserved('uvIndex', 'permission_denied') as EnvironmentalEvidence<number>,
    }, T0));
    expect(v.resolution).toBe('open_settings');
  });

  it('the settings path is the OS one, not an in-app re-prompt', () => {
    expect(SCREEN).toContain('Linking.openSettings()');
    // And the denied branch is wired to it, not to the enable handler.
    expect(SCREEN).toMatch(/resolution === 'open_settings' \? \(\) => \{ void Linking\.openSettings\(\); \}/);
  });
});

describe('LAW 5 — a provider failure never offers Enable Location', () => {
  it('resolution is retry, not enable_location', () => {
    expect(resolutionOf('provider_unavailable')).toBe('retry');
    expect(resolutionOf('provider_unavailable')).not.toBe('enable_location');
  });

  it('its copy never implies the member did something', () => {
    const resolve = ((en as unknown as Record<string, Record<string, unknown>>)
      ['environment']!['resolve']) as Record<string, Record<string, string>>;
    const body = resolve['retry']!['body']!;
    expect(body).not.toMatch(/location|permission|settings|denied|allow/i);
  });

  it('retry reuses the existing producer — no second acquisition owner', () => {
    // `getLocationSnapshot(true)` is the producer's own force path. A new
    // fetcher here would be a second thing that acquires.
    expect(SCREEN).toMatch(/getLocationSnapshot\(true\)/);
    expect(SCREEN).not.toContain('open-meteo');
    expect(SCREEN).not.toContain('fetch(');
  });

  it('states with no useful member action offer nothing at all', () => {
    for (const reason of ['not_supported', 'demo_withheld'] as const) {
      expect(resolutionOf(reason), reason).toBe('none');
    }
  });
});

// ── 3 · the CTA is the only path ────────────────────────────────────────────

describe('LAW 3 — tapping the CTA is the ONLY path that requests location', () => {
  it('exactly one module can request, and one function within it', () => {
    // Repo-wide: only the producer's member-initiated door and onboarding's
    // own explicit opt-in may prompt. Nothing in the Environmental surface.
    for (const src of [SCREEN, HOOK, CITY, PRODUCER]) {
      expect(src).not.toContain('requestForegroundPermissionsAsync');
    }
    // Exactly one module, exactly one call.
    expect((DOOR.match(/requestForegroundPermissionsAsync/g) ?? [])).toHaveLength(1);
  });

  it('the CTA calls the producer, not expo-location directly', () => {
    expect(SCREEN).toMatch(/void requestLocationAccess\(\)/);
  });
});

// ── 6-7 · the CTA cannot become evidence or a command ───────────────────────

describe('LAW 6 — an unavailable state can never become favourable', () => {
  it('no resolution path changes the state, dominance or signals', () => {
    for (const reason of ['never_requested', 'permission_denied', 'provider_unavailable',
      'not_supported', 'demo_withheld'] as const) {
      const v = allUnavailable(reason);
      expect(v.state, reason).toBe('insufficient');
      expect(v.dominant, reason).toBeNull();
      expect(v.secondary, reason).toHaveLength(0);
      expect(v.showsCommand, reason).toBe(false);
    }
  });

  it('offering a CTA never implies conditions are fine', () => {
    const v = allUnavailable('never_requested');
    const clear = buildEnvironmentalView(interpretEnvironment({
      temperature: seen('temperature', 17, 'celsius'), humidity: seen('humidity', 45, 'percent'),
      uvIndex: seen('uvIndex', 2, 'uvIndex'), airQuality: seen('airQuality', 20, 'aqiUs') }, T0));
    expect(v.line).not.toBe(clear.line);
    expect(v.stateWord).not.toBe(clear.stateWord);
  });

  it('PARTIAL evidence keeps interpreting what it has, CTA or not', () => {
    // A missing signal must not blank the screen. UV 7 still governs.
    //
    // Temperature and humidity are supplied deliberately: omitting them would
    // create a `never_requested` heat gap, and enable-location would correctly
    // outrank the provider failure — proving the precedence rule rather than
    // the partial-evidence one. Isolating the outage is the point here.
    const v = buildEnvironmentalView(interpretEnvironment({
      temperature: seen('temperature', 17, 'celsius'),
      humidity: seen('humidity', 45, 'percent'),
      uvIndex: seen('uvIndex', 7, 'uvIndex'),
      airQuality: unobserved('airQuality', 'provider_unavailable') as EnvironmentalEvidence<number>,
    }, T0));
    expect(v.state).toBe('prepare');
    expect(v.dominant?.signal).toBe('uvIndex');
    expect(v.secondary.map((r) => r.signal)).toEqual(['heat']); // survivor kept
    expect(v.resolution).toBe('retry');
  });

  it('and fully observed evidence offers no resolution at all', () => {
    const v = buildEnvironmentalView(interpretEnvironment({
      temperature: seen('temperature', 17, 'celsius'), humidity: seen('humidity', 45, 'percent'),
      uvIndex: seen('uvIndex', 2, 'uvIndex'), airQuality: seen('airQuality', 20, 'aqiUs') }, T0));
    expect(v.resolution).toBe('none');
  });
});

describe('LAW 7 — the CTA cannot author or modify RecoveryCommand', () => {
  it('resolution is a separate field from the command gate', () => {
    const v = allUnavailable('never_requested');
    expect(v.resolution).toBe('enable_location');
    expect(v.showsCommand).toBe(false); // unaffected by having a CTA
  });

  it('the view model still has no field an action could occupy', () => {
    const FORBIDDEN = ['action', 'dose', 'doseOz', 'urgency', 'urgencyLevel',
      'command', 'score', 'recommendation', 'instruction'];
    const v = allUnavailable('never_requested');
    for (const banned of FORBIDDEN) expect(Object.keys(v)).not.toContain(banned);
  });

  it('resolution copy resolves OUR seeing, never the member’s hydration', () => {
    const resolve = ((en as unknown as Record<string, Record<string, unknown>>)
      ['environment']!['resolve']) as Record<string, Record<string, string>>;
    for (const [key, pair] of Object.entries(resolve)) {
      for (const [field, text] of Object.entries(pair)) {
        expect(text, `${key}.${field}`).not.toMatch(/\b(drink|hydrate|sip|water|oz|ml|electrolyte)\b/i);
      }
    }
  });
});

// ── 8-9 · flags ─────────────────────────────────────────────────────────────

describe('LAW 8/9 — flags stay independent and production stays off', () => {
  it('acquisition and presentation remain separate keys', () => {
    const surfaceOnly = { ...DEFAULT_FLAGS, environmental_surface_enabled: true };
    expect(surfaceOnly.environmental_acquisition_enabled).toBe(false);
    const acquireOnly = { ...DEFAULT_FLAGS, environmental_acquisition_enabled: true };
    expect(acquireOnly.environmental_surface_enabled).toBe(false);
  });

  it('production defaults remain OFF for both', () => {
    expect(DEFAULT_FLAGS.environmental_acquisition_enabled).toBe(false);
    expect(DEFAULT_FLAGS.environmental_surface_enabled).toBe(false);
  });

  it('internal cohort still has both', () => {
    expect(DEMO_ALL_ON_FLAGS.environmental_acquisition_enabled).toBe(true);
    expect(DEMO_ALL_ON_FLAGS.environmental_surface_enabled).toBe(true);
  });

  it('the CTA does not touch either flag', () => {
    // Granting OS permission must never silently flip an app feature flag.
    expect(SCREEN).not.toMatch(/environmental_acquisition_enabled\s*[:=]/);
    expect(PRODUCER).not.toContain('environmental_acquisition_enabled');
  });
});
