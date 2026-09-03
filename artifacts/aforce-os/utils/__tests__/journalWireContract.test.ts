/**
 * JOURNAL WIRE CONTRACT — can the client and its fixtures represent what the
 * server actually sends?
 *
 * WHY THIS FILE EXISTS. Eight review rounds on the recap boundary work, and the
 * defect that survived the structural refactor was not a logic error the laws
 * failed to check — it was a shape the laws could not CONSTRUCT.
 * `JournalRollup.modelVersions` was typed `string[]` while the server builds it
 * from a `Set<string | null>` and emits it unfiltered, so every fixture helper
 * inherited the lie and a whole class of production state was inexpressible in
 * the test suite. It was not under-tested; it was untestable.
 *
 * So this file pins the CONTRACT rather than the behaviour: representative
 * payloads in exactly the shape `routes/aforce/journal.ts` constructs, proven
 * to survive into the client types with their meaningful distinctions intact.
 *
 * There is NO runtime validation on this path — `fetchJournalRollups` casts the
 * parsed JSON straight to `JournalRollup[]` — so the type IS the contract, and
 * an inaccurate type is indistinguishable from a broken one.
 */
import { describe, it, expect } from 'vitest';
import type { JournalRollup, JournalSnapshot } from '../../types';
import { provenanceOfVersions } from '../scoring/modelBoundary';

/* ── the server's own row shape, transcribed from the response mapping ─────── */

/**
 * Field-for-field what `journal.ts` returns for a rollup row. Written out in
 * full — not derived from `JournalRollup` — so that a divergence between the
 * two is a type error here rather than a silent mismatch in production.
 *
 * SENTINELS, from the mapping itself:
 *   avgScore / minScore / maxScore are `snapshotsCount > 0 ? real : 0`, so a
 *   ZERO on any of them is ambiguous: it means "no snapshot that day" whenever
 *   `snapshotsCount === 0`, and a genuine score of 0 otherwise. The pair must
 *   be read together; `avgScore` alone cannot distinguish them.
 */
interface ServerRollupRow {
  date: string;
  snapshotsCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  endOzConsumed: number;
  endAforceUnits: number;
  endUnitsConsumed: number;
  endSodiumDelivered: number;
  endSodiumLost: number;
  endDeficitPct: number;
  pctTimePeak: number;
  pctTimeBalanced: number;
  pctTimeRecovering: number;
  pctTimeDepleted: number;
  intakeCount: number;
  autopilotSessions: number;
  socialSessions: number;
  /** `[...Set<string | null>]` — NULL IS A LEGITIMATE ENTRY. */
  modelVersions: (string | null)[];
}

const V0 = 'hydrostate-v0';
const V1 = 'hydrostate-v1.0';
const V11 = 'hydrostate-v1.1';

/** A fully-populated server row; overrides express the state under test. */
function serverRollup(over: Partial<ServerRollupRow> = {}): ServerRollupRow {
  return {
    date: '2026-08-01',
    snapshotsCount: 4,
    avgScore: 80, minScore: 74, maxScore: 88,
    endOzConsumed: 64, endAforceUnits: 2, endUnitsConsumed: 5,
    endSodiumDelivered: 900, endSodiumLost: 400, endDeficitPct: 12,
    pctTimePeak: 10, pctTimeBalanced: 70, pctTimeRecovering: 15, pctTimeDepleted: 5,
    intakeCount: 4, autopilotSessions: 0, socialSessions: 0,
    modelVersions: [V1],
    ...over,
  };
}

/* ── the canonical valid-state matrix ─────────────────────────────────────── */

type StateKind = 'unrecorded' | 'known' | 'incompatible' | 'valid-zero' | 'no-snapshot';

interface CanonicalState {
  label: string;
  row: ServerRollupRow;
  /** What the provenance classification must say, where applicable. */
  provenance?: 'known' | 'unrecorded' | 'incompatible';
  kind: StateKind;
}

const CANONICAL: CanonicalState[] = [
  { label: 'all unstamped (pre-column history)',
    row: serverRollup({ modelVersions: [] }), provenance: 'unrecorded', kind: 'unrecorded' },
  { label: 'explicit [null] entry',
    row: serverRollup({ modelVersions: [null] }), provenance: 'unrecorded', kind: 'unrecorded' },
  { label: 'multiple nulls collapse to one unrecorded day',
    row: serverRollup({ modelVersions: [null, null] }), provenance: 'unrecorded', kind: 'unrecorded' },
  { label: 'one known version',
    row: serverRollup({ modelVersions: [V1] }), provenance: 'known', kind: 'known' },
  { label: 'duplicate same version',
    row: serverRollup({ modelVersions: [V1, V1] }), provenance: 'known', kind: 'known' },
  { label: 'same-major versions (comparable)',
    row: serverRollup({ modelVersions: [V1, V11] }), provenance: 'known', kind: 'known' },
  { label: 'incompatible known versions (deploy day)',
    row: serverRollup({ modelVersions: [V0, V1] }), provenance: 'incompatible', kind: 'incompatible' },
  { label: 'known + null (column-deploy day)',
    row: serverRollup({ modelVersions: [null, V1] }), provenance: 'incompatible', kind: 'incompatible' },
  { label: 'mixed transition day, three entries',
    row: serverRollup({ modelVersions: [null, V0, V1] }), provenance: 'incompatible', kind: 'incompatible' },
  // ── score / snapshot sentinels, which are NOT about versions ──
  { label: 'NO SNAPSHOT — scores are sentinel zeros',
    row: serverRollup({ snapshotsCount: 0, avgScore: 0, minScore: 0, maxScore: 0,
      pctTimePeak: 0, pctTimeBalanced: 0, pctTimeRecovering: 0, pctTimeDepleted: 0,
      modelVersions: [] }), kind: 'no-snapshot' },
  { label: 'INTAKE WITHOUT SNAPSHOT — real activity, sentinel score',
    row: serverRollup({ snapshotsCount: 0, avgScore: 0, minScore: 0, maxScore: 0,
      intakeCount: 3, endOzConsumed: 36, modelVersions: [] }), kind: 'no-snapshot' },
  { label: 'VALID ZERO — a real measured score of 0',
    row: serverRollup({ snapshotsCount: 4, avgScore: 0, minScore: 0, maxScore: 0,
      modelVersions: [V1] }), kind: 'valid-zero' },
];

describe('WIRE CONTRACT — every production shape is representable', () => {
  it('every canonical server row is assignable to the client type', () => {
    // Compile-time: if `JournalRollup` cannot express a shape the server emits,
    // this stops building. That is the guarantee the old `string[]` broke.
    const asClient: JournalRollup[] = CANONICAL.map((c) => c.row);
    expect(asClient.length).toBe(CANONICAL.length);
  });

  it('the matrix actually covers every distinct state (anti-vacuity)', () => {
    const kinds = new Set(CANONICAL.map((c) => c.kind));
    expect(kinds).toEqual(new Set([
      'unrecorded', 'known', 'incompatible', 'valid-zero', 'no-snapshot',
    ]));
    const provenances = new Set(CANONICAL.filter((c) => c.provenance).map((c) => c.provenance));
    expect(provenances).toEqual(new Set(['known', 'unrecorded', 'incompatible']));
  });

  for (const c of CANONICAL.filter((x) => x.provenance)) {
    it(`${c.label} → provenance '${c.provenance}'`, () => {
      expect(provenanceOfVersions(c.row.modelVersions).kind).toBe(c.provenance);
    });
  }
});

describe('WIRE CONTRACT — sentinels stay distinguishable', () => {
  it('UNKNOWN ≠ ZERO: a sentinel zero and a measured zero are separable', () => {
    const noSnapshot = CANONICAL.find((c) => c.kind === 'no-snapshot')!.row;
    const measuredZero = CANONICAL.find((c) => c.kind === 'valid-zero')!.row;
    // Both carry avgScore 0 — the score ALONE cannot tell them apart...
    expect(noSnapshot.avgScore).toBe(0);
    expect(measuredZero.avgScore).toBe(0);
    // ...and `snapshotsCount` is the only field that can.
    expect(noSnapshot.snapshotsCount).toBe(0);
    expect(measuredZero.snapshotsCount).toBeGreaterThan(0);
    // Any consumer reading avgScore without snapshotsCount is reading a
    // sentinel as a measurement.
  });

  it('UNKNOWN ≠ INCOMPATIBLE: absence and disagreement are separable', () => {
    expect(provenanceOfVersions([]).kind).toBe('unrecorded');
    expect(provenanceOfVersions([null]).kind).toBe('unrecorded');
    expect(provenanceOfVersions([null, null]).kind).toBe('unrecorded');
    expect(provenanceOfVersions([V0, V1]).kind).toBe('incompatible');
    expect(provenanceOfVersions([null, V1]).kind).toBe('incompatible');
  });

  it('activity survives a missing snapshot — intake is not erased by it', () => {
    const row = CANONICAL.find((c) => c.label.startsWith('INTAKE WITHOUT'))!.row;
    expect(row.intakeCount).toBeGreaterThan(0);
    expect(row.endOzConsumed).toBeGreaterThan(0);
    expect(row.snapshotsCount).toBe(0);
  });

  it('an empty modelVersions array is UNRECORDED, never an empty transition', () => {
    expect(provenanceOfVersions([]).recordedVersions).toEqual([]);
    expect(provenanceOfVersions([]).scoreableVersion).toBeNull();
  });
});

/* ── snapshot side ────────────────────────────────────────────────────────── */

interface ServerSnapshotEntry {
  type: 'snapshot';
  at: string;
  score: number;
  level: 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';
  ozConsumedToday: number;
  aforceUnitsToday: number;
  unitsConsumedToday: number;
  sodiumDeliveredMg: number;
  sodiumLostMg: number;
  deficitPct: number;
  clutchActive: boolean;
  socialActive: boolean;
  autopilotActive: boolean;
  reason: string;
  /** `s.hydroStateModelVersion` — nullable column, no backfill. */
  modelVersion: string | null;
}

describe('WIRE CONTRACT — snapshot entries', () => {
  const entry = (over: Partial<ServerSnapshotEntry> = {}): ServerSnapshotEntry => ({
    type: 'snapshot', at: '2026-08-01T09:00:00.000Z', score: 80, level: 'BALANCED',
    ozConsumedToday: 64, aforceUnitsToday: 2, unitsConsumedToday: 5,
    sodiumDeliveredMg: 900, sodiumLostMg: 400, deficitPct: 12,
    clutchActive: false, socialActive: false, autopilotActive: false,
    reason: 'poll', modelVersion: V1, ...over,
  });

  it('a NULL modelVersion is representable and preserved', () => {
    const rows: JournalSnapshot[] = [
      entry({ modelVersion: null }),   // pre-column history
      entry({ modelVersion: V0 }),
      entry({ modelVersion: V1 }),
    ];
    expect(rows[0]!.modelVersion).toBeNull();
    expect(rows.map((r) => r.modelVersion)).toEqual([null, V0, V1]);
  });

  it('a measured score of 0 is representable and is NOT a sentinel here', () => {
    // Unlike the rollup, a snapshot row is only written when a score exists,
    // so 0 on a snapshot is a real measurement.
    const zero: JournalSnapshot = entry({ score: 0, level: 'DEPLETED' });
    expect(zero.score).toBe(0);
    expect(zero.level).toBe('DEPLETED');
  });
});

/* ── historyStartAt — the additive field the Journal share seam depends on ── */

/**
 * WHY THIS BLOCK EXISTS. `fetchJournalRollupsWithHistory` (realApi.ts)
 * declared its own inline response type, disconnected from the server's
 * actual `res.json({ rollups, days, historyStartAt })` shape — the exact
 * defect class this whole file exists to catch, just not yet extended to the
 * one field this branch (PR A, Option B) added to the wire. A silent
 * key-name mismatch here would make `historyStartAt` permanently `null` for
 * every member — wire-indistinguishable from the legitimate "row seeded
 * before the column existed" state — and would silently collapse every
 * member onto the conservative epoch floor forever, with the entire suite
 * still green (verified: swapping the field to `history_start_at` on both
 * sides of `parseJournalRollupsWithHistory` compiled clean and passed every
 * existing law before this block was added).
 */
import { parseJournalRollupsWithHistory, type JournalRollupsWireResponse } from '../../services/realApi';

describe('WIRE CONTRACT — historyStartAt round-trips through the real parser', () => {
  /** The server's literal top-level response, transcribed independently from
   *  journal.ts's `res.json({ rollups, days, historyStartAt })` — not derived
   *  from the client's request/response types. */
  const serverResponse = (historyStartAt: string | null): JournalRollupsWireResponse => ({
    rollups: [serverRollup()],
    days: 7,
    historyStartAt,
  });

  it('a stamped member: the ISO string survives, unaltered', () => {
    const iso = '2026-08-22T00:00:00.000Z';
    const { historyStartAt } = parseJournalRollupsWithHistory(serverResponse(iso));
    expect(historyStartAt).toBe(iso);
  });

  it('an unstamped legacy member: null survives as null, never a fallback value', () => {
    const { historyStartAt } = parseJournalRollupsWithHistory(serverResponse(null));
    expect(historyStartAt).toBeNull();
  });

  it('the field is OPTIONAL on the wire (an older server that omits it entirely)', () => {
    // The additive-field guarantee: a response with no `historyStartAt` key at
    // all (not even `null`) must parse identically to one that sends `null`.
    const { rollups, days, ...withoutField } = serverResponse(null);
    void days;
    const { historyStartAt } = parseJournalRollupsWithHistory({ rollups, ...withoutField } as JournalRollupsWireResponse);
    expect(historyStartAt).toBeNull();
  });

  it('the rollups array survives untouched alongside the new field', () => {
    const { rollups } = parseJournalRollupsWithHistory(serverResponse('2026-08-22T00:00:00.000Z'));
    expect(rollups).toHaveLength(1);
    expect(rollups[0]!.date).toBe('2026-08-01');
  });

  it('mutation-verify: a key-name mismatch between server and client is caught', () => {
    // Simulates the exact drift this block exists to prevent: the server
    // field renamed (or the client reading the wrong key) with NOTHING else
    // changed. `as any` is required to construct the wire-wrong shape at
    // all — TypeScript itself refuses a same-file rename, which is the
    // compile-time half of this guarantee; this is the runtime half.
    const wireWrong = { rollups: [serverRollup()], days: 7, history_start_at: '2026-08-22T00:00:00.000Z' } as any;
    const { historyStartAt } = parseJournalRollupsWithHistory(wireWrong);
    expect(historyStartAt, 'a mismatched key must not silently read as the epoch fallback').toBeNull();
  });
});
