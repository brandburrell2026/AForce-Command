import { describe, it, expect } from 'vitest';
import type { CanonicalHealthRecord, ProvenanceHop } from '../contracts';
import {
  buildDeduplicationKey,
  dedupeRecords,
  originOf,
  isDirect,
  resolveNativeOrigin,
  selectPreferredSource,
  windowOverlapFraction,
  SOURCE_PRIORITY,
} from '../dedupe';

// ─── Deterministic fixtures (fixed clock; no Date.now()) ────────────────────
const NOW = Date.UTC(2026, 7, 3, 12, 0, 0);
const H = 3_600_000;

const direct = (provider: CanonicalHealthRecord['provider']): ProvenanceHop[] => [
  { provider, transport: 'measured' },
];
const viaAggregator = (
  origin: CanonicalHealthRecord['provider'],
  aggregator: CanonicalHealthRecord['provider'],
  nativeOrigin: string,
): ProvenanceHop[] => [
  { provider: origin, nativeOrigin, transport: 'measured' },
  { provider: aggregator, transport: 'aggregator_export' },
];

function sleepRecord(over: Partial<CanonicalHealthRecord> & { provider: CanonicalHealthRecord['provider'] }): CanonicalHealthRecord {
  const start = new Date(NOW - 10 * H).toISOString();
  const end = new Date(NOW - 2 * H).toISOString();
  const chain = over.provenanceChain ?? direct(over.provider);
  const rec: CanonicalHealthRecord = {
    schemaVersion: 1,
    userId: 'u1',
    metricType: 'sleep_session',
    value: { totalSleepHours: 7.5, inBedHours: 8.1, stages: null },
    startTime: start,
    endTime: end,
    observedAt: end,
    syncedAt: new Date(NOW).toISOString(),
    provenanceChain: chain,
    deduplicationKey: '',
    ...over,
  };
  rec.deduplicationKey = over.deduplicationKey ?? buildDeduplicationKey({
    userId: rec.userId, metricType: rec.metricType, origin: originOf(rec),
    externalId: rec.externalId, startTime: rec.startTime, endTime: rec.endTime, observedAt: rec.observedAt,
  });
  return rec;
}

const NO_DIRECT = new Set<CanonicalHealthRecord['provider']>();

// ─── Origin + identity ───────────────────────────────────────────────────────

describe('origin resolution + provenance', () => {
  it('maps HealthKit bundle ids and Health Connect packages to providers; unknown stays honest', () => {
    expect(resolveNativeOrigin('com.ouraring.oura')).toBe('oura');
    expect(resolveNativeOrigin('com.sec.android.app.shealth')).toBe('samsung_health');
    expect(resolveNativeOrigin('com.example.mystery')).toBe('unknown_device_app');
    expect(resolveNativeOrigin(undefined)).toBe('unknown_device_app');
  });

  it('origin = chain hop 0; direct = chain length ≤ 1', () => {
    const viaHK = sleepRecord({
      provider: 'apple_health',
      provenanceChain: viaAggregator('oura', 'apple_health', 'com.ouraring.oura'),
    });
    expect(originOf(viaHK)).toBe('oura');
    expect(isDirect(viaHK)).toBe(false);
    expect(isDirect(sleepRecord({ provider: 'oura' }))).toBe(true);
  });

  it('dedup key prefers provider-native external ids, falls back to time window', () => {
    const withId = buildDeduplicationKey({
      userId: 'u1', metricType: 'sleep_session', origin: 'oura', externalId: 'oura-abc', observedAt: 'x',
    });
    expect(withId).toBe('u1|sleep_session|oura|ext:oura-abc');
    const noId = buildDeduplicationKey({
      userId: 'u1', metricType: 'sleep_session', origin: 'oura',
      startTime: '2026-08-03T02:00:00Z', endTime: '2026-08-03T10:00:00Z', observedAt: 'x',
    });
    expect(noId).toBe('u1|sleep_session|oura|win:2026-08-03T02:00:00Z|2026-08-03T10:00:00Z');
  });
});

// ─── The four named double-count paths ───────────────────────────────────────

describe('named double-count paths — never silently double-counted', () => {
  const CASES: { name: string; origin: CanonicalHealthRecord['provider']; nativeId: string }[] = [
    { name: 'Oura direct + Oura via Apple Health', origin: 'oura', nativeId: 'com.ouraring.oura' },
    { name: 'Garmin direct + Garmin via Apple Health', origin: 'garmin', nativeId: 'com.garmin.connect.mobile' },
    { name: 'WHOOP direct + WHOOP exported to platform store', origin: 'whoop', nativeId: 'com.whoop.iphone' },
  ];

  for (const c of CASES) {
    it(`${c.name}: aggregator copy dropped when the direct connection is active — both input orders`, () => {
      const directRec = sleepRecord({ provider: c.origin, externalId: `${c.origin}-1` });
      const aggregatorCopy = sleepRecord({
        provider: 'apple_health',
        provenanceChain: viaAggregator(c.origin, 'apple_health', c.nativeId),
      });
      for (const batch of [[directRec, aggregatorCopy], [aggregatorCopy, directRec]]) {
        const res = dedupeRecords(batch, { activeDirectProviders: new Set([c.origin]) });
        expect(res.kept).toHaveLength(1);
        expect(res.kept[0].deduplicationKey).toBe(directRec.deduplicationKey);
        expect(res.dropped).toHaveLength(1);
        expect(res.dropped[0].reason).toBe('aggregator_copy_of_direct');
      }
    });
  }

  it('Samsung via Health Connect SURVIVES (no direct Samsung connection) with its chain intact — honest attribution, no false direct claim', () => {
    const viaHC = sleepRecord({
      provider: 'google_health',
      provenanceChain: viaAggregator('samsung_health', 'google_health', 'com.sec.android.app.shealth'),
    });
    const res = dedupeRecords([viaHC], { activeDirectProviders: NO_DIRECT });
    expect(res.kept).toHaveLength(1);
    expect(res.kept[0].provenanceChain).toHaveLength(2); // chain preserved
    expect(originOf(res.kept[0])).toBe('samsung_health');
  });

  it('disconnecting the direct provider makes the aggregator copy eligible again (no data hole)', () => {
    const aggregatorCopy = sleepRecord({
      provider: 'apple_health',
      provenanceChain: viaAggregator('oura', 'apple_health', 'com.ouraring.oura'),
    });
    const connected = dedupeRecords([aggregatorCopy], { activeDirectProviders: new Set(['oura']) });
    expect(connected.kept).toHaveLength(0);
    const disconnected = dedupeRecords([aggregatorCopy], { activeDirectProviders: NO_DIRECT });
    expect(disconnected.kept).toHaveLength(1);
  });
});

// ─── Retries, overlap, aggregates ────────────────────────────────────────────

describe('retry idempotency + overlapping sessions', () => {
  it('duplicate sync retries collapse on the dedup key (upsert, newest sync wins)', () => {
    const first = sleepRecord({ provider: 'whoop', externalId: 'w-1', syncedAt: new Date(NOW - H).toISOString() });
    const retry = sleepRecord({ provider: 'whoop', externalId: 'w-1', syncedAt: new Date(NOW).toISOString() });
    const res = dedupeRecords([first, retry], { activeDirectProviders: new Set(['whoop']) });
    expect(res.kept).toHaveLength(1);
    expect(res.kept[0].syncedAt).toBe(retry.syncedAt);
    expect(res.dropped[0].reason).toBe('retry_duplicate');
  });

  it('same-origin overlapping sleep windows (≥80%) collapse; value tolerance respected', () => {
    const a = sleepRecord({ provider: 'oura', startTime: new Date(NOW - 10 * H).toISOString(), endTime: new Date(NOW - 2 * H).toISOString() });
    // Same origin, 7/8 h overlap, value within 5%
    const b = sleepRecord({
      provider: 'oura',
      startTime: new Date(NOW - 9 * H).toISOString(),
      endTime: new Date(NOW - 1 * H).toISOString(),
      value: { totalSleepHours: 7.4, inBedHours: 8.0, stages: null },
    });
    const res = dedupeRecords([a, b], { activeDirectProviders: NO_DIRECT });
    expect(res.kept).toHaveLength(1);
    expect(res.dropped[0].reason).toBe('overlapping_same_origin');
  });

  it('cross-ORIGIN overlapping sleep is NEVER collapsed — two real wearables are real data; selection happens at read time', () => {
    const oura = sleepRecord({ provider: 'oura', externalId: 'o-1' });
    const whoop = sleepRecord({ provider: 'whoop', externalId: 'w-1' });
    const res = dedupeRecords([oura, whoop], { activeDirectProviders: new Set(['oura', 'whoop']) });
    expect(res.kept).toHaveLength(2);
  });

  it('non-overlapping same-origin sessions (nap + night) both survive', () => {
    const night = sleepRecord({ provider: 'oura', startTime: new Date(NOW - 12 * H).toISOString(), endTime: new Date(NOW - 5 * H).toISOString() });
    const nap = sleepRecord({ provider: 'oura', startTime: new Date(NOW - 2 * H).toISOString(), endTime: new Date(NOW - 1 * H).toISOString() });
    const res = dedupeRecords([night, nap], { activeDirectProviders: NO_DIRECT });
    expect(res.kept).toHaveLength(2);
  });

  it('windowOverlapFraction: fraction of the shorter window', () => {
    const a = sleepRecord({ provider: 'oura', startTime: new Date(0).toISOString(), endTime: new Date(8 * H).toISOString() });
    const b = sleepRecord({ provider: 'oura', startTime: new Date(4 * H).toISOString(), endTime: new Date(8 * H).toISOString() });
    expect(windowOverlapFraction(a, b)).toBe(1); // b fully inside a
  });
});

// ─── Cross-provider selection (documented per-family strategy) ───────────────

describe('selectPreferredSource — priority-then-freshness, NOT freshest-wins-everywhere', () => {
  const windows = { staleAfterMs: 24 * H, expireAfterMs: 72 * H };

  it('sleep prefers the dedicated wearable over the aggregator even when the aggregator is fresher', () => {
    const win = selectPreferredSource('sleep_session', [
      { origin: 'apple_health', fetchedAtMs: NOW - 1 * H },  // fresher aggregator
      { origin: 'whoop', fetchedAtMs: NOW - 10 * H },        // fresh-enough wearable
    ], NOW, windows);
    expect(win?.origin).toBe('whoop'); // freshest-wins would have said apple_health
  });

  it('a STALE ladder winner loses to a fresh lower-priority source (stale ≠ connected-live)', () => {
    const win = selectPreferredSource('sleep_session', [
      { origin: 'whoop', fetchedAtMs: NOW - 30 * H },        // stale
      { origin: 'apple_health', fetchedAtMs: NOW - 2 * H },  // fresh
    ], NOW, windows);
    expect(win?.origin).toBe('apple_health');
  });

  it('expired candidates are ineligible; all-stale falls back to ladder winner (honestly stale)', () => {
    expect(selectPreferredSource('sleep_session', [
      { origin: 'whoop', fetchedAtMs: NOW - 100 * H },
    ], NOW, windows)).toBeNull();
    const allStale = selectPreferredSource('sleep_session', [
      { origin: 'oura', fetchedAtMs: NOW - 30 * H },
      { origin: 'apple_health', fetchedAtMs: NOW - 40 * H },
    ], NOW, windows);
    expect(allStale?.origin).toBe('oura');
  });

  it('steps prefer the platform aggregator (internally deduped) — and are never summed across providers', () => {
    const win = selectPreferredSource('steps', [
      { origin: 'garmin', fetchedAtMs: NOW - 1 * H },
      { origin: 'apple_health', fetchedAtMs: NOW - 2 * H },
    ], NOW, windows);
    expect(win?.origin).toBe('apple_health');
  });

  it('provider scores are NEVER cross-selected (attributed only)', () => {
    expect(selectPreferredSource('provider_score', [
      { origin: 'whoop', fetchedAtMs: NOW },
      { origin: 'oura', fetchedAtMs: NOW },
    ], NOW, windows)).toBeNull();
    expect(SOURCE_PRIORITY.provider_score).toBeUndefined();
  });
});

describe('determinism', () => {
  it('same batch in reversed order produces identical survivors', () => {
    const batch = [
      sleepRecord({ provider: 'oura', externalId: 'o-1' }),
      sleepRecord({ provider: 'apple_health', provenanceChain: viaAggregator('oura', 'apple_health', 'com.ouraring.oura') }),
      sleepRecord({ provider: 'whoop', externalId: 'w-1' }),
    ];
    const opts = { activeDirectProviders: new Set<CanonicalHealthRecord['provider']>(['oura']) };
    const a = dedupeRecords(batch, opts).kept.map((r) => r.deduplicationKey);
    const b = dedupeRecords([...batch].reverse(), opts).kept.map((r) => r.deduplicationKey);
    expect(a).toEqual(b);
  });
});
