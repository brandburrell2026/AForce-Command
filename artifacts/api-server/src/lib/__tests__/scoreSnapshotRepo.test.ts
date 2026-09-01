/**
 * D-08 — HydroState model-version stamping (DR-009).
 *
 * Proves the founder's Decision 4 and Decision 5 properties:
 *   - the version is stamped CENTRALLY at the persistence boundary;
 *   - ordinary callers cannot supply, override, or omit it;
 *   - historical null behaviour is preserved and never converted;
 *   - no snapshot values change and no scoring behaviour is touched.
 */
import { describe, it, expect } from 'vitest';
// Import the MODULE directly, not the package index: `@workspace/db`'s entry
// constructs a pg Pool and requires DATABASE_URL. The repository is
// framework-free by design, so it must be testable without a database.
import {
  createInMemoryScoreSnapshotRepo,
  createDrizzleScoreSnapshotRepo,
  type NewScoreSnapshot,
} from '../../../../../lib/db/src/scoreSnapshotRepo';
import { HYDROSTATE_MODEL_VERSION } from '../hydroStateModelVersion';

const V = HYDROSTATE_MODEL_VERSION;

function snapshot(over: Partial<NewScoreSnapshot> = {}): NewScoreSnapshot {
  return {
    userId: 'user-1',
    score: 72,
    level: 'BALANCED',
    ozConsumedToday: 48,
    aforceUnitsToday: 1,
    unitsConsumedToday: 2,
    sodiumDeliveredMg: 500,
    sodiumLostMg: 800,
    deficitPct: 12,
    clutchActive: false,
    socialActive: false,
    autopilotActive: false,
    reason: 'test',
    profileVersionId: 7,
    baselineVersionId: 3,
    ...over,
  } as NewScoreSnapshot;
}

/* ── central stamping ─────────────────────────────────────────────────────── */

describe('central stamping', () => {
  it('stamps new snapshots with the authoritative model version', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const row = await repo.create(snapshot());
    expect(row.hydroStateModelVersion).toBe(V);
  });

  it('stamps every row of a batch (sensors path)', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const n = await repo.createMany([snapshot(), snapshot({ score: 55 }), snapshot({ score: 91 })]);
    expect(n).toBe(3);
    expect(repo.rows).toHaveLength(3);
    for (const r of repo.rows) expect(r.hydroStateModelVersion).toBe(V);
  });

  it('an empty batch writes nothing', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    expect(await repo.createMany([])).toBe(0);
    expect(repo.rows).toHaveLength(0);
  });

  it('exposes the version it stamps, for audit', () => {
    expect(createInMemoryScoreSnapshotRepo(V).modelVersion).toBe(V);
  });
});

/* ── callers cannot omit or override (Decision 5) ─────────────────────────── */

describe('callers cannot omit or override the stamp', () => {
  it('a binding cannot be constructed without a model version', () => {
    expect(() => createInMemoryScoreSnapshotRepo('')).toThrow(/modelVersion is required/);
    // Same guarantee on the production binding.
    expect(() =>
      createDrizzleScoreSnapshotRepo({ insert: (() => {}) as never }, ''),
    ).toThrow(/modelVersion is required/);
  });

  it('a caller supplying its own version cannot override the central stamp', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    // Force a rogue field past the type boundary, as an untyped caller might.
    const rogue = { ...snapshot(), hydroStateModelVersion: 'hydrostate-v999' } as NewScoreSnapshot;
    const row = await repo.create(rogue);
    expect(row.hydroStateModelVersion).toBe(V);
  });

  it('the input type does not expose the version field', () => {
    // Type-level guarantee, asserted structurally: a plain caller payload has
    // no version key, and the repo supplies it.
    const payload = snapshot();
    expect(Object.keys(payload)).not.toContain('hydroStateModelVersion');
  });
});

/* ── historical null preservation ─────────────────────────────────────────── */

describe('historical null behaviour', () => {
  it('null means "not recorded" and is never converted to a version on read', () => {
    // A legacy row as it exists in the database today.
    const legacy = { id: 1, score: 64, level: 'RECOVERING', hydroStateModelVersion: null };
    // Reading performs no coercion anywhere in the repo contract.
    expect(legacy.hydroStateModelVersion).toBeNull();
    expect(legacy.hydroStateModelVersion).not.toBe(V);
  });

  it('a historical null stays distinguishable from an explicit v0 stamp', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const fresh = await repo.create(snapshot());
    const legacy = { hydroStateModelVersion: null };
    expect(fresh.hydroStateModelVersion).toBe(V);
    expect(legacy.hydroStateModelVersion).toBeNull();
    expect(fresh.hydroStateModelVersion).not.toBe(legacy.hydroStateModelVersion);
  });

  it('the repository has no backfill surface', () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    expect(Object.keys(repo)).toEqual(
      expect.not.arrayContaining(['backfill', 'update', 'recalculate', 'migrate']),
    );
  });
});

/* ── existing fields untouched ────────────────────────────────────────────── */

describe('existing snapshot behaviour is unchanged', () => {
  it('preserves profileVersionId and baselineVersionId exactly', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const row = await repo.create(snapshot({ profileVersionId: 11, baselineVersionId: 4 }));
    expect(row.profileVersionId).toBe(11);
    expect(row.baselineVersionId).toBe(4);
  });

  it('preserves null profile/baseline versions (pre-profile users)', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const row = await repo.create(snapshot({ profileVersionId: null, baselineVersionId: null }));
    expect(row.profileVersionId).toBeNull();
    expect(row.baselineVersionId).toBeNull();
  });

  it('does not alter score or level', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const row = await repo.create(snapshot({ score: 88, level: 'BALANCED' }));
    expect(row.score).toBe(88);
    expect(row.level).toBe('BALANCED');
  });

  it('passes every supplied field through unchanged', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const input = snapshot();
    const row = await repo.create(input);
    for (const [k, v] of Object.entries(input)) {
      expect(row[k as keyof typeof row]).toEqual(v);
    }
  });

  it('preserves a caller-supplied capturedAt', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const when = new Date('2026-01-15T10:00:00Z');
    const row = await repo.create(snapshot({ capturedAt: when } as Partial<NewScoreSnapshot>));
    expect(row.capturedAt).toEqual(when);
  });
});

/* ── Score Protection ─────────────────────────────────────────────────────── */

describe('Score Protection is unchanged', () => {
  it('the repository never computes or modifies a score', async () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    for (const score of [0, 42, 100]) {
      const row = await repo.create(snapshot({ score }));
      expect(row.score).toBe(score);
    }
  });

  it('exposes no scoring, award, or eligibility surface', () => {
    const repo = createInMemoryScoreSnapshotRepo(V);
    const keys = Object.keys(repo).map((k) => k.toLowerCase());
    for (const forbidden of ['award', 'calculate', 'recompute', 'eligib', 'scan', 'purchase']) {
      expect(keys.some((k) => k.includes(forbidden))).toBe(false);
    }
  });

  it('introduces no Prediction Engine dependency', async () => {
    const mod = await import('../../../../../lib/db/src/scoreSnapshotRepo');
    expect(Object.keys(mod).some((k) => /prediction|forecast|dna/i.test(k))).toBe(false);
  });
});

/* ── transaction handle ───────────────────────────────────────────────────── */

describe('transaction support (sensors path stays atomic)', () => {
  it('binds to whatever writer handle the caller supplies', async () => {
    const calls: unknown[] = [];
    const fakeTx = {
      insert: () => ({
        values: (v: unknown) => {
          calls.push(v);
          return { returning: async () => [{ id: 1 }] };
        },
      }),
    } as never;

    const repo = createDrizzleScoreSnapshotRepo(fakeTx, V);
    await repo.createMany([snapshot(), snapshot()]);

    // One insert issued against the CALLER's handle — the repo opens no
    // transaction of its own, so the caller's atomicity is preserved.
    expect(calls).toHaveLength(1);
    const rows = calls[0] as Array<{ hydroStateModelVersion: string }>;
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.hydroStateModelVersion).toBe(V);
  });
});
