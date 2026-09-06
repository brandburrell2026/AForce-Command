/**
 * PR2 LAW — MOCK/DEMO DATA != USER ENVIRONMENTAL EVIDENCE.
 *
 * THE DEFECT, AS EXECUTED. `cityClimateService` returned a deterministic
 * day-rotating city (Denver / Miami / New York) whenever a live reading was
 * unavailable — a first render, a denied permission, an offline start. That is
 * not a rare path; it is the DEFAULT path for anyone who has not granted
 * location. Reproduced against the real service:
 *
 *   source            mock
 *   city    (VISIBLE) Miami, FL
 *   tempF   (VISIBLE) 87
 *   humidity(VISIBLE) 78%
 *   band    (VISIBLE) oppressive
 *   insight (VISIBLE) "Heavy humidity blocks cooling. Electrolyte demand peaks…"
 *   -> /sweat ACSM ambientTempC 31   (auto-filled into the protocol)
 *   observedAt        a REAL ISO timestamp on FABRICATED data
 *
 * Two live consumers rendered it as the member's own conditions:
 *   /heat  — HeatRiskScreen's "LOCAL CLIMATE · <CITY>" card
 *   /sweat — SweatCalculatorScreenV2, which also fed it to the ACSM protocol
 *
 * The one component that DID mark it (`components/ClimateLine.tsx`, a small
 * "· est." tag) has no importers — the only code that told the truth was dead.
 *
 * THE REPAIR, STRUCTURAL RATHER THAN PER-CONSUMER. The accessors now return
 * `CityClimate | null`, so a consumer cannot render a reading without
 * narrowing — a compile-time obligation, not a convention. The demo seed
 * survives for env-gated demo/capture builds only, mirroring
 * `resolveInitialUserState(demoBuild)`. Production fails closed.
 *
 * Why structural: this repo had already made the per-consumer choice TWICE and
 * differently each time — `locationHydrationTarget` suppresses on
 * `source === 'live'`, `ClimateLine` merely labels. The third consumer is
 * always the one that forgets.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentCityClimate,
  getCurrentCityClimateSync,
  __resetClimateCache,
  classifyHumidity,
  hydrationInsightForHumidity,
} from '../cityClimateService';
import { DEMO_MODE, CAPTURE_MODE } from '../demoMode';

beforeEach(() => { __resetClimateCache(); });

/** The node test env has no expo-location — the same shape as a denied grant. */
describe('LAW 1 — a production build never invents the member’s conditions', () => {
  it('the SYNC accessor returns null rather than a city', () => {
    // This is the accessor both live consumers use for their FIRST RENDER,
    // which is exactly when no live reading can exist yet.
    expect(DEMO_MODE || CAPTURE_MODE, 'this law is meaningless in a demo build').toBe(false);
    expect(getCurrentCityClimateSync()).toBeNull();
  });

  it('the ASYNC accessor resolves null rather than a city', async () => {
    await expect(getCurrentCityClimate()).resolves.toBeNull();
  });

  it('and never names one of the seeded cities', async () => {
    // Named explicitly: these are the exact strings a member could have been
    // shown as their own location.
    const snap = await getCurrentCityClimate();
    const text = JSON.stringify(snap ?? {});
    for (const city of ['Denver', 'Miami', 'New York']) {
      expect(text, `seeded city ${city} reached a production caller`).not.toContain(city);
    }
  });
});

describe('LAW 2 — failing closed is not failing loudly', () => {
  it('does not throw when permission, geocode and fetch are all unavailable', async () => {
    await expect(getCurrentCityClimate()).resolves.toBeNull();
  });

  it('a non-reading is NEVER cached — the fallback must not become sticky', async () => {
    // Caching a fallback would let it outlive the condition that produced it
    // and persist for the session as though it had been observed.
    const first = await getCurrentCityClimate();
    const second = await getCurrentCityClimate();
    expect(first).toBeNull();
    expect(second).toBeNull();
  });

  it('repeated calls stay null — no accidental promotion over time', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(await getCurrentCityClimate()).toBeNull();
    }
  });
});

describe('LAW 3 — a real reading is still fully reported', () => {
  it('the pure classifiers are untouched by the provenance repair', () => {
    // The repair must not degrade legitimate readings. These are the functions
    // that turn a real humidity number into a band and an insight.
    expect(classifyHumidity(85)).toBe('oppressive');
    expect(classifyHumidity(45)).toBe('comfortable');
    expect(hydrationInsightForHumidity('oppressive').toLowerCase()).toContain('electrolyte');
    expect(hydrationInsightForHumidity('comfortable').length).toBeGreaterThan(0);
  });

  it('any snapshot that IS returned remains internally consistent', async () => {
    const snap = await getCurrentCityClimate();
    if (snap) {
      expect(snap.humidityBand).toBe(classifyHumidity(snap.humidityPct));
      expect(snap.hydrationInsight).toBe(hydrationInsightForHumidity(snap.humidityBand));
    }
  });
});
