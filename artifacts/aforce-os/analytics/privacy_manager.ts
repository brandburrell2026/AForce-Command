/**
 * Privacy manager — the app's view onto consent and pseudonymous identity for
 * the INTERNAL analytics pipeline.
 *
 * ── WHAT CHANGED, AND WHY IT MATTERS ───────────────────────────────────────
 *
 * This module used to be the authority: it MINTED the pseudonymous
 * `analytics_id` locally (`newId("anon")`) and it asserted its own local
 * consent record as operative truth. Both are gone.
 *
 *   - The pseudonym is now ISSUED BY THE SERVER. A locally minted id is a
 *     second identity authority: reinstalls and multiple devices each invent
 *     their own, so one member becomes several, and a member who asked to be
 *     forgotten gets a brand-new identity on the next launch — silently
 *     re-enrolled. The server mints exactly one per member and can retire it.
 *
 *   - Consent is now the SERVER'S state, adopted, with a local ceiling that
 *     can only RESTRICT. A device holding a stale local grant could otherwise
 *     keep collecting after the member revoked on another device.
 *
 * Both now live in `consentAuthority`. This module is the stable façade the
 * rest of the app already imports — same function names, same signatures — so
 * the trackers and the settings row keep working while the authority moves.
 *
 * ── THE LEGACY KEYS ARE READ, NEVER WRITTEN, AND NEVER PURGED ──────────────
 *
 * `@aforce/analytics-id` (the old local mint) is not read as an identity and
 * not deleted: deletion is PR D's migration decision, not this lane's.
 *
 * `@aforce/analytics-consent` (the old local record) is read for ONE narrow
 * purpose — answering "has this member ever been asked?" so an offline launch
 * does not re-prompt someone who already decided. It can never open
 * collection: `isConsentGranted` does not consult it.
 */
import { scopedStorage } from '@/services/scopedStorage';
import { subscribeScopeState } from '@/services/userScope';

import { forgetAnalyticsIdentity } from '@/lib/api';

import {
  DISCLOSURE_VERSION,
  clearLocalAuthorityState,
  consentUiState,
  requestErasureCeiling,
  getServerAnalyticsId,
  isEffectivelyGranted,
  recordDecision,
  reconcile,
  retryPendingDecision,
  subscribeConsentState,
  type ConsentUiState,
  type DecisionOutcome,
} from './consentAuthority';

/** The legacy local consent record. Read for prompt suppression only. */
const CONSENT_KEY = '@aforce/analytics-consent';

/**
 * Bump when the consent disclosure text materially changes.
 *
 * Re-exported from the authority so there is ONE version of record. The server
 * stores it as evidence of what the member agreed to, so a second definition
 * here could make the evidence disagree with the disclosure shown.
 */
export const CONSENT_VERSION = DISCLOSURE_VERSION;

export type { ConsentUiState, DecisionOutcome };

interface LegacyConsentRecord {
  granted: boolean;
  version: number;
  updatedAt: string;
}

let legacyAnsweredCache: boolean | null = null;

/**
 * The effective consent gate: the server's adopted state with the local
 * ceiling applied. The single definition every emit and pre-check uses.
 */
export async function isConsentGranted(): Promise<boolean> {
  return isEffectivelyGranted();
}

/**
 * Whether the member has answered the consent prompt at all, for UI that
 * decides whether to ASK. Never a collection gate.
 *
 * Prefers the server's answer (`decisionSeq !== null` means a real decision is
 * on record). Falls back to the legacy local record only when the server has
 * not answered yet — an offline launch should not re-interrogate a member who
 * already decided on a previous build.
 */
export async function hasAnsweredConsent(): Promise<boolean> {
  const ui = await consentUiState();
  if (ui.status === 'settled') return ui.answered;
  if (ui.status === 'pending' || ui.status === 'needs_resolution') return true;
  return readLegacyAnswered();
}

async function readLegacyAnswered(): Promise<boolean> {
  if (legacyAnsweredCache !== null) return legacyAnsweredCache;
  try {
    const raw = await scopedStorage.getItem(CONSENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LegacyConsentRecord>;
      legacyAnsweredCache = typeof parsed.granted === 'boolean';
      return legacyAnsweredCache;
    }
  } catch {
    /* non-fatal */
  }
  legacyAnsweredCache = false;
  return false;
}

/**
 * Grant consent.
 *
 * Returns the decision outcome rather than an id, because there is no id to
 * hand back until the SERVER issues one — and a grant may legitimately be
 * `queued` (offline) or `needs_resolution` (deterministically refused). The
 * old signature returned `Promise<string>` and could only do so by minting.
 */
export async function grantConsent(): Promise<DecisionOutcome> {
  return recordDecision('grant');
}

/**
 * Revoke consent.
 *
 * Operative immediately and locally, even offline: the pending revoke is the
 * ceiling, so emission stops before the server is told. Existing local/queued
 * data is left untouched — `deleteMyData` is the erase path.
 */
export async function revokeConsent(): Promise<DecisionOutcome> {
  return recordDecision('revoke');
}

/**
 * The pseudonymous id, or null when the server has not issued one (or consent
 * is not effectively granted). NEVER mints — that is the point of this lane.
 */
export async function getAnalyticsId(): Promise<string | null> {
  return getServerAnalyticsId();
}

/** Resolve identity and consent against the server. Call on start/foreground. */
export async function syncAnalyticsAuthority(): Promise<void> {
  return reconcile();
}

/** What the consent UI should render, including the `needs_resolution` state. */
export async function getConsentUiState(): Promise<ConsentUiState> {
  return consentUiState();
}

/** Re-render hook for the consent UI. */
export { subscribeConsentState };

/**
 * The member's explicit retry out of `needs_resolution`.
 *
 * Deliberately the ONLY route out of that state: nothing in the app may
 * auto-retry a decision the server has deterministically refused, or the
 * device POSTs the same impossible request on every foreground forever.
 */
export { retryPendingDecision };

/**
 * delete-my-data. Asks the server to erase every row for this member, then
 * drops the local authority state and the queued outbox.
 *
 * No pseudonym is sent: S1-3 resolves the caller's own id server-side. That is
 * what makes erasure possible for a member whose local cache is empty — under
 * the old local-mint model a missing id meant the call was skipped entirely.
 */
export async function deleteMyData(
  clearOutbox: () => Promise<void>,
): Promise<{ serverDeleted: number }> {
  // ── THE CEILING GOES UP FIRST, AND DURABLY ──
  //
  // The previous shape cleared local state in a `finally`, so a network or
  // server failure produced exactly this:
  //
  //   delete requested -> server failure -> local state cleared -> the next
  //   reconcile re-adopts the server's untouched grant -> analytics resumes,
  //   and the settings switch visibly flips itself back ON
  //
  // for a member who asked to be erased, with no error shown. Raising a
  // durable restrictive ceiling before the request removes the thing that
  // re-adoption needed: there is nothing left to re-adopt over, and the record
  // survives a restart.
  await requestErasureCeiling();

  // Queued events are the member's own data and they asked for it gone. This
  // is safe on both paths — the gate is closed either way, so nothing is
  // collected to replace them.
  await clearOutbox();
  legacyAnsweredCache = null;

  // Not caught. A failure must reach the caller so the UI can say so; the
  // ceiling raised above is what keeps analytics closed until it is resolved.
  const result = await forgetAnalyticsIdentity();

  // CONFIRMED erased. Only now is it safe to drop the local authority state —
  // and `clearLocalAuthorityState` marks the identity suppressed, so the UI
  // renders the terminal state rather than offering an impossible retry.
  await clearLocalAuthorityState();
  return { serverDeleted: result.deleted };
}

// Wave-3 PR12: a user-scope change is a security boundary — this module cached
// the previous member's answer. The authority resets its own state on the same
// signal; this clears the legacy prompt-suppression cache.
//
// `subscribeScopeState`, NOT `subscribeUserScope`: the latter fires only when
// the effective storage NAMESPACE changes, and while
// `per_user_storage_isolation_enabled` is false that namespace is null for
// every state — so on today's production configuration an A→B account switch
// fired those listeners ZERO times and this reset never ran.
subscribeScopeState(() => {
  legacyAnsweredCache = null;
});
