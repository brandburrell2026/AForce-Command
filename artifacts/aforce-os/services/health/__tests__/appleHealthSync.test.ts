import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  runAppleHealthSync,
  createEmptyAppleHealthAnchorState,
  AppleHealthKitAuthorizationRevokedError,
  APPLE_HEALTH_ANCHOR_SCHEMA_VERSION,
  type HealthKitQueryClient,
  type AppleHealthAuthorizationStatus,
  type AppleHealthAnchoredQueryPage,
  type AppleHealthSampleType,
  type AppleHealthAnchorState,
  type AppleHealthAnchorToken,
} from '../appleHealthSync';
import type { HKQuantitySample } from '../appleHealthRecords';

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
