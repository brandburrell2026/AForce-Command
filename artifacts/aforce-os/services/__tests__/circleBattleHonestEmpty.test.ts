/**
 * Wave-4 — Circle + Battles may not invent a social position.
 *
 * Founder ruling: "Circle/Battles may NOT fabricate social position/rank/
 * friends. Real data or honest empty." Both services used to boot from the
 * MOCK_* seeds AND fall back to them in every catch, so a logged-out or
 * offline user saw seven invented friends (with scores, streaks and trends)
 * and three invented rivalries, rendered identically to server truth.
 *
 * Locked here:
 *   1. Cold start is EMPTY — nothing is shown before the server answers.
 *   2. A failed fetch stays EMPTY and reports `unavailable`, which is a
 *      different claim from an empty circle and must stay distinguishable.
 *   3. The failure emits, so a subscribed screen actually repaints into the
 *      unavailable state instead of sitting on a silent blank.
 *   4. The failure latch stops the retry storm that (3) would otherwise
 *      cause, and `retry*Hydration()` is the only way back out.
 *   5. Neither service imports the seeds any more, so refilling one cannot
 *      quietly restore the fallback.
 *
 * NOT in scope (standing founder ruling, PR #712): the ranked cohort in
 * `mocks/competitionData.ts` is sample data BY DESIGN until a /v1/competition
 * backend exists. Nothing here touches it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The api client is the network edge; per-suite mock is the repo convention
// (see realApi.intake.test.ts / recoveryCircle.test.ts). Stable fn identities
// via vi.hoisted so `vi.resetModules()` re-imports keep the same spies.
const api = vi.hoisted(() => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  putJson: vi.fn(),
  deleteJson: vi.fn(),
}));

vi.mock('@/services/aforceApiClient', () => ({
  getJsonAforceApi: api.getJson,
  postJsonAforceApi: api.postJson,
  putJsonAforceApi: api.putJson,
  deleteJsonAforceApi: api.deleteJson,
}));

const flush = () => new Promise((r) => { setTimeout(r, 0); });

/** Fresh module instance per test — the caches are module-level singletons. */
async function freshCircle() {
  vi.resetModules();
  return import('../circleService');
}

async function freshBattles() {
  vi.resetModules();
  return import('../battleService');
}

beforeEach(() => {
  api.getJson.mockReset();
  api.postJson.mockReset();
  api.deleteJson.mockReset();
});

describe('circleService — empty start, empty on failure', () => {
  it('shows nothing before the server answers, and says it is still loading', async () => {
    api.getJson.mockImplementation(() => new Promise(() => {})); // never settles
    const circle = await freshCircle();

    expect(circle.listCircle()).toEqual([]);
    expect(circle.getCircleFeed()).toEqual([]);
    expect(circle.listPending()).toEqual([]);
    expect(circle.listChallenges()).toEqual([]);
    expect(circle.listNotifications()).toEqual([]);
    expect(circle.getCircleLoadState()).toBe('loading');
  });

  it('stays empty and reports unavailable when the fetch fails', async () => {
    api.getJson.mockRejectedValue(new Error('offline'));
    const circle = await freshCircle();

    circle.listCircle();
    circle.listChallenges();
    circle.listNotifications();
    await flush();

    expect(circle.listCircle()).toEqual([]);
    expect(circle.getCircleFeed()).toEqual([]);
    expect(circle.listChallenges()).toEqual([]);
    expect(circle.listNotifications()).toEqual([]);
    expect(circle.getCircleLoadState()).toBe('unavailable');
  });

  it('emits on failure so a subscribed screen repaints into the unavailable state', async () => {
    api.getJson.mockRejectedValue(new Error('offline'));
    const circle = await freshCircle();

    let notified = 0;
    circle.subscribeCircle(() => { notified += 1; });
    circle.listCircle();
    await flush();

    expect(notified).toBeGreaterThan(0);
    expect(circle.getCircleLoadState()).toBe('unavailable');
  });

  it('does not re-fetch on every subsequent read once it has failed', async () => {
    api.getJson.mockRejectedValue(new Error('offline'));
    const circle = await freshCircle();

    // Touch every slice once so all three fetchers have had their turn.
    circle.listCircle();
    circle.listChallenges();
    circle.listNotifications();
    await flush();
    const afterFailure = api.getJson.mock.calls.length;

    circle.listCircle();
    circle.getCircleFeed();
    circle.listPending();
    circle.listChallenges();
    circle.listNotifications();
    await flush();

    expect(api.getJson.mock.calls.length).toBe(afterFailure);
  });

  it('retryCircleHydration re-arms the fetch', async () => {
    api.getJson.mockRejectedValue(new Error('offline'));
    const circle = await freshCircle();

    circle.listCircle();
    await flush();
    const afterFailure = api.getJson.mock.calls.length;

    circle.retryCircleHydration();
    circle.listCircle();
    await flush();

    expect(api.getJson.mock.calls.length).toBeGreaterThan(afterFailure);
  });

  it('populates from the server — and only from the server — on success', async () => {
    api.getJson.mockImplementation(async (path: string) => {
      switch (path) {
        case '/circle':
          return { users: [{
            userId: 'srv_1', name: 'Server Person', initials: 'SP',
            group: 'friends', status: 'active', joinedAt: '2026-08-01T00:00:00Z',
          }] };
        case '/circle/feed':
          return { feed: [{
            userId: 'srv_1', score: 70, state: 'Recovering', streakDays: 2,
            protocolComplete: false, trend: 'flat', updatedAt: '2026-08-12T00:00:00Z',
          }] };
        case '/circle/pending':
          return { users: [] };
        default:
          throw new Error(`unexpected path ${path}`);
      }
    });
    const circle = await freshCircle();

    circle.listCircle();
    await flush();

    expect(circle.getCircleLoadState()).toBe('ready');
    expect(circle.listCircle().map(u => u.userId)).toEqual(['srv_1']);
    expect(circle.getCircleFeed()).toHaveLength(1);
    // The seeded roster is gone: none of the old invented members survive.
    expect(circle.getUser('u_kai')).toBeUndefined();
    expect(circle.getSharedStatus('u_kai')).toBeUndefined();
  });

  it('getUser returns undefined for an unreachable circle (FriendDetailScreen’s guard input)', async () => {
    api.getJson.mockRejectedValue(new Error('offline'));
    const circle = await freshCircle();

    circle.listCircle();
    await flush();

    expect(circle.getUser('u_kai')).toBeUndefined();
    expect(circle.getSharedStatus('u_kai')).toBeUndefined();
  });

  it('__resetCircleStateForTests returns the caches to the cold-boot empty state', async () => {
    api.getJson.mockRejectedValue(new Error('offline'));
    const circle = await freshCircle();

    circle.listCircle();
    await flush();
    expect(circle.getCircleLoadState()).toBe('unavailable');

    circle.__resetCircleStateForTests();
    expect(circle.listCircle()).toEqual([]);
    expect(circle.getCircleLoadState()).toBe('loading');
  });
});

describe('battleService — empty start, empty on failure', () => {
  it('stays empty and reports unavailable when the fetch fails', async () => {
    api.getJson.mockRejectedValue(new Error('offline'));
    const battles = await freshBattles();

    battles.listBattles();
    await flush();

    expect(battles.listBattles()).toEqual([]);
    expect(battles.getBattle('b_mia_nyc')).toBeUndefined();
    expect(battles.getBattlesLoadState()).toBe('unavailable');
  });

  it('emits on failure and then stops re-fetching until retry', async () => {
    api.getJson.mockRejectedValue(new Error('offline'));
    const battles = await freshBattles();

    let notified = 0;
    battles.subscribeBattles(() => { notified += 1; });
    battles.listBattles();
    await flush();
    const afterFailure = api.getJson.mock.calls.length;

    battles.listBattles();
    battles.listBattles();
    await flush();
    expect(api.getJson.mock.calls.length).toBe(afterFailure);
    expect(notified).toBeGreaterThan(0);

    battles.retryBattlesHydration();
    battles.listBattles();
    await flush();
    expect(api.getJson.mock.calls.length).toBeGreaterThan(afterFailure);
  });

  it('populates from the server on success', async () => {
    api.getJson.mockResolvedValue({ battles: [{
      id: 'srv_b1',
      side1RegionId: 'city_miami_fl', side2RegionId: 'city_nyc_ny',
      side1Score: 60, side2Score: 61, hoursRemaining: 4, leader: 'side2', trend: 'flat',
    }] });
    const battles = await freshBattles();

    battles.listBattles();
    await flush();

    expect(battles.getBattlesLoadState()).toBe('ready');
    expect(battles.listBattles().map(b => b.id)).toEqual(['srv_b1']);
  });
});

describe('the seeds themselves', () => {
  it('the circle member/status/challenge/notification seeds are empty', async () => {
    const seeds = await import('@/data/mockCircleData');
    expect(seeds.MOCK_CIRCLE_USERS).toEqual([]);
    expect(seeds.MOCK_SHARED_STATUSES).toEqual({});
    expect(seeds.MOCK_CHALLENGES).toEqual([]);
    expect(seeds.MOCK_NOTIFICATIONS).toEqual([]);
  });

  it('REACTIONS and DEFAULT_PRIVACY remain — they are product definitions, not invented people', async () => {
    const seeds = await import('@/data/mockCircleData');
    expect(seeds.REACTIONS.length).toBeGreaterThan(0);
    // Founder ruling 2026-08-27 (community-sharing relocation): the default
    // share scope is PRIVATE — superseding the earlier 'circle' decision this
    // lock used to pin. Nothing is shared until the member widens it.
    expect(seeds.DEFAULT_PRIVACY.scope).toBe('private');
  });

  it('MOCK_BATTLES is empty (the region rosters are a separate surface and untouched)', async () => {
    const seeds = await import('@/data/mockTerritoryData');
    expect(seeds.MOCK_BATTLES).toEqual([]);
    expect(seeds.MOCK_CITIES.length).toBeGreaterThan(0);
  });
});

describe('the fallback cannot be restored by refilling a seed', () => {
  const ROOT = resolve(__dirname, '../..');
  const code = (rel: string) =>
    readFileSync(resolve(ROOT, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ');

  it('circleService no longer imports the member seeds', () => {
    const src = code('services/circleService.ts');
    expect(src).not.toMatch(/mockCircleData/);
    expect(src).not.toMatch(/MOCK_CIRCLE_USERS|MOCK_SHARED_STATUSES|MOCK_CHALLENGES|MOCK_NOTIFICATIONS/);
  });

  it('battleService no longer imports the battle seed', () => {
    const src = code('services/battleService.ts');
    expect(src).not.toMatch(/mockTerritoryData/);
    expect(src).not.toMatch(/MOCK_BATTLES/);
  });
});

describe('CirclesScreen renders the three states differently', () => {
  const SRC = readFileSync(
    resolve(__dirname, '../..', 'screens/CirclesScreen.tsx'),
    'utf8',
  );
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');

  it('reads the service load state rather than inferring truth from list length alone', () => {
    expect(CODE).toContain('getCircleLoadState');
    expect(CODE).toMatch(/loadState\s*===\s*'unavailable'/);
  });

  it('renders AFErrorState variant="unavailable" with a retry, not an empty state', () => {
    const block = CODE.slice(CODE.indexOf("loadState === 'unavailable'"));
    expect(block).toMatch(/<AFErrorState/);
    expect(block).toMatch(/variant="unavailable"/);
    expect(block).toContain('retryCircleHydration');
  });

  it('uses the shared AFEmptyState for a genuinely empty circle', () => {
    expect(CODE).toMatch(/<AFEmptyState/);
    expect(CODE).toContain("import { AFEmptyState, AFErrorState, AFSkeleton } from '@/components/ui';");
  });

  it('never claims "no members" while the circle is still loading', () => {
    const emptyIdx = CODE.indexOf('<AFEmptyState');
    const loadingIdx = CODE.indexOf("loadState === 'loading'");
    expect(loadingIdx).toBeGreaterThan(-1);
    expect(loadingIdx).toBeLessThan(emptyIdx);
  });
});
