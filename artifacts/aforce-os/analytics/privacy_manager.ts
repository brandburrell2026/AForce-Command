/**
 * Privacy manager — consent and pseudonymous identity for the INTERNAL
 * analytics pipeline.
 *
 * PRIVACY BEFORE COLLECTION: nothing is collected or sent until the
 * user has explicitly granted consent. The pseudonymous `analytics_id`
 * is created only at consent time and is never the Clerk user id, so
 * stored analytics cannot be trivially tied to a person. The user can
 * delete all their analytics data at any time (delete-my-data), which
 * also revokes consent and clears the local outbox.
 *
 * Persistence mirrors the rest of the app: `@aforce/*` AsyncStorage
 * keys, best-effort (storage failures are non-fatal).
 */
import { scopedStorage } from '@/services/scopedStorage';
import { subscribeUserScope } from '@/services/userScope';

import { forgetAnalytics } from "@/lib/api";

import { newId } from "./event_envelope";

const CONSENT_KEY = "@aforce/analytics-consent";
const ANALYTICS_ID_KEY = "@aforce/analytics-id";

/** Bump when the consent disclosure text materially changes. */
export const CONSENT_VERSION = 1;

interface ConsentRecord {
  granted: boolean;
  version: number;
  updatedAt: string;
}

let consentCache: ConsentRecord | null = null;
let analyticsIdCache: string | null = null;

async function readConsent(): Promise<ConsentRecord | null> {
  if (consentCache) return consentCache;
  try {
    const raw = await scopedStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (typeof parsed.granted === "boolean") {
      consentCache = {
        granted: parsed.granted,
        version: typeof parsed.version === "number" ? parsed.version : 0,
        updatedAt:
          typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : new Date(0).toISOString(),
      };
      return consentCache;
    }
  } catch {
    /* non-fatal */
  }
  return null;
}

async function writeConsent(record: ConsentRecord): Promise<void> {
  consentCache = record;
  try {
    await scopedStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    /* non-fatal — in-memory cache still gates this session */
  }
}

/** True only after an explicit, current grant. The single gate every
 *  emit checks before doing anything. */
export async function isConsentGranted(): Promise<boolean> {
  const c = await readConsent();
  return Boolean(c?.granted);
}

/** Whether the user has answered the consent prompt at all (for UI that
 *  decides whether to show it). */
export async function hasAnsweredConsent(): Promise<boolean> {
  const c = await readConsent();
  return c !== null;
}

/**
 * Grant consent and ensure a pseudonymous analytics id exists. Returns
 * the id so the caller can emit the first `consent_granted` event.
 */
export async function grantConsent(): Promise<string> {
  await writeConsent({
    granted: true,
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
  });
  return ensureAnalyticsId();
}

/** Revoke consent. Stops all future emission; existing local/queued
 *  data is left untouched (use deleteMyData to also erase it). */
export async function revokeConsent(): Promise<void> {
  await writeConsent({
    granted: false,
    version: CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
  });
}

/** The pseudonymous id, or null if consent has never been granted. */
export async function getAnalyticsId(): Promise<string | null> {
  if (analyticsIdCache) return analyticsIdCache;
  try {
    const existing = await scopedStorage.getItem(ANALYTICS_ID_KEY);
    if (existing && existing.length >= 8) {
      analyticsIdCache = existing;
      return existing;
    }
  } catch {
    /* non-fatal */
  }
  return null;
}

/** Get the pseudonymous id, creating one if absent. Only call from the
 *  consent path — emission paths use getAnalyticsId + the consent gate. */
export async function ensureAnalyticsId(): Promise<string> {
  const existing = await getAnalyticsId();
  if (existing) return existing;
  const fresh = newId("anon");
  analyticsIdCache = fresh;
  try {
    await scopedStorage.setItem(ANALYTICS_ID_KEY, fresh);
  } catch {
    /* non-fatal — in-memory id still works for this session */
  }
  return fresh;
}

/**
 * delete-my-data. Asks the server to erase every row for this id, then
 * revokes consent and wipes the local id + queued outbox. Best-effort
 * on the network call: if it fails we still clear locally and surface
 * the error to the caller.
 */
export async function deleteMyData(
  clearOutbox: () => Promise<void>,
): Promise<{ serverDeleted: number }> {
  const id = await getAnalyticsId();
  let serverDeleted = 0;
  try {
    if (id) {
      const result = await forgetAnalytics(id);
      serverDeleted = result.deleted;
    }
  } finally {
    await revokeConsent();
    await clearOutbox();
    analyticsIdCache = null;
    try {
      await scopedStorage.removeItem(ANALYTICS_ID_KEY);
    } catch {
      /* non-fatal */
    }
  }
  return { serverDeleted };
}

// Wave-3 PR12: a user-scope change is a security boundary — the module
// caches previously served USER A's grant (and pseudonymous id) to USER
// B's session. Reset to unread; the next read hydrates the new scope.
subscribeUserScope(() => {
  consentCache = null;
  analyticsIdCache = null;
});
