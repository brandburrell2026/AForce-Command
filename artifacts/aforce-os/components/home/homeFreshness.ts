/**
 * Home freshness — truthful "Checked …" resolver (RC-2 ruling E, item 1).
 *
 * FIXES A TRUTHFULNESS BUG: Home used to render a hardcoded
 * `t('home.v2.freshness')` = "Updated just now" UNCONDITIONALLY
 * (`HomeScreenV2.tsx`, no timestamp interpolation) — the claim was false
 * the instant any real time had passed since the data was actually pulled.
 *
 * SIGNAL CHOSEN — freshest biometrics `fetchedAt`:
 * Three candidate "real update" signals were traced against what
 * `HomeScreenV2` can genuinely read today:
 *   1. "Engine output update time" — does not exist. `ScoreEngineOutput`
 *      (`useEngineSlice()`) carries no timestamp of its own; the engine
 *      recomputes synchronously from `userState` at a few dispatch points
 *      (CYCLE_SUCCESS / REFRESH_ENGINE / SET_USER_STATE) with no persisted
 *      "when" stamped anywhere in `AppState`.
 *   2. "Last successful home fetch" — also does not exist. The 30s
 *      `/state` poll (`useAppStore.tsx`'s `refreshState`) never stamps a
 *      client-side "last successful fetch" field into the store.
 *   3. "Freshest biometrics fetchedAt" — REAL and already accessible:
 *      `AppleHealthInputs.fetchedAt` and every `ProviderSnapshot.fetchedAt`
 *      in `ProviderBiometrics` (`types/index.ts`) are genuine epoch-ms
 *      stamps of when that data was actually pulled, and both live on
 *      `UserState` — which `HomeScreenV2` already subscribes to via its
 *      existing `useUserSlice()` call. No new store field, no new slice
 *      subscription required.
 * (3) is also the only one of the three with real, non-fabricated backing
 * data today, and it matches the app's own established semantics: the
 * "Why This Command" evidence panel already ties a `LIVE`/`STALE`
 * `freshness` badge to biometric recency (`evidence.freshness.*`,
 * `evidence.item.biometrics`), so "how fresh is Home" and "how fresh is
 * the wearable data behind it" are already the same concept elsewhere in
 * this codebase.
 *
 * NEVER FABRICATES: when no wearable has ever synced (`fetchedAtMs` is
 * `null`), this returns the `unavailable` state — never a bogus age.
 * Mirrors the "never fabricate a freshness claim" doctrine already
 * established by `services/nightOut/commandPresentation.ts`'s
 * `freshnessLabel` (`ageMs == null` → "Waiting for fresher confirmed
 * signals", not a fabricated "just now").
 *
 * VERB UNIFICATION (founder-flagged Home-vs-Profile inconsistency, ruling
 * E — "your call which, apply consistently"): standardized on "Checked",
 * NOT "Updated" — deliberately deviating from the ticket's own example
 * copy. Reason: `docs/i18n/TRANSLATION-REVIEW.md`'s row for
 * `profile.v2.apple_updated_confirmation` documents that this exact swap
 * already happened once, on purpose — build 47 corrected that string FROM
 * "Updated just now" TO "Checked just now" specifically because a
 * HealthKit re-read usually returns byte-identical values, so "Updated"
 * asserted a change that (most of the time) did not happen; "Checked" only
 * claims the re-read occurred, which is always true when it fires. The
 * exact same fact holds here: a `fetchedAt` timestamp records when the app
 * last READ the provider, not that the underlying value changed at that
 * moment. Reverting Profile to "Updated" (to match the ticket's literal
 * example) would silently re-introduce the very truthfulness bug build 47
 * fixed and this whole ruling exists to close out elsewhere. "Checked" is
 * therefore the one verb applied to BOTH surfaces — see
 * `locales/en.json`'s `profile.v2.apple_updated_confirmation` (unchanged
 * at "Checked just now") and `home.v2.freshness.*` (new, below) for the
 * consistent result.
 *
 * Deterministic: every function takes `now` explicitly, never reads
 * `Date.now()` internally, so callers (and tests) fully control time.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AXIS POLICY (RC-2, #586 independent verdict items S2/S3 — closed here,
 * confirmed reachable by #595's merge of the two-axis provider contract):
 *
 * S2 — the resolver used to take max(`fetchedAt`) across providers and
 * ignore OBSERVATION time entirely, so a fresh sync of stale HealthKit data
 * ("nothing new in two days, but the app re-checked five minutes ago")
 * rendered as "Checked just now" — the exact flattering-timestamp inference
 * `services/health/providerPresentation.ts`'s honesty rule exists to forbid:
 * "gate on whichever axis is STALER — a fresh sync of an old observation
 * must never present as fresh" (Founder Ruling I). This file now applies the
 * same rule per provider, generalized over both axis shapes #595 shipped:
 *   - `ProviderSnapshot.fieldObservedAtMs` (per-FIELD observation times,
 *     populated today only by `apple_health` per that type's own doc
 *     comment, but read generically here for any future producer) — the
 *     provider's best observation is the MAX of whichever fields are
 *     present;
 *   - `ProviderSnapshot.latestObservedAtMs` / `AppleHealthInputs.latestObservedAtMs`
 *     (snapshot-level observation time) — used when no per-field map exists.
 * A provider's HONEST recency is then the CONSERVATIVE (staler / older) of
 * its `fetchedAt` and that best observation timestamp — mirroring
 * `resolveProviderPresentation`'s `Math.max(syncAgeMs, observedAgeMs)`
 * exactly, just expressed as `Math.min` on raw timestamps instead of
 * `Math.max` on derived ages (the same comparison; no `now` needed to make
 * it, so this stays independent of wall-clock time same as everything else
 * in this file). When a provider carries NO observation axis at all (every
 * server provider pre-Ruling-I, or any payload without a usable observation
 * stamp), this collapses to `fetchedAt` alone — unchanged, regression-locked
 * behavior, and an acceptable proxy on its own: post-#584
 * (`fix(api-server): preserve fetchedAt on unchanged provider sweeps`,
 * Ruling C) server sweeps stop restamping `fetchedAt` on every poll when the
 * payload is unchanged, so an untouched `fetchedAt` already means "data last
 * changed," not merely "last polled." The freshest of these per-provider
 * HONEST recencies (not raw `fetchedAt`s) is what wins the label — see
 * `freshestBiometricsFetchedAt` below.
 *
 * S3 — the ladder below (2min / 60min / 24h) is Home's own presentation
 * granularity and does not import `config/hydroStateModel.ts` (the
 * concurrent Stage-2 lane owns that file, and Home's minute-scale ladder is
 * deliberately finer than §53's hour-scale windows). It happens that Home's
 * existing day-bucket boundary — `hours < 24` above it, days at and beyond —
 * is IDENTICAL to §53's `FRESHNESS_WINDOWS.wearable_sync.staleAfterMs` (24h,
 * `config/hydroStateModel.ts`, read-only citation, not an import). That means
 * every case that reaches the days bucket is, by construction, already past
 * the §53 stale line for wearable data — so `resolveHomeFreshness` now names
 * that bucket `days_ago_stale` and mirrors the explicit, factual "stale"
 * word `services/health/connectedHealthView.ts`'s `sub_copy.stale` already
 * uses ("Connected — data is stale") instead of presenting a merely neutral
 * "Checked Nd ago". If `config/hydroStateModel.ts`'s threshold ever moves,
 * this citation (and the 24h literal in the ladder above it) must be
 * re-verified by hand — there is deliberately no shared import to keep the
 * two in sync automatically, per this fix's hard constraint.
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { AppleHealthInputs, ProviderBiometrics, ProviderSnapshot } from '@/types';

/** <2 min reads as "just now" — ruling E's explicit threshold. */
const JUST_NOW_THRESHOLD_MS = 2 * 60 * 1000;

export interface HomeFreshness {
  /** i18n key under `home.v2.freshness.*`. */
  key:
    | 'home.v2.freshness.just_now'
    | 'home.v2.freshness.minutes_ago'
    | 'home.v2.freshness.hours_ago'
    | 'home.v2.freshness.days_ago_stale'
    | 'home.v2.freshness.unavailable';
  /** Interpolation params for the graduated (count-bearing) keys. */
  params?: { count: number };
}

/**
 * Rejects the client-seeded merge-key sentinel (`fetchedAt: 0`, e.g.
 * ProfileScreenV2's WHOOP placeholder written before the real server
 * snapshot lands), any other `<= 0` stamp, and non-finite values — shared by
 * every timestamp this file considers (sync axis AND, per S2, the
 * observation axis) so both reject the same class of bad stamps identically.
 * See `resolveHomeFreshness` below for the matching guard on its own
 * `fetchedAtMs` parameter.
 */
function sanitizeTimestamp(candidate: number | null | undefined): number | null {
  if (candidate == null || !Number.isFinite(candidate) || candidate <= 0) return null;
  return candidate;
}

/**
 * Best available OBSERVATION timestamp for one `ProviderSnapshot` (S2):
 * prefer the freshest populated `fieldObservedAtMs` entry, falling back to
 * the snapshot-level `latestObservedAtMs`. Returns `null` when the snapshot
 * carries no observation axis at all.
 */
function bestObservationAtMs(snapshot: ProviderSnapshot): number | null {
  let best: number | null = null;
  if (snapshot.fieldObservedAtMs) {
    for (const candidate of Object.values(snapshot.fieldObservedAtMs)) {
      const sanitized = sanitizeTimestamp(candidate);
      if (sanitized != null && (best == null || sanitized > best)) best = sanitized;
    }
  }
  if (best != null) return best;
  return sanitizeTimestamp(snapshot.latestObservedAtMs);
}

/**
 * S2 fix: one provider's HONEST recency is the CONSERVATIVE (staler) of its
 * sync time and its best observation time — see this file's header "AXIS
 * POLICY" note for the full rationale and the `providerPresentation.ts`
 * parallel this mirrors. `observedAtMs` must already be sanitized (callers
 * pass the output of `bestObservationAtMs` / `sanitizeTimestamp`).
 */
function honestRecencyMs(
  fetchedAt: number | null | undefined,
  observedAtMs: number | null,
): number | null {
  const fetchedSanitized = sanitizeTimestamp(fetchedAt);
  if (observedAtMs == null) return fetchedSanitized;
  if (fetchedSanitized == null) return observedAtMs;
  // The staler (older / larger-age) of the two — expressed as `Math.min` on
  // raw timestamps, the timestamp-space equivalent of
  // `providerPresentation.ts`'s `Math.max(syncAgeMs, observedAgeMs)`.
  return Math.min(fetchedSanitized, observedAtMs);
}

/**
 * The freshest known HONEST biometrics recency across every connected
 * provider (`biometrics`) plus the legacy single-provider `appleHealth`
 * mirror (both can be populated independently — see `types/index.ts`'s
 * comment on `UserState.appleHealth` being "also mirrored into
 * biometrics.apple_health"). "Honest recency" (S2) is the conservative,
 * staler-axis value per provider — see this file's header — NOT the raw
 * `fetchedAt`. Returns `null` when nothing has ever synced; callers MUST
 * render the honest `unavailable` state in that case, never a fabricated
 * age.
 */
export function freshestBiometricsFetchedAt(
  appleHealth: Pick<AppleHealthInputs, 'fetchedAt' | 'latestObservedAtMs'> | null | undefined,
  biometrics: ProviderBiometrics | null | undefined,
): number | null {
  let freshest: number | null = null;
  const consider = (candidate: number | null) => {
    if (candidate == null) return;
    if (freshest == null || candidate > freshest) freshest = candidate;
  };

  if (appleHealth) {
    consider(honestRecencyMs(appleHealth.fetchedAt, sanitizeTimestamp(appleHealth.latestObservedAtMs)));
  }
  if (biometrics) {
    for (const snapshot of Object.values(biometrics)) {
      if (!snapshot) continue;
      consider(honestRecencyMs(snapshot.fetchedAt, bestObservationAtMs(snapshot)));
    }
  }
  return freshest;
}

/**
 * Bucket a fetch age into graduated, truthful copy. `now` is injected
 * (never `Date.now()`) so this stays deterministic under test.
 */
export function resolveHomeFreshness(now: number, fetchedAtMs: number | null): HomeFreshness {
  // `<= 0` catches the same sentinel/negative case as `freshestBiometricsFetchedAt`'s
  // `consider` guard above — kept here too because callers may pass a raw
  // provider `fetchedAt` (e.g. a single-provider check) straight into this
  // resolver without going through the aggregator first.
  if (fetchedAtMs == null || !Number.isFinite(fetchedAtMs) || fetchedAtMs <= 0) {
    return { key: 'home.v2.freshness.unavailable' };
  }

  const ageMs = Math.max(0, now - fetchedAtMs);
  if (ageMs < JUST_NOW_THRESHOLD_MS) {
    return { key: 'home.v2.freshness.just_now' };
  }

  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) {
    return { key: 'home.v2.freshness.minutes_ago', params: { count: minutes } };
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { key: 'home.v2.freshness.hours_ago', params: { count: hours } };
  }

  // S3 fix: `hours >= 24` here is, by construction, already past §53's
  // wearable_sync stale boundary (24h) — see this file's header "AXIS
  // POLICY" note. Named and worded as an explicit stale state (mirroring
  // `connectedHealthView.ts`'s `sub_copy.stale` copy/tone), never a merely
  // neutral "Checked Nd ago".
  const days = Math.floor(hours / 24);
  return { key: 'home.v2.freshness.days_ago_stale', params: { count: days } };
}
