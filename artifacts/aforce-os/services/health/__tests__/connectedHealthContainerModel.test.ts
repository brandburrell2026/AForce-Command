import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_FLAGS } from '../../../featureFlags/flags';
import type { FeatureFlags } from '../../../types';
import type { HealthConnectionSignals } from '../../../utils/health/healthConnectionMapping';
import { resolveConnectedHealthView } from '../connectedHealthView';
import {
  applyProbeCycle,
  buildConnectedHealthInput,
  dropCloudFact,
  loadConnectedHealthCloudFacts,
  mergeCloudFacts,
  performConnectedHealthDisconnect,
  resolveRevocationOutcome,
  revocationCopyKey,
  CLOUD_DISCONNECT_PROVIDERS,
  CLOUD_PROBE_TIMEOUT_MS,
  type ConnectedHealthCloudProbeResult,
  type ConnectedHealthContainerModelInput,
} from '../connectedHealthContainerModel';

const NOW = new Date('2026-08-03T18:00:00Z').getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;

const NONE: HealthConnectionSignals = { integrationReady: false, link: 'none' };
const CONFIGURED_NONE: HealthConnectionSignals = { integrationReady: true, link: 'none' };
const CONFIGURED_CONNECTED: HealthConnectionSignals = { integrationReady: true, link: 'connected' };
const CONFIGURED_EXPIRED: HealthConnectionSignals = { integrationReady: true, link: 'expired' };

function baseInput(over: Partial<ConnectedHealthContainerModelInput> = {}): ConnectedHealthContainerModelInput {
  return {
    nowMs: NOW,
    mode: 'ready',
    platform: 'ios',
    featureFlags: DEFAULT_FLAGS,
    biometrics: undefined,
    cloud: {},
    appleHealthLinked: false,
    appleHealthNativeReady: false,
    ...over,
  };
}

/** Raw model output row (presentation/lastSyncAtMs/grantedTypes/... — my model's own shape). */
function modelRow(input: ConnectedHealthContainerModelInput, providerId: string) {
  const view = buildConnectedHealthInput(input);
  const row = view.providers.find((p) => p.providerId === providerId);
  if (!row) throw new Error(`no provider row for ${providerId}`);
  return row;
}

/** Fully-resolved view row (statusPill/troubleshoot/canDisconnect/pulls) — proves the
 *  model's output actually drives the existing, already-tested pure resolver correctly. */
function viewRow(input: ConnectedHealthContainerModelInput, providerId: string) {
  const view = resolveConnectedHealthView(buildConnectedHealthInput(input));
  const row = view.rows.find((r) => r.providerId === providerId);
  if (!row) throw new Error(`no view row for ${providerId}`);
  return row;
}

describe('buildConnectedHealthInput — shape + determinism', () => {
  it('emits exactly one row per catalog provider, mode/platform/now pass through', () => {
    const view = buildConnectedHealthInput(baseInput());
    expect(view.mode).toBe('ready');
    expect(view.platform).toBe('ios');
    expect(view.now).toBe(NOW);
    expect(view.providers).toHaveLength(7);
    expect(new Set(view.providers.map((p) => p.providerId)).size).toBe(7);
  });

  it('is deterministic — same input twice yields deep-equal output', () => {
    const input = baseInput({ cloud: { whoop: CONFIGURED_CONNECTED } });
    expect(buildConnectedHealthInput(input)).toEqual(buildConnectedHealthInput(input));
  });

  it('never assigns an errorKind (unreachable from any real fact this container produces today)', () => {
    const view = buildConnectedHealthInput(baseInput({ cloud: { whoop: CONFIGURED_CONNECTED } }));
    for (const row of view.providers) expect(row.errorKind).toBeNull();
  });

  it('grantedTypes/deniedTypes are always empty (no per-type consent source exists yet)', () => {
    const view = buildConnectedHealthInput(baseInput({ cloud: { whoop: CONFIGURED_CONNECTED } }));
    for (const row of view.providers) {
      expect(row.grantedTypes).toEqual([]);
      expect(row.deniedTypes).toEqual([]);
    }
  });
});

describe('flags OFF ⇒ every provider except WHOOP is non-connectable', () => {
  it('with all health_* flags off and no cloud facts, no provider but WHOOP resolves to the connectable/"disconnected" group', () => {
    const view = buildConnectedHealthInput(baseInput());
    for (const row of view.providers) {
      if (row.providerId === 'whoop') continue;
      expect(row.presentation.state).not.toBe('disconnected');
      expect(row.presentation.live).toBe(false);
    }
  });

  it('WHOOP is the documented flag-immune carve-out: a configured-but-unlinked backend still offers Connect', () => {
    const input = baseInput({ cloud: { whoop: CONFIGURED_NONE } });
    expect(modelRow(input, 'whoop').presentation.state).toBe('disconnected');
    expect(viewRow(input, 'whoop').troubleshoot.kind).toBe('connect');
  });

  it('turning a provider flag ON does make it connectable again (proves the OFF assertion is real, not hardcoded)', () => {
    const flags: FeatureFlags = { ...DEFAULT_FLAGS, health_garmin_enabled: true };
    const row = modelRow(baseInput({ featureFlags: flags, cloud: { garmin: CONFIGURED_NONE } }), 'garmin');
    expect(row.presentation.state).toBe('disconnected');
  });
});

describe('Garmin — dormant vs. approval_pending, and non-actionable either way', () => {
  it('no probe (backend integration not configured) ⇒ requires_external_approval ("Approval Pending")', () => {
    const input = baseInput();
    expect(modelRow(input, 'garmin').presentation.state).toBe('requires_external_approval');
    const view = viewRow(input, 'garmin');
    expect(view.troubleshoot.kind).toBe('none');
    expect(view.canDisconnect).toBe(false);
    expect(view.pulls).toEqual([]);
  });

  it('probe reports backend credentials configured, no token yet, flag OFF ⇒ dormant ("Awaiting Access")', () => {
    const input = baseInput({ cloud: { garmin: CONFIGURED_NONE } });
    expect(modelRow(input, 'garmin').presentation.state).toBe('dormant');
    const view = viewRow(input, 'garmin');
    expect(view.troubleshoot.kind).toBe('none');
    expect(view.canDisconnect).toBe(false);
    expect(view.pulls).toEqual([]);
  });

  it('a genuine pre-existing connected link still wins even with the flag off (flags never hide a real connection)', () => {
    const input = baseInput({
      cloud: { garmin: CONFIGURED_CONNECTED },
      biometrics: { garmin: { fetchedAt: NOW - 5 * MIN } as never },
    });
    expect(modelRow(input, 'garmin').presentation.state).toBe('connected');
    expect(viewRow(input, 'garmin').canDisconnect).toBe(true);
  });
});

describe('Samsung — via Health Connect on Android only, regardless of flags', () => {
  it('android ⇒ via_health_connect, non-actionable, no disconnect', () => {
    const input = baseInput({ platform: 'android' });
    expect(modelRow(input, 'samsung_health').presentation.state).toBe('via_health_connect');
    const view = viewRow(input, 'samsung_health');
    expect(view.troubleshoot.kind).toBe('none');
    expect(view.canDisconnect).toBe(false);
  });

  it('ios ⇒ unsupported', () => {
    const row = modelRow(baseInput({ platform: 'ios' }), 'samsung_health');
    expect(row.presentation.state).toBe('unavailable');
  });

  it('flipping health_samsung_direct_enabled ON changes nothing — Samsung never offers a direct connect path', () => {
    const flags: FeatureFlags = { ...DEFAULT_FLAGS, health_samsung_direct_enabled: true };
    const row = modelRow(baseInput({ platform: 'android', featureFlags: flags }), 'samsung_health');
    expect(row.presentation.state).toBe('via_health_connect');
  });
});

describe('Oura / Strava / Google Health — no client OAuth wiring, cloud probe cannot move the row', () => {
  it('even an optimistic "connected" cloud probe cannot make Oura/Strava connectable (resolver hardcodes no wiring)', () => {
    const input = baseInput({ cloud: { oura: CONFIGURED_CONNECTED, strava: CONFIGURED_CONNECTED } });
    for (const id of ['oura', 'strava'] as const) {
      const model = modelRow(input, id);
      expect(model.presentation.state).not.toBe('connected');
      expect(model.presentation.live).toBe(false);
      expect(viewRow(input, id).canDisconnect).toBe(false);
    }
  });

  it('Google Health is dormant on android, unsupported elsewhere, independent of flags', () => {
    const androidRow = modelRow(baseInput({ platform: 'android' }), 'google_health');
    expect(androidRow.presentation.state).toBe('dormant');
    const iosRow = modelRow(baseInput({ platform: 'ios' }), 'google_health');
    expect(iosRow.presentation.state).toBe('unavailable');
  });
});

describe('Apple Health — real link source, never the mocked toggle', () => {
  it('no captured biometrics ⇒ dormant, not connected', () => {
    const row = modelRow(baseInput({ platform: 'ios', appleHealthNativeReady: true, appleHealthLinked: false }), 'apple_health');
    expect(row.presentation.state).toBe('dormant');
  });

  it('a real captured snapshot (appleHealthLinked=true) plus fresh biometrics ⇒ connected + disconnectable', () => {
    const input = baseInput({
      platform: 'ios',
      appleHealthNativeReady: true,
      appleHealthLinked: true,
      biometrics: { apple_health: { fetchedAt: NOW - 10 * MIN } as never },
    });
    expect(modelRow(input, 'apple_health').presentation.state).toBe('connected');
    expect(viewRow(input, 'apple_health').canDisconnect).toBe(true);
  });

  it('stale biometrics downgrade the row honestly, never staying "connected"', () => {
    const input = baseInput({
      platform: 'ios',
      appleHealthLinked: true,
      biometrics: { apple_health: { fetchedAt: NOW - 40 * HOUR } as never },
    });
    expect(modelRow(input, 'apple_health').presentation.state).toBe('stale');
    expect(viewRow(input, 'apple_health').troubleshoot.kind).toBe('reconnect');
  });
});

describe('freshness — real fetchedAt drives lastSyncAtMs, never fabricated', () => {
  it('no biometrics for a provider ⇒ lastSyncAtMs null ("Never synced")', () => {
    const row = modelRow(baseInput({ cloud: { whoop: CONFIGURED_CONNECTED } }), 'whoop');
    expect(row.lastSyncAtMs).toBeNull();
  });

  it('real biometrics fetchedAt flows straight through to lastSyncAtMs', () => {
    const fetchedAt = NOW - 12 * MIN;
    const row = modelRow(
      baseInput({ cloud: { whoop: CONFIGURED_CONNECTED }, biometrics: { whoop: { fetchedAt } as never } }),
      'whoop',
    );
    expect(row.lastSyncAtMs).toBe(fetchedAt);
  });
});

describe('WHOOP expiry mapping', () => {
  it('an expired cloud link renders action_required ("Needs Attention"), never a fabricated live state', () => {
    const input = baseInput({ cloud: { whoop: CONFIGURED_EXPIRED }, biometrics: { whoop: { fetchedAt: NOW - HOUR } as never } });
    const model = modelRow(input, 'whoop');
    expect(model.presentation.state).toBe('action_required');
    expect(model.presentation.live).toBe(false);
    expect(viewRow(input, 'whoop').troubleshoot.kind).toBe('reconnect');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Revocation vocabulary
// ─────────────────────────────────────────────────────────────────────────

describe('resolveRevocationOutcome', () => {
  it('only whoop/garmin are wired for disconnect', () => {
    expect(CLOUD_DISCONNECT_PROVIDERS.has('whoop')).toBe(true);
    expect(CLOUD_DISCONNECT_PROVIDERS.has('garmin')).toBe(true);
    expect(CLOUD_DISCONNECT_PROVIDERS.has('oura')).toBe(false);
  });

  it('ok ⇒ succeeded, for both wired providers', () => {
    expect(resolveRevocationOutcome('whoop', { status: 'ok' })).toBe('succeeded');
    expect(resolveRevocationOutcome('garmin', { status: 'ok' })).toBe('succeeded');
  });

  it('credentials_missing ⇒ skipped_not_connected', () => {
    expect(resolveRevocationOutcome('whoop', { status: 'credentials_missing' })).toBe('skipped_not_connected');
  });

  it('every non-wired provider is unsupported regardless of the (hypothetical) result', () => {
    for (const id of ['oura', 'strava', 'apple_health', 'google_health', 'samsung_health'] as const) {
      expect(resolveRevocationOutcome(id, { status: 'ok' })).toBe('unsupported');
    }
  });

  it('revocationCopyKey points at the connected_health.revocation.* namespace', () => {
    expect(revocationCopyKey('succeeded')).toEqual({ key: 'connected_health.revocation.succeeded' });
    expect(revocationCopyKey('unsupported')).toEqual({ key: 'connected_health.revocation.unsupported' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Injectable I/O layer
// ─────────────────────────────────────────────────────────────────────────

describe('loadConnectedHealthCloudFacts — fetch injected for tests', () => {
  it('probes all four cloud providers and returns their signals', async () => {
    const seen: string[] = [];
    const fetchCloudSignals = vi.fn(async (provider: string): Promise<HealthConnectionSignals> => {
      seen.push(provider);
      return provider === 'whoop' ? CONFIGURED_CONNECTED : NONE;
    });

    const { facts, anyProbeFailed } = await loadConnectedHealthCloudFacts(NOW, { fetchCloudSignals: fetchCloudSignals as never });

    expect(seen.sort()).toEqual(['garmin', 'oura', 'strava', 'whoop']);
    expect(facts.whoop).toEqual(CONFIGURED_CONNECTED);
    expect(facts.garmin).toEqual(NONE);
    expect(anyProbeFailed).toBe(false);
  });

  it('with no injected fn, falls back to the real fetchHealthConnectionSignals — proven via injected getJson', async () => {
    const getJson = vi.fn(async (path: string) => {
      if (path === '/whoop/status') return { credentialsConfigured: true, connected: true };
      const err = Object.assign(new Error('not found'), { status: 404 });
      throw err;
    });

    const { facts, anyProbeFailed }: ConnectedHealthCloudProbeResult = await loadConnectedHealthCloudFacts(NOW, { getJson });

    // whoop/status resolved 200 connected:true → integrationReady true, link connected.
    expect(facts.whoop).toEqual({ integrationReady: true, link: 'connected' });
    // every other path 404s (not our AforceApiError class, but any thrown value
    // that isn't recognized maps to `unavailable` → not-ready, no link — never fabricated).
    expect(facts.garmin).toEqual({ integrationReady: false, link: 'none' });
    // fetchHealthConnectionSignals itself resolves honestly here (a 404 IS a
    // real, if ambiguous, server answer) — this is NOT a probe-layer failure.
    expect(anyProbeFailed).toBe(false);
  });

  it('a rejected probe is caught, OMITTED from facts (never fabricates a link), and marks anyProbeFailed', async () => {
    const fetchCloudSignals = vi.fn(async (provider: string): Promise<HealthConnectionSignals> => {
      if (provider === 'whoop') throw new Error('bridge exploded');
      return NONE;
    });

    const { facts, anyProbeFailed } = await loadConnectedHealthCloudFacts(NOW, { fetchCloudSignals: fetchCloudSignals as never });

    expect(anyProbeFailed).toBe(true);
    // OMITTED, not a fabricated fallback — `whoop` never resolved this cycle,
    // so it is absent from `facts` entirely. This is what lets the
    // container's merge (`mergeCloudFacts`) preserve a prior cycle's real
    // value instead of downgrading it to a fresh worse guess. Never surfaced
    // as disconnected/denied/unsupported (those live only in resolver-level
    // vocabulary, untouched).
    expect(facts.whoop).toBeUndefined();
    expect('whoop' in facts).toBe(false);
    // A sibling probe that succeeded is unaffected by whoop's rejection.
    expect(facts.garmin).toEqual(NONE);
  });

  it('a synchronously-throwing probe (e.g. native module absent) is caught the same way as a rejection', async () => {
    const fetchCloudSignals = vi.fn((provider: string): Promise<HealthConnectionSignals> => {
      if (provider === 'garmin') {
        throw new Error('native module not available');
      }
      return Promise.resolve(NONE);
    });

    const { facts, anyProbeFailed } = await loadConnectedHealthCloudFacts(NOW, { fetchCloudSignals: fetchCloudSignals as never });

    expect(anyProbeFailed).toBe(true);
    expect(facts.garmin).toBeUndefined();
    expect('garmin' in facts).toBe(false);
    expect(facts.whoop).toEqual(NONE);
  });

  it('a hung probe past the timeout is OMITTED from facts instead of wedging forever or fabricating a value (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const fetchCloudSignals = vi.fn((provider: string): Promise<HealthConnectionSignals> => {
        if (provider === 'whoop') return new Promise(() => {}); // never settles
        return Promise.resolve(NONE);
      });

      const resultPromise = loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: fetchCloudSignals as never,
        probeTimeoutMs: 5_000,
      });

      await vi.advanceTimersByTimeAsync(5_000);
      const { facts, anyProbeFailed } = await resultPromise;

      expect(anyProbeFailed).toBe(true);
      expect(facts.whoop).toBeUndefined();
      expect('whoop' in facts).toBe(false);
      expect(facts.garmin).toEqual(NONE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('S2 — a hung probe honors the actual PRODUCTION timeout bound (CLOUD_PROBE_TIMEOUT_MS = 8_000ms), no override', async () => {
    vi.useFakeTimers();
    try {
      const fetchCloudSignals = vi.fn((provider: string): Promise<HealthConnectionSignals> => {
        if (provider === 'whoop') return new Promise(() => {}); // never settles
        return Promise.resolve(NONE);
      });

      // No `probeTimeoutMs` override — this exercises the real production
      // default (`CLOUD_PROBE_TIMEOUT_MS`), which every other timeout test in
      // this file bypasses via an injected shorter value for speed. Advancing
      // fake timers by exactly `CLOUD_PROBE_TIMEOUT_MS` below already proves
      // the no-override bound is honored; a bare `expect(CLOUD_PROBE_TIMEOUT_MS)
      // .toBe(8_000)` here would be a change-detector on the constant itself,
      // not a behavioral assertion (#494 N-2).
      const resultPromise = loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: fetchCloudSignals as never,
      });

      await vi.advanceTimersByTimeAsync(CLOUD_PROBE_TIMEOUT_MS);
      const { facts, anyProbeFailed } = await resultPromise;

      expect(anyProbeFailed).toBe(true);
      expect(facts.whoop).toBeUndefined();
      expect(facts.garmin).toEqual(NONE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a clean, all-empty probe result (nothing connected anywhere) is honest, not a failure', async () => {
    const { facts, anyProbeFailed } = await loadConnectedHealthCloudFacts(NOW, {
      fetchCloudSignals: async () => NONE,
    });

    expect(anyProbeFailed).toBe(false);
    for (const id of ['whoop', 'garmin', 'oura', 'strava'] as const) {
      expect(facts[id]).toEqual(NONE);
    }
  });

  it('never produces an unhandled promise rejection even when fired-and-forgotten like the container does', async () => {
    const seenRejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => seenRejections.push(reason);
    process.once('unhandledRejection', onUnhandled);

    // Mirrors the container's `void refreshCloudFacts()` call pattern: no
    // `.catch`, no `await` at the call site.
    void loadConnectedHealthCloudFacts(NOW, {
      fetchCloudSignals: async (provider) => {
        if (provider === 'whoop') throw new Error('boom');
        return NONE;
      },
    });

    // Flush the microtask/macrotask queue so a leaked rejection would have
    // had its chance to fire the process listener.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setImmediate(resolve));

    process.removeListener('unhandledRejection', onUnhandled);
    expect(seenRejections).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// S1 — merge semantics across probe cycles (this is the actual B1 fix: a
// provider's last-known-good fact must genuinely survive a later failed
// cycle, not just get reasserted in a comment). `mergeCloudFacts` is the
// pure helper `ConnectedHealthContainer.refreshCloudFacts` calls as
// `setCloud((prev) => mergeCloudFacts(prev, facts))` — exercised here at the
// function level, no component mount required.
// ─────────────────────────────────────────────────────────────────────────

describe('mergeCloudFacts — failed cycles never overwrite previously-known facts', () => {
  it('a provider present in `next` always wins over `prev`, even a negative/ambiguous real result', () => {
    const prev = { whoop: CONFIGURED_CONNECTED };
    const next = { whoop: CONFIGURED_NONE };
    expect(mergeCloudFacts(prev, next)).toEqual({ whoop: CONFIGURED_NONE });
  });

  it('a provider ABSENT from `next` (its probe failed this cycle) keeps its prior value untouched', () => {
    const prev = { whoop: CONFIGURED_CONNECTED, garmin: CONFIGURED_NONE };
    const next = { garmin: CONFIGURED_CONNECTED }; // whoop omitted — its probe failed this cycle
    expect(mergeCloudFacts(prev, next)).toEqual({ whoop: CONFIGURED_CONNECTED, garmin: CONFIGURED_CONNECTED });
  });

  it('a provider that has NEVER succeeded stays absent — merge never invents a value `prev` never had', () => {
    const prev = {}; // no cycle has ever succeeded for anything yet
    const next = {}; // this cycle failed for everything too
    const merged = mergeCloudFacts(prev, next);
    expect(merged.whoop).toBeUndefined();
    expect('whoop' in merged).toBe(false);
  });

  it('a later success updates a provider that was previously absent', () => {
    const prev: ReturnType<typeof mergeCloudFacts> = {}; // whoop never resolved before
    const next = { whoop: CONFIGURED_CONNECTED }; // now it does
    expect(mergeCloudFacts(prev, next)).toEqual({ whoop: CONFIGURED_CONNECTED });
  });

  it('end-to-end: loadConnectedHealthCloudFacts + mergeCloudFacts reproduces the exact B1 scenario — ' +
    'cycle 1 whoop connects, cycle 2 whoop times out, merged state still shows whoop connected', async () => {
    // Cycle 1: whoop resolves connected; strava's probe never resolves at
    // all (times out) on EITHER cycle — it has never once succeeded.
    vi.useFakeTimers();
    let cloud: ReturnType<typeof mergeCloudFacts> = {};
    try {
      const cycle1Promise = loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: (provider) => {
          if (provider === 'whoop') return Promise.resolve(CONFIGURED_CONNECTED);
          if (provider === 'strava') return new Promise(() => {}); // never resolves
          return Promise.resolve(NONE);
        },
        probeTimeoutMs: 5_000,
      });
      await vi.advanceTimersByTimeAsync(5_000);
      const cycle1 = await cycle1Promise;

      expect(cycle1.anyProbeFailed).toBe(true); // strava's timeout
      expect(cycle1.facts.whoop).toEqual(CONFIGURED_CONNECTED);
      expect(cycle1.facts.strava).toBeUndefined();
      cloud = mergeCloudFacts({}, cycle1.facts);
      expect(cloud.whoop).toEqual(CONFIGURED_CONNECTED);
      expect(cloud.strava).toBeUndefined();

      // Cycle 2: whoop's probe NOW times out (client-side failure to
      // complete) — a fresh regression, distinct from strava's ongoing one.
      // Everything else resolves honestly negative.
      const cycle2Promise = loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: (provider) => {
          if (provider === 'whoop' || provider === 'strava') return new Promise(() => {}); // never resolves
          return Promise.resolve(NONE);
        },
        probeTimeoutMs: 5_000,
      });
      await vi.advanceTimersByTimeAsync(5_000);
      const cycle2 = await cycle2Promise;

      expect(cycle2.anyProbeFailed).toBe(true);
      expect(cycle2.facts.whoop).toBeUndefined(); // omitted, never a fabricated dormant/disconnected guess

      // This is the exact merge the container performs in refreshCloudFacts.
      cloud = mergeCloudFacts(cloud, cycle2.facts);
    } finally {
      vi.useRealTimers();
    }

    // The B1 bug: whoop must NOT have downgraded to "dormant"/"not connected"
    // just because cycle 2's probe timed out. It must still read connected —
    // the previously-known fact, genuinely preserved (the offline banner now
    // reads "Couldn't check your connections just now — this list may be out
    // of date.", true in exactly this case).
    expect(cloud.whoop).toEqual(CONFIGURED_CONNECTED);
    // A sibling provider that never once succeeded across either cycle stays
    // genuinely absent, not coerced into any fallback value.
    expect(cloud.strava).toBeUndefined();
    // A later success (garmin resolved NONE both cycles — a real, honest
    // negative fact, correctly present throughout).
    expect(cloud.garmin).toEqual(NONE);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// #494 S-1 — applyProbeCycle: the container's actual, literal setCloud
// call-site helper (pinned by name in
// components/health/__tests__/connectedHealthContainer.render.test.tsx's
// source-text guard). Covered here at the function level for the same
// merge-semantics reasons as `mergeCloudFacts` above; the render-test file
// covers that the container really calls it.
// ─────────────────────────────────────────────────────────────────────────

describe('applyProbeCycle — the container\'s literal setCloud(prev => ...) wrapper', () => {
  it('delegates to mergeCloudFacts semantics: a resolved cycle wins over prior facts', () => {
    expect(applyProbeCycle({ whoop: CONFIGURED_CONNECTED }, { whoop: CONFIGURED_NONE })).toEqual({
      whoop: CONFIGURED_NONE,
    });
  });

  it('a provider omitted from this cycle (its probe failed) keeps its prior value — the actual B1 fix', () => {
    const prev = { whoop: CONFIGURED_CONNECTED };
    const thisCycleFacts = {}; // whoop's probe failed this cycle, omitted entirely
    expect(applyProbeCycle(prev, thisCycleFacts)).toEqual({ whoop: CONFIGURED_CONNECTED });
  });

  it('is exactly mergeCloudFacts, not a divergent copy', () => {
    const prev = { whoop: CONFIGURED_CONNECTED, garmin: CONFIGURED_NONE };
    const next = { garmin: CONFIGURED_CONNECTED };
    expect(applyProbeCycle(prev, next)).toEqual(mergeCloudFacts(prev, next));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// #494 S-2 — post-disconnect stale window
// ─────────────────────────────────────────────────────────────────────────

describe('dropCloudFact — immediate post-disconnect honesty (#494 S-2)', () => {
  it('drops a present cloud-probe provider key entirely', () => {
    const facts = { whoop: CONFIGURED_CONNECTED, garmin: CONFIGURED_NONE };
    const next = dropCloudFact(facts, 'whoop');
    expect('whoop' in next).toBe(false);
    expect(next.garmin).toEqual(CONFIGURED_NONE);
  });

  it('is a no-op when the provider key is already absent', () => {
    const facts = { garmin: CONFIGURED_NONE };
    expect(dropCloudFact(facts, 'whoop')).toEqual(facts);
  });

  it('is a no-op for a provider that is never cloud-probed at all (e.g. apple_health)', () => {
    const facts = { whoop: CONFIGURED_CONNECTED };
    expect(dropCloudFact(facts, 'apple_health')).toEqual(facts);
  });

  it('does not mutate the input object (pure)', () => {
    const facts = { whoop: CONFIGURED_CONNECTED };
    const next = dropCloudFact(facts, 'whoop');
    expect(facts.whoop).toEqual(CONFIGURED_CONNECTED); // original untouched
    expect(next).not.toBe(facts);
  });

  it('end-to-end: drop-then-failed-follow-up-cycle leaves the provider honestly absent, never stale-connected', async () => {
    // Cloud already shows whoop connected from a prior successful cycle.
    let cloud: ReturnType<typeof mergeCloudFacts> = { whoop: CONFIGURED_CONNECTED };

    // Disconnect succeeds: the container drops whoop's key immediately,
    // before the follow-up refresh even starts.
    cloud = dropCloudFact(cloud, 'whoop');
    expect('whoop' in cloud).toBe(false);

    // The follow-up refreshCloudFacts probe cycle then FAILS for whoop
    // (server hasn't caught up yet / bridge hiccup) — exactly the sequence
    // #494 S-2 flags. Pre-fix, nothing would have dropped the stale fact, so
    // this failed cycle's merge would have left "connected" in place.
    vi.useFakeTimers();
    try {
      const followUpPromise = loadConnectedHealthCloudFacts(NOW, {
        fetchCloudSignals: (provider) => {
          if (provider === 'whoop') return new Promise(() => {}); // never resolves
          return Promise.resolve(NONE);
        },
        probeTimeoutMs: 5_000,
      });
      await vi.advanceTimersByTimeAsync(5_000);
      const followUp = await followUpPromise;
      expect(followUp.anyProbeFailed).toBe(true);
      cloud = applyProbeCycle(cloud, followUp.facts);
    } finally {
      vi.useRealTimers();
    }

    // Honest absence, never stale-connected.
    expect(cloud.whoop).toBeUndefined();
    expect('whoop' in cloud).toBe(false);
  });
});

describe('performConnectedHealthDisconnect — fetch injected for tests', () => {
  it('unsupported providers resolve without ever calling a transport', async () => {
    const disconnectWhoop = vi.fn();
    const disconnectGarmin = vi.fn();
    const outcome = await performConnectedHealthDisconnect('oura', {
      disconnectWhoop: disconnectWhoop as never,
      disconnectGarmin: disconnectGarmin as never,
    });
    expect(outcome).toBe('unsupported');
    expect(disconnectWhoop).not.toHaveBeenCalled();
    expect(disconnectGarmin).not.toHaveBeenCalled();
  });

  it('whoop: ok ⇒ succeeded', async () => {
    const outcome = await performConnectedHealthDisconnect('whoop', {
      disconnectWhoop: async () => ({ status: 'ok' as const }),
    });
    expect(outcome).toBe('succeeded');
  });

  it('whoop: credentials_missing ⇒ skipped_not_connected', async () => {
    const outcome = await performConnectedHealthDisconnect('whoop', {
      disconnectWhoop: async () => ({ status: 'credentials_missing' as const }),
    });
    expect(outcome).toBe('skipped_not_connected');
  });

  it('whoop: a thrown/rejected call ⇒ failed, never propagates', async () => {
    const outcome = await performConnectedHealthDisconnect('whoop', {
      disconnectWhoop: async () => {
        throw new Error('network down');
      },
    });
    expect(outcome).toBe('failed');
  });

  it('garmin: ok ⇒ succeeded', async () => {
    const outcome = await performConnectedHealthDisconnect('garmin', {
      disconnectGarmin: async () => ({ status: 'ok' as const }),
    });
    expect(outcome).toBe('succeeded');
  });
});
