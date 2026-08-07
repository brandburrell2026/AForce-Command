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
 */
import type { AppleHealthInputs, ProviderBiometrics } from '@/types';

/** <2 min reads as "just now" — ruling E's explicit threshold. */
const JUST_NOW_THRESHOLD_MS = 2 * 60 * 1000;

export interface HomeFreshness {
  /** i18n key under `home.v2.freshness.*`. */
  key:
    | 'home.v2.freshness.just_now'
    | 'home.v2.freshness.minutes_ago'
    | 'home.v2.freshness.hours_ago'
    | 'home.v2.freshness.days_ago'
    | 'home.v2.freshness.unavailable';
  /** Interpolation params for the graduated (count-bearing) keys. */
  params?: { count: number };
}

/**
 * The freshest known biometrics fetch time across every connected
 * provider (`biometrics`) plus the legacy single-provider `appleHealth`
 * mirror (both can be populated independently — see `types/index.ts`'s
 * comment on `UserState.appleHealth` being "also mirrored into
 * biometrics.apple_health"). Returns `null` when nothing has ever synced;
 * callers MUST render the honest `unavailable` state in that case, never a
 * fabricated age.
 */
export function freshestBiometricsFetchedAt(
  appleHealth: Pick<AppleHealthInputs, 'fetchedAt'> | null | undefined,
  biometrics: ProviderBiometrics | null | undefined,
): number | null {
  let freshest: number | null = null;
  const consider = (candidate: number | null | undefined) => {
    if (candidate == null || !Number.isFinite(candidate)) return;
    if (freshest == null || candidate > freshest) freshest = candidate;
  };

  consider(appleHealth?.fetchedAt);
  if (biometrics) {
    for (const snapshot of Object.values(biometrics)) {
      consider(snapshot?.fetchedAt);
    }
  }
  return freshest;
}

/**
 * Bucket a fetch age into graduated, truthful copy. `now` is injected
 * (never `Date.now()`) so this stays deterministic under test.
 */
export function resolveHomeFreshness(now: number, fetchedAtMs: number | null): HomeFreshness {
  if (fetchedAtMs == null || !Number.isFinite(fetchedAtMs)) {
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

  const days = Math.floor(hours / 24);
  return { key: 'home.v2.freshness.days_ago', params: { count: days } };
}
