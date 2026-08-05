/**
 * Internal Cohort — overlay contract module.
 *
 * PR 1 of `docs/health/rollout/INTERNAL-COHORT-DESIGN.md` (r2). Pure types and
 * pure functions only: zero schema, zero DB, zero routes, and zero imports
 * from anywhere in app code. This file is dead code until PR 3 (server read
 * endpoint) and PR 6 (client hook) import it — see §10.2 for the PR sequence.
 *
 * Four contract properties, each killing a specific failure (§6):
 *   - ON-only        (§6.1)   — an overlay may only flip false -> true.
 *   - Allow-listed    (§6.2)   — only keys in INTERNAL_PREVIEW_OVERLAYABLE_FLAGS
 *                                 are reachable, enforced here as the client-side
 *                                 leg of the three-times-enforced allow-list.
 *   - Versioned       (§6.3)   — a contractVersion mismatch discards the whole
 *                                 overlay rather than partially applying it.
 *   - 15-minute TTL   (§6.4)   — an expired overlay is inert; this module owns
 *                                 correctness of the value (fail-closed on a
 *                                 fresh computation). It does NOT own timeliness
 *                                 of the render — the timer + foreground re-check
 *                                 that trigger a fresh computation are client
 *                                 hook responsibilities (§6.4.1, PR 6).
 */

import type { FeatureFlags } from '../types';

/**
 * Server contract version this binary understands. Bumped only for a semantic
 * change to grant evaluation (§6.3) — adding a new key to
 * INTERNAL_PREVIEW_OVERLAYABLE_FLAGS is NOT a version bump.
 */
export const OVERLAY_CONTRACT_VERSION = 1;

/**
 * The full allow-list (§6.2). Enforced three times by design: on write
 * (`PUT …/flags/:flagKey`), on read before serialisation, and here, on the
 * client — so a compromised or rolled-forward server cannot set a flag this
 * binary never intended to expose.
 *
 * `health_canonical_consumers` is deliberately OMITTED: it is pending D-5
 * (§13, §6.2) — a founder decision on whether it belongs on this list at all,
 * since it changes which signals downstream surfaces read rather than merely
 * gating presentation. PR 1 ships without it; adding it later is not a
 * contract-version bump (§6.3).
 *
 * `night_out_enabled` IS listed, per §6.2, so PR 7 needs no contract change —
 * it has no consumer of `effectiveFlags` until PR 7 ships, which is separately
 * 🚫 blocked on founder decision D-2 (§10.2). Nothing in this module, or in any
 * PR before 7, may import from or change `services/nightOut/access.ts`.
 */
export const INTERNAL_PREVIEW_OVERLAYABLE_FLAGS = [
  'health_apple_enabled',
  'health_google_connect_enabled',
  'health_whoop_enabled',
  'health_oura_enabled',
  'health_strava_enabled',
  'health_garmin_enabled',
  'health_samsung_direct_enabled',
  'night_out_enabled',
] as const;

export type OverlayableFlagKey = (typeof INTERNAL_PREVIEW_OVERLAYABLE_FLAGS)[number];

const OVERLAYABLE_FLAG_SET: ReadonlySet<string> = new Set(INTERNAL_PREVIEW_OVERLAYABLE_FLAGS);

/** One of the seven provider readiness stages a provider can be in (§4.5). */
export type ProviderStage = 'blocked' | 'internal' | 'beta' | 'ga';

/**
 * The overlay as parsed from `GET /api/internal-preview/overlay` (§5.1). Wire
 * shape carries `issuedAt` / `expiresAt` as ISO strings; the client is
 * expected to convert to epoch ms once, at parse time (`receivedAtMs`,
 * `expiresAtMs`), so `applyInternalPreviewOverlay` never re-parses a date and
 * never compares against device wall-clock drift on every call (§6.4).
 *
 * Deliberately has NO `providerStages` field. The stage clamp is server-side,
 * applied before serialisation, and the map itself is founder-only (§4.5.1).
 * `ProviderStage` stays exported from this module for the server and the
 * founder admin surface; it never lands in this interface.
 */
export interface InternalPreviewOverlay {
  contractVersion: number;
  /** ms epoch, captured from the response at parse time. */
  receivedAtMs: number;
  /** ms epoch derived from (receivedAtMs + serverTtlMs). Never raw expiresAt. */
  expiresAtMs: number;
  cohorts: readonly string[];
  grants: readonly OverlayableFlagKey[];
}

/**
 * Client-side fetch/derivation state (§7). Defined here, alongside the wire
 * contract it is built from, so PR 6 needs no interface redesign — the same
 * reason `night_out_enabled` is already on the allow-list above. Unused by
 * this PR: no reducer, no hook, and no store wiring exist yet.
 */
export interface InternalPreviewState {
  status:
    | 'idle' // not signed in / never fetched
    | 'loading'
    | 'active' // overlay held, not expired
    | 'none' // fetched OK, caller is not in any cohort
    | 'expired' // TTL elapsed, refresh not yet succeeded
    | 'contract_mismatch' // §6.3 — hard fallback to base
    | 'unavailable'; // network/server error, no usable overlay
  overlay: InternalPreviewOverlay | null;
  lastFetchAtMs: number | null;
  lastError: 'network' | 'unauthorized' | 'server' | 'contract' | null;
  /** Count of grant keys the server sent that this binary does not know. Telemetry only. */
  unknownGrantCount: number;
}

/**
 * Reduces `overlay.grants` to the keys that are actually eligible to flip a
 * flag: on the allow-list (§6.2) AND not already `true` in `base`. Order is
 * not guaranteed by the wire format (§5.1) so this makes no assumption about it.
 */
function surviving(base: FeatureFlags, overlay: InternalPreviewOverlay): OverlayableFlagKey[] {
  const out: OverlayableFlagKey[] = [];
  for (const key of overlay.grants) {
    if (!OVERLAYABLE_FLAG_SET.has(key)) continue; // client-side allow-list leg (§6.2)
    if (base[key as keyof FeatureFlags] === true) continue; // already on — nothing to flip
    out.push(key);
  }
  return out;
}

/**
 * Applies a (possibly null) internal-preview overlay on top of `base`.
 *
 * Contract (§6.1.1, normative): MUST return `base` **by reference**
 * (`result === base`) whenever it would produce no change, and MUST allocate
 * a new object only when at least one key actually flips false -> true. It
 * never mutates `base`. This is a performance-correctness requirement — see
 * the module doc comment and §6.1.1 for why an allocate-every-call
 * implementation would force a re-render on every poll for ~100% of users who
 * are not cohort members.
 *
 * The no-change cases, exhaustively (§6.1.1) — each returns `base` itself:
 *   - `overlay === null`
 *   - expired: `nowMs >= overlay.expiresAtMs`
 *   - contract mismatch: `overlay.contractVersion !== OVERLAY_CONTRACT_VERSION`
 *   - empty after filtering: no granted key survives the allow-list
 *   - already on: every surviving granted key is already `true` in `base`
 *
 * Implementation is a union, not a merge (§6.1): for each surviving key, set
 * `true`. Nothing else is written — there is no path in this function that
 * can set a flag to `false`.
 */
export function applyInternalPreviewOverlay(
  base: FeatureFlags,
  overlay: InternalPreviewOverlay | null,
  nowMs: number,
): FeatureFlags {
  if (overlay === null) return base;
  if (overlay.contractVersion !== OVERLAY_CONTRACT_VERSION) return base;
  if (nowMs >= overlay.expiresAtMs) return base;

  const toFlip = surviving(base, overlay);
  if (toFlip.length === 0) return base;

  const patch = Object.fromEntries(toFlip.map((key) => [key, true])) as Partial<FeatureFlags>;
  return { ...base, ...patch };
}

/**
 * The stage clamp (§4.5, §4.5.1, §4.5.2), as a pure predicate over the
 * `enabledFlag` half of the formula — the `enabled` INPUT to
 * `resolveHealthProviderStatus`, not the full `offersConnect` conjunction
 * (platform / link / integrationReady / approval live in
 * `utils/health/providerRowStatus.ts` and are untouched by this PR).
 *
 * ```
 * enabledFlag(provider, user) =
 *     stage(provider) == 'ga'
 *   ∨ (stage(provider) ∈ {'internal','beta'} ∧ userHasLiveGrant(healthFlagFor(provider)))
 * ```
 *
 * `'blocked'` always returns `false` regardless of grant — a grant cannot
 * manufacture a connection that cannot exist (§4.5 stage table). This
 * function has no caller in this PR: the clamp is wired into the read
 * endpoint's serialisation in PR 5, server-side only, per §4.5.1 — a
 * `providerStages` value is never shipped to the client for this or any
 * other purpose.
 */
export function isProviderGrantHonoured(stage: ProviderStage, hasLiveGrant: boolean): boolean {
  switch (stage) {
    case 'ga':
      return true;
    case 'internal':
    case 'beta':
      return hasLiveGrant;
    case 'blocked':
      return false;
  }
}
