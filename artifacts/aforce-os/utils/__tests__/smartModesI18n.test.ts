/**
 * Smart Modes localization contract.
 *
 * Guards the launch-locale lock for the home Smart Modes banner: the pure
 * engine carries only English fallback copy, so the visible label / chip /
 * guidance must be resolvable from i18n in every launch locale. Travel
 * intentionally reuses the shared Location Intelligence travel advisory key
 * (`locationIntel.protocol.travel_protocol`) rather than its own copy.
 *
 * Pure (reads locale JSON + the pure modes engine) — runs in node/vitest.
 */
import { describe, it, expect } from 'vitest';

import en from '../../locales/en.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import de from '../../locales/de.json';
import pt from '../../locales/pt.json';
import itLocale from '../../locales/it.json';
import { deriveActiveModes } from '../modes/smartModes';

const VISIBLE: Record<string, any> = { en, es, fr, de, pt, it: itLocale };
const ALL_MODES = ['heat', 'workout', 'travel', 'recovery'] as const;
const GUIDANCE_MODES = ['heat', 'workout', 'recovery'] as const; // travel reuses the shared key

describe('Smart Modes localization contract', () => {
  it('travel guidance resolves to the shared Location Intelligence travel key', () => {
    const travel = deriveActiveModes({
      heatIndexC: null,
      workoutMinutesToday: 0,
      hydrationScore: 100,
      goalProgress: 1,
      isTravelDay: true,
    }).active.find((m) => m.id === 'travel');
    expect(travel?.guidanceKey).toBe('locationIntel.protocol.travel_protocol');
  });

  it('every active mode carries label / short / guidance i18n keys', () => {
    const all = deriveActiveModes({
      heatIndexC: 40,
      workoutMinutesToday: 120,
      hydrationScore: 10,
      goalProgress: 0,
      isTravelDay: true,
    }).active;
    expect(all.map((m) => m.id)).toEqual(['heat', 'workout', 'travel', 'recovery']);
    for (const m of all) {
      expect(m.labelKey.length).toBeGreaterThan(0);
      expect(m.shortKey.length).toBeGreaterThan(0);
      expect(m.guidanceKey.length).toBeGreaterThan(0);
    }
  });

  it('every visible launch locale carries translated Smart Mode copy', () => {
    for (const [lng, res] of Object.entries(VISIBLE)) {
      // Travel advisory uses the shared, already-translated key.
      expect(typeof res.locationIntel?.protocol?.travel_protocol, lng).toBe('string');
      expect(res.locationIntel.protocol.travel_protocol.length, lng).toBeGreaterThan(0);
      for (const id of ALL_MODES) {
        expect(typeof res.smartModes?.[id]?.label, `${lng}.${id}.label`).toBe('string');
        expect(typeof res.smartModes?.[id]?.short, `${lng}.${id}.short`).toBe('string');
      }
      for (const id of GUIDANCE_MODES) {
        expect(typeof res.smartModes?.[id]?.guidance, `${lng}.${id}.guidance`).toBe('string');
      }
    }
  });

  it('non-English copy is really translated (travel advisory differs from English)', () => {
    const enTravel = en.locationIntel.protocol.travel_protocol;
    for (const lng of ['es', 'fr', 'de', 'pt', 'it']) {
      expect(VISIBLE[lng].locationIntel.protocol.travel_protocol, lng).not.toBe(enTravel);
    }
  });
});
