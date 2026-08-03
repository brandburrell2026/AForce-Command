import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  runAppleHealthSync,
  createEmptyAppleHealthAnchorState,
  AppleHealthKitAuthorizationRevokedError,
  APPLE_HEALTH_ANCHOR_SCHEMA_VERSION,
  ALL_APPLE_HEALTH_SAMPLE_TYPES,
  SAMPLE_TYPE_TO_METRIC_TYPE,
  type HealthKitQueryClient,
  type AppleHealthAuthorizationStatus,
  type AppleHealthAnchoredQueryPage,
  type AppleHealthSampleType,
  type AppleHealthAnchorState,
  type AppleHealthAnchorToken,
} from '../appleHealthSync';
import type { HKQuantitySample } from '../appleHealthRecords';

// ─── Controllable mapping failure (map-failure / ATOMIC-COMMIT tests) ────────
// `appleHealthRecords.ts` is off-limits, consume-only code (see
// appleHealthSync.ts's file header) — this suite never edits it. To exercise
// the "mapping throws after samples were already fetched" path honestly, this
// mock wraps the REAL `mapStepsSamples` and only injects a throw when a test
// explicitly arms `stepsMapShouldFail`, delegating to the real implementation
// otherwise. `stepsMapShouldFail` is reset after every test so failures never
// leak across cases.
let stepsMapShouldFail = false;

vi.mock('../appleHealthRecords', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../appleHealthRecords')>();
  return {
    ...actual,
    mapStepsSamples: (...args: Parameters<typeof actual.mapStepsSamples>) => {
      if (stepsMapShouldFail) {
        // Deliberately generic — proves the engine's own diagnostic message
        // (not this thrown text) is what callers see. See the map-failure
        // tests' assertion that `message` never contains this raw text.
        throw new Error('mapper internal invariant violated');
      }
      return actual.mapStepsSamples(...args);
    },
  };
});

afterEach(() => {
  stepsMapShouldFail = false;
});

const USER_ID = 'user_lane_a2';
const SYNCED_AT = '2026-08-03T09:00:00.000Z';
const NOW_MS = 1_785_830_400_000;

// ─── Test double: a fully scriptable HealthKitQueryClient ────────────────────

interface ScriptedPages {
  auth?: AppleHealthAuthorizationStatus | Error;
  /** One entry consumed per call to queryAnchored for this type, in order. */
  pages?: Array<AppleHealthAnchoredQueryPage<unknown> | Error>;
}

function makeClient(script: Partial<Record<AppleHealthSampleType, ScriptedPages>>): {
  client: HealthKitQueryClient;
  calls: { auth: AppleHealthSampleType[]; query: Array<{ type: AppleHealthSampleType; anchor: AppleHealthAnchorToken | null }> };
} {
  const calls = {
    auth: [] as AppleHealthSampleType[],
    query: [] as Array<{ type: AppleHealthSampleType; anchor: AppleHealthAnchorToken | null }>,
  };
  const cursors: Partial<Record<AppleHealthSampleType, number>> = {};

  const client: HealthKitQueryClient = {
    async getAuthorizationStatus(type) {
      calls.auth.push(type);
      const entry = script[type];
      const auth = entry?.auth ?? 'notDetermined';
      if (auth instanceof Error) throw auth;
      return auth;
    },
    async queryAnchored(type, anchor, _limit) {
      calls.query.push({ type, anchor });
      const entry = script[type];
      const idx = cursors[type] ?? 0;
      cursors[type] = idx + 1;
      const pages = entry?.pages ?? [];
      const page = pages[idx];
      if (!page) {
        // Script exhausted — return a harmless terminal empty page rather
        // than throwing, so an under-specified script fails the assertion
        // it was meant to check, not with an unrelated crash.
        return { samples: [], newAnchor: anchor, done: true };
      }
      if (page instanceof Error) throw page;
      return page as AppleHealthAnchoredQueryPage<any>;
    },
  };

  return { client, calls };
}

function quantitySample(quantity: number, iso: string, bundleIdentifier = 'com.apple.health'): HKQuantitySample {
  return {
    quantity,
    startDate: iso,
    endDate: iso,
    uuid: `sample-${iso}-${quantity}`,
    sourceRevision: { source: { bundleIdentifier } },
  };
}

function anchorState(anchors: Partial<Record<AppleHealthSampleType, AppleHealthAnchorToken | null>>): AppleHealthAnchorState {
  return { version: APPLE_HEALTH_ANCHOR_SCHEMA_VERSION, anchors };
}

// ─── Purity / isolation: this module must never be reachable while runtime activation is OFF ─

describe('module purity (flag/activation OFF => never invoked, no request path)', () => {
  const rawSource = readFileSync(join(__dirname, '..', 'appleHealthSync.ts'), 'utf8');
  // Strip comments before scanning: the file's own doc comments legitimately
  // NAME `@kingstinct`, `react-native`, and `Date.now()` while explaining why
  // this module avoids them — those mentions are documentation, not imports
  // or calls. Scanning only the code (comments removed) is what actually
  // proves the purity claim instead of tripping on the prose that documents it.
  const code = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('imports no feature-flag or store module', () => {
    expect(code).not.toMatch(/featureFlags/);
    expect(code).not.toMatch(/DEFAULT_FLAGS/);
    expect(code).not.toMatch(/zustand/);
    expect(code).not.toMatch(/from ['"]\.\.\/\.\.\/store/);
  });

  it('imports no native module and no React Native', () => {
    expect(code).not.toMatch(/@kingstinct/);
    expect(code).not.toMatch(/react-native/);
  });

  it('never calls Date.now() (deterministic / clockless)', () => {
    expect(code).not.toMatch(/Date\.now\(\)/);
  });

  it('HealthKitQueryClient exposes no request/write method — only read-only methods are invoked at runtime', async () => {
    const requestAuthorization = vi.fn();
    const { client } = makeClient({
      steps: { auth: 'authorized', pages: [{ samples: [], newAnchor: 'a1', done: true }] },
    });
    // Attach an extra method a careless real implementation might add —
    // prove the engine never reaches for it under any circumstance.
    (client as unknown as { requestAuthorization: () => void }).requestAuthorization = requestAuthorization;

    await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(requestAuthorization).not.toHaveBeenCalled();
  });
});

// ─── Unavailable native module ────────────────────────────────────────────────

describe('native module unavailable (client: null)', () => {
  it('returns a clean empty shape: no records, every requested type unavailable, anchors untouched', async () => {
    const inputAnchors = anchorState({ steps: 'anchor-steps-123', hrvSdnn: null });
    const result = await runAppleHealthSync({
      client: null,
      userId: USER_ID,
      types: ['steps', 'hrvSdnn'],
      anchors: inputAnchors,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.steps).toEqual({ status: 'unavailable' });
    expect(result.authorization.hrvSdnn).toEqual({ status: 'unavailable' });
    expect(result.partial).toBe(true);
    expect(result.nextAnchors.anchors.steps).toBe('anchor-steps-123');
    expect(result.nextAnchors.anchors.hrvSdnn).toBeNull();
    expect(result.syncRunStartedAtMs).toBe(NOW_MS);
  });
});

// ─── Partial permissions ──────────────────────────────────────────────────────

describe('partial permissions', () => {
  it('granted types sync fully; denied/undetermined types are reported not-synced honestly, with untouched anchors', async () => {
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          {
            samples: [quantitySample(100, '2026-08-02T10:00:00.000Z'), quantitySample(200, '2026-08-02T11:00:00.000Z')],
            newAnchor: 'steps-anchor-1',
            done: true,
          },
        ],
      },
      hrvSdnn: { auth: 'denied' },
      restingHeartRate: { auth: 'notDetermined' },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps', 'hrvSdnn', 'restingHeartRate'],
      anchors: anchorState({ hrvSdnn: 'hrv-anchor-old' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toHaveLength(2);
    expect(result.records.every((r) => r.metricType === 'steps')).toBe(true);

    expect(result.authorization.steps).toEqual({ status: 'synced' });
    expect(result.authorization.hrvSdnn).toEqual({ status: 'not_authorized' });
    expect(result.authorization.restingHeartRate).toEqual({ status: 'not_authorized' });

    // Denied/undetermined types never had a query issued, so their anchors
    // pass through exactly as given (old anchor preserved; absent stays null).
    expect(result.nextAnchors.anchors.hrvSdnn).toBe('hrv-anchor-old');
    expect(result.nextAnchors.anchors.restingHeartRate).toBeNull();
    expect(result.nextAnchors.anchors.steps).toBe('steps-anchor-1');

    expect(result.partial).toBe(true); // not every type synced
  });
});

// ─── Zero samples: no fabrication ─────────────────────────────────────────────

describe('zero samples', () => {
  it('produces empty records and forwards the anchor exactly as the client reported it (same or advanced), never fabricated', async () => {
    const { client } = makeClient({
      steps: { auth: 'authorized', pages: [{ samples: [], newAnchor: 'same-anchor', done: true }] },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'same-anchor' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.steps).toEqual({ status: 'synced' });
    expect(result.nextAnchors.anchors.steps).toBe('same-anchor');
    expect(result.partial).toBe(false);
  });

  it('a client-reported null anchor after zero samples is passed through as null, not upgraded to a fake token', async () => {
    const { client } = makeClient({
      steps: { auth: 'authorized', pages: [{ samples: [], newAnchor: null, done: true }] },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.nextAnchors.anchors.steps).toBeNull();
  });
});

// ─── Revoked mid-sync ─────────────────────────────────────────────────────────

describe('revoked mid-sync', () => {
  it('one type throwing an authorization-revoked error mid-pagination reports that type honestly, keeps prior pages, and leaves other types unaffected', async () => {
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          { samples: [quantitySample(1, '2026-08-01T00:00:00.000Z')], newAnchor: 'steps-page-1', done: false },
          new AppleHealthKitAuthorizationRevokedError('user revoked Steps access'),
        ],
      },
      hrvSdnn: {
        auth: 'authorized',
        pages: [{ samples: [quantitySample(45, '2026-08-01T00:00:00.000Z')], newAnchor: 'hrv-anchor-1', done: true }],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps', 'hrvSdnn'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    // steps: first page's sample survives even though the second page failed.
    const stepsRecords = result.records.filter((r) => r.metricType === 'steps');
    expect(stepsRecords).toHaveLength(1);

    expect(result.authorization.steps?.status).toBe('authorization_revoked');
    expect(result.authorization.steps?.message).toMatch(/revoked/i);
    // Anchor persisted is the LAST SUCCESSFUL page's anchor, not advanced past the failure.
    expect(result.nextAnchors.anchors.steps).toBe('steps-page-1');

    // hrvSdnn is completely unaffected by steps' failure.
    expect(result.authorization.hrvSdnn).toEqual({ status: 'synced' });
    const hrvRecords = result.records.filter((r) => r.metricType === 'hrv');
    expect(hrvRecords).toHaveLength(1);
    expect(result.nextAnchors.anchors.hrvSdnn).toBe('hrv-anchor-1');

    expect(result.partial).toBe(true);
    expect(result.records).toHaveLength(2);
  });

  it('a generic (non-revocation) thrown error is reported as "error", not "authorization_revoked"', async () => {
    const { client } = makeClient({
      steps: { auth: 'authorized', pages: [new Error('native bridge timeout')] },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.authorization.steps?.status).toBe('error');
    expect(result.authorization.steps?.message).toMatch(/timeout/i);
    expect(result.records).toEqual([]);
  });

  it('getAuthorizationStatus itself throwing is captured as that type\'s error, without aborting the whole run', async () => {
    const { client } = makeClient({
      steps: { auth: new Error('HealthKit store unavailable'), pages: [] },
      hrvSdnn: { auth: 'authorized', pages: [{ samples: [], newAnchor: 'hrv-1', done: true }] },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps', 'hrvSdnn'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.authorization.steps?.status).toBe('error');
    expect(result.authorization.hrvSdnn).toEqual({ status: 'synced' });
  });
});

// ─── SDNN preserved end-to-end ────────────────────────────────────────────────

describe('SDNN preserved end-to-end', () => {
  it('HRV records produced by the sync engine carry hrvMethod "sdnn", never "rmssd"', async () => {
    const { client } = makeClient({
      hrvSdnn: {
        auth: 'authorized',
        pages: [{ samples: [quantitySample(52.4, '2026-08-02T22:00:00.000Z')], newAnchor: 'hrv-1', done: true }],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['hrvSdnn'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].metricType).toBe('hrv');
    expect(result.records[0].hrvMethod).toBe('sdnn');
  });
});

// ─── Pagination / batching ────────────────────────────────────────────────────

describe('pagination and batching', () => {
  it('pages through multiple non-terminal pages until done:true, accumulating samples across the whole run', async () => {
    const { client, calls } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          { samples: [quantitySample(1, '2026-08-01T00:00:00.000Z')], newAnchor: 'p1', done: false },
          { samples: [quantitySample(2, '2026-08-01T01:00:00.000Z')], newAnchor: 'p2', done: false },
          { samples: [quantitySample(3, '2026-08-01T02:00:00.000Z')], newAnchor: 'p3', done: true },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toHaveLength(3);
    expect(result.authorization.steps).toEqual({ status: 'synced' });
    expect(result.nextAnchors.anchors.steps).toBe('p3');
    expect(calls.query.map((c) => c.anchor)).toEqual([null, 'p1', 'p2']);
  });

  it('stops at maxPagesPerType before done:true, marks hasMorePages, and persists the last fetched anchor (not an error)', async () => {
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          { samples: [quantitySample(1, '2026-08-01T00:00:00.000Z')], newAnchor: 'p1', done: false },
          { samples: [quantitySample(2, '2026-08-01T00:00:00.000Z')], newAnchor: 'p2', done: false },
          { samples: [quantitySample(3, '2026-08-01T00:00:00.000Z')], newAnchor: 'p3', done: false },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
      maxPagesPerType: 2,
    });

    expect(result.records).toHaveLength(2); // only the first 2 pages were fetched
    expect(result.authorization.steps).toEqual({ status: 'synced', hasMorePages: true });
    expect(result.nextAnchors.anchors.steps).toBe('p2');
    expect(result.partial).toBe(true); // capped, more remains for next run
  });
});

// ─── Anchor schema-version honesty ────────────────────────────────────────────

describe('anchor schema version', () => {
  it('a version mismatch is treated as no anchor (fresh baseline), never trusted or thrown on', async () => {
    const { client, calls } = makeClient({
      steps: { auth: 'authorized', pages: [{ samples: [], newAnchor: 'fresh-1', done: true }] },
    });

    const staleBlob = { version: 999 as unknown as typeof APPLE_HEALTH_ANCHOR_SCHEMA_VERSION, anchors: { steps: 'old-format-token' } };

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: staleBlob,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(calls.query[0].anchor).toBeNull(); // old-format token was never handed to the client
    expect(result.nextAnchors.version).toBe(APPLE_HEALTH_ANCHOR_SCHEMA_VERSION);
    expect(result.nextAnchors.anchors.steps).toBe('fresh-1');
  });

  it('anchor deserialization failure: a blob with no recognizable version field at all re-baselines exactly like a version mismatch, never throwing', async () => {
    const { client, calls } = makeClient({
      steps: { auth: 'authorized', pages: [{ samples: [], newAnchor: 'fresh-2', done: true }] },
    });

    // Simulates a truly corrupt/foreign persisted blob (e.g. JSON.parse of
    // garbage, or a pre-schema shape) rather than merely an old version
    // number — `version` is absent entirely.
    const corruptBlob = { anchors: { steps: 'old-format-token' } } as unknown as AppleHealthAnchorState;

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: corruptBlob,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(calls.query[0].anchor).toBeNull();
    expect(result.authorization.steps).toEqual({ status: 'synced' });
    expect(result.nextAnchors.version).toBe(APPLE_HEALTH_ANCHOR_SCHEMA_VERSION);
    expect(result.nextAnchors.anchors.steps).toBe('fresh-2');
  });

  it('createEmptyAppleHealthAnchorState starts every future type from null', () => {
    const empty = createEmptyAppleHealthAnchorState();
    expect(empty.version).toBe(APPLE_HEALTH_ANCHOR_SCHEMA_VERSION);
    expect(empty.anchors).toEqual({});
  });
});

// ─── Sleep / workout array-shaped mappers wired through the same engine ──────

describe('sleep and workout types route through their existing mappers', () => {
  it('sleepAnalysis samples produce a sleep_session record via the existing mapper (no engine-level reimplementation)', async () => {
    const { client } = makeClient({
      sleepAnalysis: {
        auth: 'authorized',
        pages: [
          {
            samples: [
              {
                value: 4,
                startDate: '2026-08-02T23:00:00.000Z',
                endDate: '2026-08-03T01:00:00.000Z',
                sourceRevision: { source: { bundleIdentifier: 'com.apple.health' } },
              },
            ],
            newAnchor: 'sleep-1',
            done: true,
          },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['sleepAnalysis'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].metricType).toBe('sleep_session');
  });

  it('workout samples produce a workout record via the existing mapper', async () => {
    const { client } = makeClient({
      workout: {
        auth: 'authorized',
        pages: [
          {
            samples: [
              {
                workoutActivityType: 'Running',
                durationSec: 1800,
                totalEnergyBurnedKcal: 220,
                averageHeartRateBpm: 140,
                startDate: '2026-08-02T07:00:00.000Z',
                endDate: '2026-08-02T07:30:00.000Z',
                sourceRevision: { source: { bundleIdentifier: 'com.apple.health' } },
              },
            ],
            newAnchor: 'workout-1',
            done: true,
          },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['workout'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].metricType).toBe('workout');
  });
});

// ─── SAMPLE_TYPE_TO_METRIC_TYPE mirrors the mappers' own dispatch ──────────

describe('SAMPLE_TYPE_TO_METRIC_TYPE', () => {
  it('has exactly one entry per ALL_APPLE_HEALTH_SAMPLE_TYPES, matching what the mappers actually produce', async () => {
    expect(Object.keys(SAMPLE_TYPE_TO_METRIC_TYPE).sort()).toEqual([...ALL_APPLE_HEALTH_SAMPLE_TYPES].sort());
    expect(SAMPLE_TYPE_TO_METRIC_TYPE).toEqual({
      restingHeartRate: 'resting_heart_rate',
      hrvSdnn: 'hrv',
      steps: 'steps',
      activeEnergy: 'active_energy',
      respiratoryRate: 'respiratory_rate',
      sleepAnalysis: 'sleep_session',
      workout: 'workout',
    });
  });

  function scriptFor(type: AppleHealthSampleType): ScriptedPages {
    const newAnchor = `${type}-anchor`;
    if (type === 'sleepAnalysis') {
      return {
        auth: 'authorized',
        pages: [
          {
            samples: [{ value: 1, startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-01T01:00:00.000Z' }],
            newAnchor,
            done: true,
          },
        ],
      };
    }
    if (type === 'workout') {
      return {
        auth: 'authorized',
        pages: [
          {
            samples: [
              {
                workoutActivityType: 'Cycling',
                durationSec: 600,
                startDate: '2026-08-01T00:00:00.000Z',
                endDate: '2026-08-01T00:10:00.000Z',
              },
            ],
            newAnchor,
            done: true,
          },
        ],
      };
    }
    return {
      auth: 'authorized',
      pages: [{ samples: [quantitySample(1, '2026-08-01T00:00:00.000Z')], newAnchor, done: true }],
    };
  }

  it.each(ALL_APPLE_HEALTH_SAMPLE_TYPES)(
    '%s: the synced record\'s metricType matches SAMPLE_TYPE_TO_METRIC_TYPE',
    async (type) => {
      const script: Partial<Record<AppleHealthSampleType, ScriptedPages>> = {};
      script[type] = scriptFor(type);
      const { client } = makeClient(script);

      const result = await runAppleHealthSync({
        client,
        userId: USER_ID,
        types: [type],
        anchors: null,
        nowMs: NOW_MS,
        syncedAt: SYNCED_AT,
      });
      expect(result.records).toHaveLength(1);
      expect(result.records[0].metricType).toBe(SAMPLE_TYPE_TO_METRIC_TYPE[type]);
    },
  );
});

// ─── Malformed payloads: never throw, drop what's bad, isolate the rest ───

describe('malformed payloads never throw', () => {
  it('a page whose `samples` is not an array is reported as a type-level error, not a thrown exception, and does not advance the anchor', async () => {
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [{ samples: 'not-an-array' as unknown as unknown[], newAnchor: 'bad-anchor', done: true }],
      },
    });

    // The bare `await` is the "never throws" proof: a thrown/rejected sync
    // would fail this test via an uncaught rejection, not a mismatch below.
    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'anchor-before' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.steps?.status).toBe('error');
    expect(result.authorization.steps?.message).toMatch(/not an array/i);
    // The malformed page's `newAnchor` must never be trusted or persisted.
    expect(result.nextAnchors.anchors.steps).toBe('anchor-before');
  });

  it('malformed-record retry: a run that hit a malformed page can be safely retried from the returned (unmoved) anchor once the bridge sends a good payload', async () => {
    const cursor = { calls: 0 };
    const client: HealthKitQueryClient = {
      async getAuthorizationStatus() {
        return 'authorized';
      },
      async queryAnchored(_type, anchor) {
        cursor.calls += 1;
        if (cursor.calls === 1) {
          // First attempt: a native-bridge protocol violation.
          return { samples: 'not-an-array' as unknown as unknown[], newAnchor: 'bad-anchor', done: true } as never;
        }
        // Retry: the same anchor comes back in, and this time the bridge
        // behaves. Proves the anchor round-trip is exactly what makes the
        // retry safe.
        expect(anchor).toBe('anchor-before');
        return {
          samples: [quantitySample(42, '2026-08-01T00:00:00.000Z')],
          newAnchor: 'anchor-after',
          done: true,
        } as never;
      },
    };

    const firstRun = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'anchor-before' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });
    expect(firstRun.authorization.steps?.status).toBe('error');
    expect(firstRun.nextAnchors.anchors.steps).toBe('anchor-before');

    const retryRun = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: firstRun.nextAnchors,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });
    expect(retryRun.authorization.steps).toEqual({ status: 'synced' });
    expect(retryRun.records).toHaveLength(1);
    expect(retryRun.nextAnchors.anchors.steps).toBe('anchor-after');
  });

  it('a null entry inside an otherwise-valid samples array is dropped, siblings in the same page still sync', async () => {
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          {
            samples: [null, quantitySample(500, '2026-08-01T00:00:00.000Z')] as unknown[],
            newAnchor: 'steps-anchor-1',
            done: true,
          },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toHaveLength(1);
    expect(result.authorization.steps).toEqual({ status: 'synced' });
    // The page's own anchor IS trusted — only the individual entry was bad,
    // not the page's shape.
    expect(result.nextAnchors.anchors.steps).toBe('steps-anchor-1');
  });

  it('a quantity sample missing `quantity` is dropped rather than producing a fabricated value', async () => {
    const { client } = makeClient({
      hrvSdnn: {
        auth: 'authorized',
        pages: [
          {
            samples: [{ startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-01T00:00:00.000Z' }] as unknown[],
            newAnchor: 'hrv-1',
            done: true,
          },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['hrvSdnn'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.hrvSdnn).toEqual({ status: 'synced' });
  });

  it('a workout sample missing `workoutActivityType` is dropped instead of crashing on `.toLowerCase()`', async () => {
    const { client } = makeClient({
      workout: {
        auth: 'authorized',
        pages: [
          {
            samples: [
              { durationSec: 900, startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-01T00:15:00.000Z' },
            ] as unknown[],
            newAnchor: 'workout-1',
            done: true,
          },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['workout'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.workout).toEqual({ status: 'synced' });
  });

  it('a sleep sample missing `value` is dropped instead of polluting the session with an undefined stage', async () => {
    const { client } = makeClient({
      sleepAnalysis: {
        auth: 'authorized',
        pages: [
          {
            samples: [
              { startDate: '2026-08-01T00:00:00.000Z', endDate: '2026-08-01T01:00:00.000Z' },
            ] as unknown[],
            newAnchor: 'sleep-1',
            done: true,
          },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['sleepAnalysis'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.sleepAnalysis).toEqual({ status: 'synced' });
  });

  it('a malformed page mid-pagination still preserves the prior page\'s samples and anchor', async () => {
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          { samples: [quantitySample(1, '2026-08-01T00:00:00.000Z')], newAnchor: 'p1', done: false },
          { samples: null as unknown as unknown[], newAnchor: 'p2-bad', done: true },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toHaveLength(1); // page 1's sample survives
    expect(result.authorization.steps?.status).toBe('error');
    expect(result.nextAnchors.anchors.steps).toBe('p1'); // NOT 'p2-bad'
  });
});

// ─── Mapping failures: ATOMIC-COMMIT correction ──────────────────────────────
// These are the defect-fix tests: a mapping/normalization failure must never
// advance the anchor past what was true before THIS run started, because
// `collected` (what gets mapped in one bulk call) can span every page fetched
// this run — the anchor variable tracking fetch progress is a red herring
// once mapping itself fails, since nothing fetched was ever actually emitted.

describe('mapping failures (ATOMIC-COMMIT correction)', () => {
  it('a single successful page still commits the anchor when mapping succeeds (control case for the failure tests below)', async () => {
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [{ samples: [quantitySample(10, '2026-08-01T00:00:00.000Z')], newAnchor: 'steps-final', done: true }],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'steps-prior' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.authorization.steps).toEqual({ status: 'synced' });
    expect(result.nextAnchors.anchors.steps).toBe('steps-final');
    expect(result.records).toHaveLength(1);
  });

  it('a mapping failure on the final (done:true) page returns the INPUT anchor, not the already-advanced page anchor', async () => {
    stepsMapShouldFail = true;
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [{ samples: [quantitySample(10, '2026-08-01T00:00:00.000Z')], newAnchor: 'steps-final', done: true }],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'steps-prior' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.steps?.status).toBe('error');
    expect(result.authorization.steps?.reason).toBe('map_failed');
    // The defect: this used to persist 'steps-final' (the page's advanced
    // anchor) with zero emitted records — permanent data loss per the file
    // header's ATOMIC-COMMIT OBLIGATION. The fix: the INPUT anchor, unmoved.
    expect(result.nextAnchors.anchors.steps).toBe('steps-prior');
    expect(result.nextAnchors.anchors.steps).not.toBe('steps-final');
    // Diagnostics identify type + page count, never the raw mapper text
    // (which could, in principle, echo a sample value from off-limits code).
    expect(result.authorization.steps?.message).toMatch(/steps/i);
    expect(result.authorization.steps?.message).not.toMatch(/invariant violated/i);
  });

  it('a mapping failure after MULTIPLE successful page fetches rolls back to the run\'s INPUT anchor, not to any intermediate page boundary', async () => {
    stepsMapShouldFail = true;
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          { samples: [quantitySample(1, '2026-08-01T00:00:00.000Z')], newAnchor: 'p1', done: false },
          { samples: [quantitySample(2, '2026-08-01T01:00:00.000Z')], newAnchor: 'p2', done: true },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'steps-input' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.steps?.reason).toBe('map_failed');
    // `collected` spans BOTH pages by the time mapping runs (mapping is one
    // bulk call over the whole run's accumulation, not per-page) — so even
    // 'p1', the boundary after the first individually-successful fetch, is
    // not a safe rewind target: nothing from p1 OR p2 was ever durably
    // emitted. Only the anchor that was true before this run started is.
    expect(result.nextAnchors.anchors.steps).toBe('steps-input');
    expect(result.nextAnchors.anchors.steps).not.toBe('p1');
    expect(result.nextAnchors.anchors.steps).not.toBe('p2');
  });

  it('a mapping failure inside the queryAnchored-throw catch path also rolls back to the INPUT anchor, not the last-successful-page anchor', async () => {
    stepsMapShouldFail = true;
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          { samples: [quantitySample(1, '2026-08-01T00:00:00.000Z')], newAnchor: 'p1', done: false },
          new Error('native bridge timeout'),
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'steps-input' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.steps?.status).toBe('error');
    expect(result.authorization.steps?.reason).toBe('map_failed');
    // Previously this branch discarded the mapping error entirely and
    // returned `anchor` (p1) alongside the query-throw's generic message —
    // silently advancing past data that was never actually emitted.
    expect(result.nextAnchors.anchors.steps).toBe('steps-input');
    expect(result.nextAnchors.anchors.steps).not.toBe('p1');
  });

  it('a mapping failure at the maxPagesPerType safety cap also rolls back to the INPUT anchor', async () => {
    stepsMapShouldFail = true;
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          { samples: [quantitySample(1, '2026-08-01T00:00:00.000Z')], newAnchor: 'p1', done: false },
          { samples: [quantitySample(2, '2026-08-01T00:00:00.000Z')], newAnchor: 'p2', done: false },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'steps-input' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
      maxPagesPerType: 2,
    });

    expect(result.records).toEqual([]);
    expect(result.authorization.steps?.reason).toBe('map_failed');
    expect(result.nextAnchors.anchors.steps).toBe('steps-input');
    expect(result.nextAnchors.anchors.steps).not.toBe('p2');
  });

  it('retry of the same (unmoved) anchor after a map failure succeeds once the mapper condition clears — proving the failure was honestly retryable', async () => {
    stepsMapShouldFail = true;
    // The real HealthKit client re-issues the SAME page for the SAME
    // unmoved anchor on retry — two identical scripted pages model that
    // honestly (the shared test double's cursor advances per call, not per
    // anchor, so this is the correct way to script "retry re-fetches").
    const page = { samples: [quantitySample(10, '2026-08-01T00:00:00.000Z')], newAnchor: 'steps-final', done: true };
    const { client, calls } = makeClient({
      steps: { auth: 'authorized', pages: [page, page] },
    });

    const firstRun = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: anchorState({ steps: 'steps-input' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });
    expect(firstRun.authorization.steps?.reason).toBe('map_failed');
    expect(firstRun.nextAnchors.anchors.steps).toBe('steps-input');

    // Simulate the underlying mapper defect clearing (e.g. a fixed deploy)
    // and the caller retrying with exactly the anchor the failed run handed
    // back — per the ATOMIC-COMMIT contract, that is the honest, safe thing
    // for a caller to persist and replay.
    stepsMapShouldFail = false;
    const retryRun = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: firstRun.nextAnchors,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    expect(retryRun.authorization.steps).toEqual({ status: 'synced' });
    expect(retryRun.records).toHaveLength(1);
    expect(retryRun.nextAnchors.anchors.steps).toBe('steps-final');
    // Both the failed run and the retry queried from the SAME anchor —
    // confirming the failed run truly never advanced past it.
    expect(calls.query.map((c) => c.anchor)).toEqual(['steps-input', 'steps-input']);
  });
});

// ─── Dedup-key idempotency: why re-emission on retry is safe ─────────────────
// The map-failure fix above relies on retries safely re-fetching and
// re-emitting the same samples. That is only actually safe because the
// mappers already produce a deterministic, content-derived
// `deduplicationKey` — this suite proves that property directly rather than
// assuming it.

describe('dedup-key idempotency (why retry re-emission is safe)', () => {
  it('two identical sync runs over the same input produce records with identical deduplicationKeys', async () => {
    const buildClient = () =>
      makeClient({
        steps: {
          auth: 'authorized',
          pages: [
            {
              samples: [quantitySample(500, '2026-08-01T00:00:00.000Z')],
              newAnchor: 'steps-anchor-1',
              done: true,
            },
          ],
        },
      });

    const params = (client: HealthKitQueryClient) => ({
      client,
      userId: USER_ID,
      types: ['steps'] as AppleHealthSampleType[],
      anchors: anchorState({ steps: 'steps-input' }),
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    const run1 = await runAppleHealthSync(params(buildClient().client));
    const run2 = await runAppleHealthSync(params(buildClient().client));

    expect(run1.records).toHaveLength(1);
    expect(run2.records).toHaveLength(1);
    expect(run1.records[0].deduplicationKey).toBe(run2.records[0].deduplicationKey);
    expect(run1.records[0].deduplicationKey).toBeTruthy();
  });

  it('the same raw sample appearing twice within one run (e.g. an overlapping anchor boundary) maps to two records sharing one deduplicationKey', async () => {
    const duplicateSample = quantitySample(500, '2026-08-01T00:00:00.000Z');
    const { client } = makeClient({
      steps: {
        auth: 'authorized',
        pages: [
          { samples: [duplicateSample], newAnchor: 'p1', done: false },
          { samples: [duplicateSample], newAnchor: 'p2', done: true },
        ],
      },
    });

    const result = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    // This engine does not itself deduplicate (that is health-core's
    // dedupe.ts, downstream of this module) — but the KEY it produces for
    // both copies must be identical, which is what makes a downstream
    // upsert-by-key idempotent instead of silently double-counting.
    expect(result.records).toHaveLength(2);
    expect(result.records[0].deduplicationKey).toBe(result.records[1].deduplicationKey);
    expect(result.records[0].deduplicationKey).toBeTruthy();
  });
});

// ─── native-unavailable vs clean-empty: explicit contrast ──────────────────

describe('native-unavailable (client: null) vs clean-empty (client present, zero samples) are unambiguous', () => {
  it('produce different authorization shapes for the same type even though both report zero records', async () => {
    const unavailableResult = await runAppleHealthSync({
      client: null,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    const { client } = makeClient({
      steps: { auth: 'authorized', pages: [{ samples: [], newAnchor: null, done: true }] },
    });
    const cleanEmptyResult = await runAppleHealthSync({
      client,
      userId: USER_ID,
      types: ['steps'],
      anchors: null,
      nowMs: NOW_MS,
      syncedAt: SYNCED_AT,
    });

    // Both report zero records...
    expect(unavailableResult.records).toEqual([]);
    expect(cleanEmptyResult.records).toEqual([]);
    // ...but the per-type status is never conflated.
    expect(unavailableResult.authorization.steps).toEqual({ status: 'unavailable' });
    expect(cleanEmptyResult.authorization.steps).toEqual({ status: 'synced' });
    expect(unavailableResult.authorization.steps?.status).not.toBe(cleanEmptyResult.authorization.steps?.status);
  });
});
