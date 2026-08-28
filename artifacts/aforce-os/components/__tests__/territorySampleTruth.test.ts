/**
 * Territory sample-truth lock (PR-3, founder-authorized — the standing
 * sample-data-caption ruling, #712/Circle pattern).
 *
 * TerritoryScreen renders wholly illustrative standings (mockTerritoryData
 * via mapAggregationService) on a production-reachable route, and its entry
 * card on the competition tab claimed "Live ranking". The ruling: every
 * surface that presents sample standings must say so where the claim is
 * made. This pins (1) the screen-level disclosure, (2) the entry-card
 * disclosure, (3) honest entry-card copy in EVERY locale, and (4) that the
 * false "live" framing cannot quietly return.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const AOS_ROOT = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(AOS_ROOT, ...p), 'utf8');

describe('TerritoryScreen — the standings disclose themselves as sample', () => {
  const src = read('screens', 'TerritoryScreen.tsx');

  it('renders the canonical sample disclosure before any standing', () => {
    // Same string the Circle standings carry — one disclosure ruling,
    // one canonical copy.
    expect(src).toContain("t('community.v3.sample_note')");
    expect(src).toContain('testID="territory-sample-note"');
  });

  it('no longer frames itself as a live map', () => {
    expect(src.toLowerCase()).not.toContain('live competition map');
    expect(read('app', 'territory.tsx').toLowerCase()).not.toContain('live competition map');
  });
});

describe('competition map entry card — honest copy where the claim is made', () => {
  it('MapSection renders the card-level sample disclosure', () => {
    const src = read('components', 'community', 'CompetitionScreenV2.tsx');
    expect(src).toContain("t('community.v2.map_sample_note')");
    expect(src).toContain('testID="competition-map-sample-note"');
  });

  it('every locale carries the honest card copy — and the "Live ranking" claim is gone', () => {
    const locales = readdirSync(join(AOS_ROOT, 'locales')).filter((f) => f.endsWith('.json'));
    expect(locales.length).toBeGreaterThanOrEqual(11);
    for (const f of locales) {
      const raw = read('locales', f);
      const v2 = JSON.parse(raw).community?.v2;
      expect(v2?.map_sample_note, `${f} missing map_sample_note`).toBe(
        'Sample data · Illustrative standings · Not a live ranking',
      );
      expect(v2?.map_live_ranking, `${f} still claims a live ranking`).toBe('Sample standings');
    }
  });
});
