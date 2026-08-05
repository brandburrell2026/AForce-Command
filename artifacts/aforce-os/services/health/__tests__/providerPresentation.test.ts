import { describe, it, expect } from 'vitest';
import { resolveProviderPresentation } from '../providerPresentation';
import type { HealthProviderStatus } from '@/utils/health/healthProviderStatus';

const NOW = 1_754_000_000_000;
const H = 3_600_000;

const connected: HealthProviderStatus = { status: 'connected', connectable: false, live: true, showDemo: false };
const disconnected: HealthProviderStatus = { status: 'connect', connectable: true, live: false, showDemo: false };
const comingSoon: HealthProviderStatus = { status: 'coming_soon', connectable: false, live: false, showDemo: false };
const approval: HealthProviderStatus = { status: 'approval_pending', connectable: false, live: false, showDemo: false };
const viaHc: HealthProviderStatus = { status: 'available_through_health_connect', connectable: false, live: false, showDemo: false };
const syncing: HealthProviderStatus = { status: 'syncing', connectable: false, live: true, showDemo: false };

describe('freshness boundaries (§53 wearable_sync: stale >24h, expired >72h)', () => {
  it('connected + fresh data (≤24h) → connected, live', () => {
    const p = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 6 * H, nowMs: NOW });
    expect(p).toEqual({ state: 'connected', live: true, dataAgeMs: 6 * H });
  });

  it('connected + stale data (>24h) → stale, NOT live — a stale snapshot is never presented as connected/live', () => {
    const p = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 30 * H, nowMs: NOW });
    expect(p.state).toBe('stale');
    expect(p.live).toBe(false);
  });

  it('connected + expired data (>72h) → no_recent_data, NOT live', () => {
    const p = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 100 * H, nowMs: NOW });
    expect(p.state).toBe('no_recent_data');
    expect(p.live).toBe(false);
  });

  it('boundary exactness: 24h is not yet stale; 72h is not yet expired', () => {
    expect(resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 24 * H, nowMs: NOW }).live).toBe(true);
    expect(resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 72 * H, nowMs: NOW }).state).toBe('stale');
  });

  it('syncing with no snapshot yet stays honest first-pull (live syncing, no age)', () => {
    const p = resolveProviderPresentation({ status: syncing, latestFetchedAtMs: null, nowMs: NOW });
    expect(p).toEqual({ state: 'syncing', live: true, dataAgeMs: null });
  });
});

describe('freshness never UPGRADES a status', () => {
  it('disconnected with a fresh leftover snapshot stays disconnected, never live', () => {
    const p = resolveProviderPresentation({ status: disconnected, latestFetchedAtMs: NOW - 1 * H, nowMs: NOW });
    expect(p.state).toBe('disconnected');
    expect(p.live).toBe(false);
  });
});

describe('vocabulary mapping to canonical presentation states', () => {
  it('coming_soon → dormant; approval_pending → requires_external_approval; HC routing preserved', () => {
    expect(resolveProviderPresentation({ status: comingSoon, latestFetchedAtMs: null, nowMs: NOW }).state).toBe('dormant');
    expect(resolveProviderPresentation({ status: approval, latestFetchedAtMs: null, nowMs: NOW }).state).toBe('requires_external_approval');
    expect(resolveProviderPresentation({ status: viaHc, latestFetchedAtMs: null, nowMs: NOW }).state).toBe('via_health_connect');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Founder Ruling I (RC-2, part 2): "Observation freshness and sync
// freshness must be displayed separately and truthfully." Part 1 (#562)
// added the optional, additive `ProviderSnapshot.latestObservedAtMs`; this
// suite pins how THIS layer consumes it — conservative (staler-wins)
// selection for STATE, plus the absent-field parity contract that makes
// every test above still valid unmodified.
// ─────────────────────────────────────────────────────────────────────────
describe('Ruling I — observation freshness axis (optional, additive)', () => {
  it('PARITY (mutation-verify): an absent latestObservedAtMs produces an object with EXACTLY the pre-Ruling-I keys', () => {
    const p = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 6 * H, nowMs: NOW });
    // A toEqual against the 3-key shape (as every pre-existing test above
    // already does) would silently pass even if extra `undefined`-valued
    // keys leaked in under some JS engines' enumeration quirks; this
    // explicit key-set assertion is the one that actually fails if
    // `withObservationAxis` is ever changed to always attach the extra
    // fields instead of omitting them for an absent axis.
    expect(Object.keys(p).sort()).toEqual(['dataAgeMs', 'live', 'state']);
    expect(p).toEqual({ state: 'connected', live: true, dataAgeMs: 6 * H });
  });

  it('PARITY: null and non-finite latestObservedAtMs are treated identically to absent — never fabricated', () => {
    const withNull = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 6 * H, latestObservedAtMs: null, nowMs: NOW });
    const withNaN = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 6 * H, latestObservedAtMs: NaN, nowMs: NOW });
    expect(Object.keys(withNull).sort()).toEqual(['dataAgeMs', 'live', 'state']);
    expect(Object.keys(withNaN).sort()).toEqual(['dataAgeMs', 'live', 'state']);
  });

  it('DELAYED-SYNC SCENARIO: fresh sync + old observation ⇒ the STALER (observation) axis wins — never presents fresh', () => {
    const p = resolveProviderPresentation({
      status: connected,
      latestFetchedAtMs: NOW - 10 * 60_000, // synced 10 minutes ago
      latestObservedAtMs: NOW - 30 * H,     // but the underlying observation is 30h old
      nowMs: NOW,
    });
    expect(p.state).toBe('stale');
    expect(p.live).toBe(false);
    expect(p.dataAgeMs).toBe(30 * H); // conservative (staler) age drives the state
    expect(p.observedAgeMs).toBe(30 * H);
    expect(p.showBothFreshnessAxes).toBe(true); // 10m (live bucket) vs 30h (stale bucket) genuinely differ
  });

  it('DELAYED-SYNC SCENARIO, expired: fresh sync + expired observation ⇒ no_recent_data, never fresh', () => {
    const p = resolveProviderPresentation({
      status: connected,
      latestFetchedAtMs: NOW - 5 * 60_000,
      latestObservedAtMs: NOW - 100 * H,
      nowMs: NOW,
    });
    expect(p.state).toBe('no_recent_data');
    expect(p.live).toBe(false);
    expect(p.dataAgeMs).toBe(100 * H);
  });

  it('symmetry boundary: an old sync age still wins over a fresher observation age (true max(), not axis-order bias)', () => {
    const p = resolveProviderPresentation({
      status: connected,
      latestFetchedAtMs: NOW - 30 * H,
      latestObservedAtMs: NOW - 10 * 60_000,
      nowMs: NOW,
    });
    expect(p.state).toBe('stale');
    expect(p.dataAgeMs).toBe(30 * H);
    expect(p.showBothFreshnessAxes).toBe(true);
  });

  it('DISPLAY THRESHOLD: both axes in the same §53 bucket ⇒ showBothFreshnessAxes is false (no clutter)', () => {
    const p = resolveProviderPresentation({
      status: connected,
      latestFetchedAtMs: NOW - 5 * 60_000,
      latestObservedAtMs: NOW - 10 * 60_000,
      nowMs: NOW,
    });
    expect(p.showBothFreshnessAxes).toBe(false);
    expect(p.state).toBe('connected');
    expect(p.live).toBe(true);
  });

  it('DISPLAY THRESHOLD: both axes stale-bucket together ⇒ showBothFreshnessAxes is false even though state is stale', () => {
    const p = resolveProviderPresentation({
      status: connected,
      latestFetchedAtMs: NOW - 25 * H,
      latestObservedAtMs: NOW - 26 * H,
      nowMs: NOW,
    });
    expect(p.state).toBe('stale');
    expect(p.showBothFreshnessAxes).toBe(false);
  });

  // #565 verdict SF-1: pins the fresh/stale BOUNDARY itself, not just "same
  // bucket" in general. Every existing "same bucket" case above (5m vs 10m;
  // 25h vs 26h) keeps both ages on the SAME side of `freshUntilMs` (6h) too,
  // so a mutant that swapped `freshnessBucket`'s comparison from
  // `staleAfterMs` (24h) to `freshUntilMs` (6h) would still pass all of
  // them — it only shows up once one age sits on each side of 6h while both
  // stay under 24h. 1h and 10h are exactly that pair: genuinely different
  // relative to `freshUntilMs`, genuinely the SAME §53 bucket (0 — live/
  // fresh-enough, since the state-gating boundary is `staleAfterMs`, not
  // `freshUntilMs`) relative to the boundary this function actually gates
  // on. Correct behavior: showBothFreshnessAxes === false. A
  // staleAfterMs→freshUntilMs mutation flips this to true.
  it('BOUNDARY PIN (mutation-verify): 1h sync + 10h observed straddle freshUntilMs (6h) but share the staleAfterMs (24h) bucket ⇒ showBothFreshnessAxes is false', () => {
    const p = resolveProviderPresentation({
      status: connected,
      latestFetchedAtMs: NOW - 1 * H,
      latestObservedAtMs: NOW - 10 * H,
      nowMs: NOW,
    });
    expect(p.state).toBe('connected');
    expect(p.live).toBe(true);
    expect(p.dataAgeMs).toBe(10 * H); // conservative (staler) axis still wins for the age itself
    expect(p.observedAgeMs).toBe(10 * H);
    expect(p.showBothFreshnessAxes).toBe(false);
  });

  it('a non-live base status still carries the observation axis (informational), never upgrading liveness', () => {
    const p = resolveProviderPresentation({
      status: disconnected,
      latestFetchedAtMs: NOW - 1 * H,
      latestObservedAtMs: NOW - 40 * H,
      nowMs: NOW,
    });
    expect(p.state).toBe('disconnected');
    expect(p.live).toBe(false);
    expect(p.observedAgeMs).toBe(40 * H);
    expect(p.showBothFreshnessAxes).toBe(true);
  });

  it('observation axis present but sync axis null (never synced) ⇒ observation age alone is the conservative age', () => {
    const p = resolveProviderPresentation({
      status: connected,
      latestFetchedAtMs: null,
      latestObservedAtMs: NOW - 50 * H,
      nowMs: NOW,
    });
    expect(p.dataAgeMs).toBe(50 * H);
    expect(p.state).toBe('stale');
    // syncAgeMs is null here, so there is nothing to meaningfully "differ"
    // against — showBothFreshnessAxes requires BOTH axes known.
    expect(p.showBothFreshnessAxes).toBe(false);
  });
});
