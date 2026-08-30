/**
 * Stale / offline delivery truth — regression lock (founder Lane A,
 * 2026-08-30).
 *
 * THE DEFECT THIS PINS: `fetchHome` has been honest since Wave-3 PR10 — on an
 * unreachable server it returns the caller's own last state with the score
 * recomputed locally, `serverTime: null` and `stale: true`
 * (services/realApi.ts). It also RESOLVES rather than rejecting, so every
 * caller's catch block is dead for the offline case. Every call site then
 * destructured only `{ engineOutput, userState }` and threw the discriminator
 * away, so Home rendered last-known data with exactly the visual authority of
 * a server-fresh read — and the only "stale" copy on screen
 * ("Checked 3d ago — data is stale") measures a DIFFERENT axis entirely
 * (wearable recency, homeFreshness.ts), which a member could easily read as
 * coverage it does not provide.
 *
 * THE FIX THIS LOCKS is presentation/truth-state only:
 *  • every `fetchHome` call site consumes `stale`;
 *  • the provider owns one delivery-status flag (the `isHydrated` precedent —
 *    plain provider state, NOT reducer AppState, so no scoring, persistence,
 *    facade or fixture surface is touched);
 *  • both Home surfaces say the data may be out of date and stop presenting
 *    server-unconfirmed momentum.
 *
 * EXPLICITLY OUT OF SCOPE (asserted below so a later change cannot smuggle
 * them in under this lock): scoring, RecoveryCommand, provider fetch
 * behavior, cache behavior, freshness thresholds, recommendation logic.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import en from '../../locales/en.json';

const AOS = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(p, 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

const PROVIDER = () => stripComments(read(join(AOS, 'store', 'useAppStore.tsx')));
const ACTIONS = () => stripComments(read(join(AOS, 'store', 'app', 'actions.ts')));
const SLICES = () => stripComments(read(join(AOS, 'store', 'slices.tsx')));
const HOME_V2 = () => stripComments(read(join(AOS, 'components', 'home', 'HomeScreenV2.tsx')));
const HOME_ED = () =>
  stripComments(read(join(AOS, 'components', 'editorial', 'home', 'EditorialHomeScreen.tsx')));

const LOCALES = ['en', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'ko', 'pt', 'zh'] as const;

describe('the discriminator is consumed, not discarded', () => {
  it('every fetchHome call site reads `stale`', () => {
    const sites = [
      ...PROVIDER().matchAll(/const \{([^}]*)\} = await fetchHome\(/g),
    ].map((m) => m[1]!);
    expect(sites.length, 'expected the provider to await fetchHome').toBeGreaterThanOrEqual(2);
    for (const destructured of sites) {
      expect(destructured, 'a fetchHome await drops the stale flag').toMatch(/\bstale\b/);
    }
    // The two promise-form call sites in actions.ts (health-snapshot writes)
    // must report too — a snapshot written while the server is unreachable
    // lands a locally recomputed engineOutput just like the poll does.
    // Scoped to `fetchHome(...).then` specifically: `refreshWeather` has the
    // same swallow-and-echo shape but NO discriminator to consume, and
    // giving it one would be changing provider fetch behavior — explicitly
    // out of this lane's scope (flagged in the PR, not fixed here).
    const fetchHomeThens = [
      ...ACTIONS().matchAll(/fetchHome\([^)]*\)\s*\.then\(\(\{([^}]*)\}\)\s*=>/g),
    ].map((m) => m[1]!);
    expect(fetchHomeThens.length, 'expected both health-snapshot writers').toBeGreaterThanOrEqual(2);
    for (const destructured of fetchHomeThens) {
      expect(destructured, 'a fetchHome .then drops the stale flag').toMatch(/\bstale\b/);
    }
  });

  it('the provider owns the flag as plain provider state (the isHydrated precedent)', () => {
    const p = PROVIDER();
    expect(p).toMatch(/const \[lastRefreshStale, setLastRefreshStale\] = (React\.)?useState/);
    expect(p).toMatch(/markRefreshStale/);
    // NOT threaded through the reducer's AppState: no new action, no reducer
    // case, no facade field, no fixture churn.
    expect(p).not.toMatch(/type: 'SET_REFRESH_STALE'/);
    expect(stripComments(read(join(AOS, 'store', 'appStoreReducer.ts')))).not.toMatch(/stale/i);
    expect(stripComments(read(join(AOS, 'store', 'app', 'facadeState.ts')))).not.toMatch(/stale/i);
  });

  it('it reaches components through the bootstrap (delivery-status) slice', () => {
    const s = SLICES();
    expect(s).toMatch(/lastRefreshStale: boolean/);
    expect(PROVIDER()).toMatch(/lastRefreshStale=\{lastRefreshStale\}/);
  });
});

describe('both Home surfaces lower authority honestly', () => {
  for (const [name, src] of [
    ['HomeScreenV2', HOME_V2],
    ['EditorialHomeScreen', HOME_ED],
  ] as const) {
    it(`${name} says the data may be out of date`, () => {
      const s = src();
      expect(s).toMatch(/lastRefreshStale/);
      expect(s).toMatch(/home\.v2\.stale_notice/);
    });

    it(`${name} withholds server-unconfirmed momentum while stale`, () => {
      // The trend line implies live movement. On a stale payload the score is
      // a LOCAL recompute the server never confirmed, so the momentum claim
      // is withheld — the same withholding idiom Home already uses for a flat
      // trend and for the CRITICAL verb (founder §1). Asserted on the verb
      // expression itself, so the withholding cannot drift elsewhere.
      const expr = /const trendVerb =[\s\S]{0,260}?;/.exec(src())?.[0];
      expect(expr, 'no trendVerb expression found').toBeTruthy();
      expect(expr!, 'stale is not one of the withholding conditions').toMatch(/lastRefreshStale/);
    });
  }
});

describe('the copy is honest', () => {
  const notice = () => (en as Record<string, any>).home.v2.stale_notice as string;

  it('exists and states that the data may be out of date', () => {
    expect(typeof notice()).toBe('string');
    expect(notice().length).toBeGreaterThan(0);
    expect(notice().toLowerCase()).toMatch(/out of date|not current|last known/);
  });

  it('never claims OFFLINE — fetchHome cannot tell an unreachable server from a rejecting one', () => {
    expect(notice().toLowerCase()).not.toMatch(/offline|no connection|no internet|disconnected/);
  });

  it('promises no retry and stamps no time', () => {
    expect(notice().toLowerCase()).not.toMatch(/retry|retrying|reconnect|will update|updating/);
    expect(notice()).not.toMatch(/\{\{/); // no interpolated clock/count
  });

  it('ships in every locale (the home.v2.freshness placeholder convention)', () => {
    for (const loc of LOCALES) {
      const json = JSON.parse(read(join(AOS, 'locales', `${loc}.json`)));
      expect(json?.home?.v2?.stale_notice, `${loc}.json is missing the notice`).toBeTruthy();
    }
  });
});

describe('OUT OF SCOPE — this lane changed none of these', () => {
  it('the producer is untouched: fetch/cache behavior and the stale envelope are unchanged', () => {
    const api = read(join(AOS, 'services', 'realApi.ts'));
    expect(api).toContain('stale: true');
    expect(api).toContain('serverTime: null');
    // No new network call, no retry loop, no cache write introduced here.
    expect(stripComments(api)).not.toMatch(/setTimeout\([^)]*fetchHome/);
  });

  it('freshness thresholds are untouched', () => {
    const fresh = stripComments(read(join(AOS, 'components', 'home', 'homeFreshness.ts')));
    // The wearable-recency ladder keeps its own axis and its own thresholds.
    expect(fresh).toMatch(/JUST_NOW_THRESHOLD_MS/);
    expect(fresh).not.toMatch(/lastRefreshStale/);
  });

  it('scoring, command and recommendation logic are untouched by this lane', () => {
    for (const rel of [
      join('utils', 'scoringEngine.ts'),
      join('utils', 'intelligence', 'decisionGuard.ts'),
      join('services', 'momentRecommendation.ts'),
    ]) {
      expect(stripComments(read(join(AOS, rel))), `${rel} must not learn about staleness`)
        .not.toMatch(/lastRefreshStale|stale_notice/);
    }
  });
});
