/**
 * AForce OS API client.
 *
 * Provides a typed fetch wrapper for talking to the @workspace/api-server.
 * Identifies the device via a persistent `deviceId` (random uuid stored in
 * AsyncStorage on first launch). Every request includes it as `x-device-id`.
 *
 * URL resolution:
 *   - Web (Expo on web preview): same-origin /api  (the workspace proxy
 *     routes /api → the api-server artifact).
 *   - Native dev: https://$EXPO_PUBLIC_DOMAIN/api  (same proxy, absolute).
 *   - Native prod: same as dev — EXPO_PUBLIC_DOMAIN is baked at build.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./apiBase";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "aforce.deviceId";

let cachedDeviceId: string | null = null;

function generateId(): string {
  // Lightweight uuid-ish; not cryptographic, only used as an opaque stable id.
  const t = Date.now().toString(36);
  const r =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
  return `dev_${t}_${r}`;
}

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 6) {
      cachedDeviceId = existing;
      return existing;
    }
  } catch {
    // AsyncStorage unavailable — fall back to in-memory id (still useful per session).
  }
  const fresh = generateId();
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
  } catch {
    // Best-effort persistence; in-memory fallback still works for the session.
  }
  cachedDeviceId = fresh;
  return fresh;
}

// Wave-3 PR1: this was the FIFTH, divergent resolver — it skipped
// EXPO_PUBLIC_API_BASE entirely, which pointed the entire commerce path
// (checkout, portal, scans, analytics, TTS) at the dead api.drinkaforce.com
// host while the rest of the app talked to Railway. Canonical now.
export function getApiBase(): string {
  return API_BASE;
}

export interface ApiError {
  status: number;
  message: string;
}

/**
 * Wave-3 PR3: thrown errors are now REAL Error instances. The old plain
 * `{status, message}` object failed every `err instanceof Error` check, so
 * the server's actual failure reason (e.g. a 400 naming the rejected
 * return URL) was discarded and users saw only a generic string.
 * Implements ApiError so existing `isApiError` structural guards keep
 * working unchanged.
 */
export class ApiRequestError extends Error implements ApiError {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const deviceId = await getDeviceId();
  const url = `${getApiBase()}${path}`;
  // Lazy import to avoid a static cycle between this file and the
  // services layer (which imports from here for some helpers).
  const { getAuthHeaders } = await import("../services/authToken");
  const auth = await getAuthHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-device-id": deviceId,
      ...auth,
      ...(extraHeaders ?? {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiRequestError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}

/**
 * A request whose NON-2xx answers are data, not exceptions.
 *
 * The analytics identity/consent endpoints are the only callers. They need the
 * server's explicit `code` and, for a 409, its `current` state — and a thrown
 * error that stringifies the body forces the caller to re-parse a message,
 * which is how a client ends up classifying a permanent refusal as a network
 * blip and retrying it forever. So the status and the parsed body are returned
 * intact. A transport failure (offline) is reported as status 0 rather than
 * thrown, because "we could not reach the server" is a state this caller must
 * handle, not an error it should crash on.
 */
async function requestEither(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const deviceId = await getDeviceId();
  const { getAuthHeaders } = await import("../services/authToken");
  const auth = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-device-id": deviceId, ...auth },
      body: body == null ? undefined : JSON.stringify(body),
    });
  } catch {
    return { status: 0, body: null };
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : null;
    parsed = json !== null && typeof json === "object" ? (json as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

/** The server's error `code`, when it sent one. Never inferred from the status. */
function errorCode(body: Record<string, unknown> | null): string | null {
  return typeof body?.["code"] === "string" ? (body["code"] as string) : null;
}

/**
 * Internal analytics identity header (Task #39). Returns the pseudonymous
 * analytics id under `x-aforce-analytics-id` ONLY when the user has granted
 * analytics consent AND an id already exists — so backend-owned events
 * (receipt_verified / receipt_activated / subscription_started) can be keyed
 * to the same anon identity the mobile dispatcher uses, never the Clerk user
 * id. Returns {} otherwise so callers attach nothing and the server stays a
 * strict no-op for non-consenting users.
 *
 * Lazy import of privacy_manager avoids a static cycle (privacy_manager
 * imports forgetAnalytics from this module).
 */
async function consentedAnalyticsHeader(): Promise<Record<string, string>> {
  try {
    const { isConsentGranted, getAnalyticsId } = await import(
      "../analytics/privacy_manager"
    );
    if (!(await isConsentGranted())) return {};
    const id = await getAnalyticsId();
    return id ? { "x-aforce-analytics-id": id } : {};
  } catch {
    return {};
  }
}

// ─── Scans ───────────────────────────────────────────────────────────────────
export interface ServerScan {
  id: string;
  loggedAt: string;
  source: "barcode" | "qr" | "manual" | "camera";
  rawValue: string;
  productId: string | null;
  productName: string;
  brand: string | null;
  /** Whether the scanned product is an AForce SKU. Sent on POST so the
   *  server can emit the backend-owned `receipt_activated` analytics event;
   *  not echoed back in the GET response (kept out of the legacy shape). */
  isAForce?: boolean;
  verdict: string;
  /** 0-100, or null when nothing was known to compare on (D5). */
  fitScore: number | null;
  scoreBefore: number;
  scoreAfter: number;
  performanceState: string;
  recommendedProductId: string | null;
}

export async function fetchScans(limit = 50): Promise<ServerScan[]> {
  const data = await request<{ scans: ServerScan[] }>("GET", `/scans?limit=${limit}`);
  return data.scans;
}

export async function postScan(scan: Omit<ServerScan, "id"> & { id?: string }): Promise<ServerScan> {
  const data = await request<{ scan: ServerScan }>(
    "POST",
    "/scans",
    scan,
    await consentedAnalyticsHeader(),
  );
  return data.scan;
}

// ─── Cycles ──────────────────────────────────────────────────────────────────
export interface ServerCycle {
  id: string;
  loggedAt: string;
  fluidType: string;
  ozAmount: number;
  scoreBefore: number;
  scoreAfter: number;
  performanceState: string;
}

export interface CycleStats {
  totalScans: number;
  totalCycles: number;
  last7DaysScans: number;
}

export async function fetchCycles(limit = 50): Promise<{ cycles: ServerCycle[]; stats: CycleStats }> {
  return request<{ cycles: ServerCycle[]; stats: CycleStats }>("GET", `/cycles?limit=${limit}`);
}

export async function postCycle(cycle: Omit<ServerCycle, "id"> & { id?: string }): Promise<ServerCycle> {
  const data = await request<{ cycle: ServerCycle }>("POST", "/cycles", cycle);
  return data.cycle;
}

// ─── Checkout (Stripe) ───────────────────────────────────────────────────────
export interface CheckoutSession {
  url: string;
  sessionId: string;
}

/** Create a Stripe Checkout session for a consumer plan upgrade.
 *  `cadence` is optional (D-1 slice 4b): omitted = monthly; 'annual' is valid
 *  only for plans the server catalog prices annually (Command $200/yr) — the
 *  server 400s rather than silently downgrading cadence. */
export async function createCheckoutSession(input: {
  planId: string;
  returnUrl: string;
  cadence?: 'monthly' | 'annual';
}): Promise<CheckoutSession> {
  return request<CheckoutSession>(
    "POST",
    "/checkout/session",
    input,
    await consentedAnalyticsHeader(),
  );
}

export interface CartCheckoutSession extends CheckoutSession {
  totals: {
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
}

/**
 * Create a Stripe Checkout session for a Store cart (one-time payment).
 * The server validates and re-prices every line against its own SKU catalog
 * — the client never sends prices.
 */
export async function createCartCheckoutSession(input: {
  items: { skuId: string; qty: number }[];
  returnUrl: string;
}): Promise<CartCheckoutSession> {
  return request<CartCheckoutSession>("POST", "/checkout/cart", input);
}

export interface CheckoutSessionStatus {
  sessionId: string;
  mode: "subscription" | "payment" | "setup" | string;
  paymentStatus: string;
  status: string | null;
  paid: boolean;
  kind: "cart" | "subscription" | null;
  planId: string | null;
}

/**
 * Server-side check of a Stripe Checkout session's authoritative payment
 * status. Use this before clearing a cart or switching a plan — never trust
 * the redirect's `?status=success` alone (the bounce can be interrupted).
 */
export async function fetchCheckoutSession(sessionId: string): Promise<CheckoutSessionStatus> {
  return request<CheckoutSessionStatus>("GET", `/checkout/session/${encodeURIComponent(sessionId)}`);
}

// ─── Stripe Customer Portal ──────────────────────────────────────────────────
export interface PortalSession { url: string }

/**
 * Open the Stripe Customer Portal for the signed-in user. The server
 * resolves the customer id from `aforce_users.stripe_customer_id`, so
 * the user must have completed checkout at least once.
 */
export async function createPortalSession(returnUrl: string): Promise<PortalSession> {
  return request<PortalSession>("POST", "/stripe/portal-session", { returnUrl });
}

// ─── Internal analytics ──────────────────────────────────────────────────────
// INTERNAL pipeline only — no consumer-facing analytics. The dispatcher
// flushes consent-gated event batches here; ingestion is idempotent on
// eventId server-side. `forgetAnalytics` powers delete-my-data.
import type { AnalyticsEventEnvelope } from "@workspace/analytics-contract";

export interface AnalyticsIngestResult {
  received: number;
  accepted: number;
  deduped: number;
}

/**
 * What an ingest POST actually means.
 *
 * The route has TWO success-shaped answers and they are not the same event:
 *   - `{received, accepted, deduped}` — the batch was stored (or was already
 *     stored, which is what `deduped` counts).
 *   - `{inserted: 0}` — the writer gate REFUSED the caller, and deliberately
 *     does not say why. Nothing was stored and nothing ever will be for these
 *     envelopes as they stand.
 *
 * Collapsing the second into the first is the `inserted: 0` trap: a 200 with a
 * zero count reads as "delivered nothing to deliver" when it actually means
 * "refused". The union forces the caller to decide.
 */
export type AnalyticsIngestOutcome =
  | ({ outcome: "stored" } & AnalyticsIngestResult)
  /** The gate refused. Terminal for this batch — never a retry signal. */
  | { outcome: "refused" }
  /** The envelopes name a pseudonym this caller does not own. Terminal. */
  | { outcome: "not_owned" }
  /** Offline, 5xx, or an unclassifiable answer. The batch is still owed. */
  | { outcome: "unavailable"; status: number };

export async function postAnalyticsBatch(
  events: AnalyticsEventEnvelope[],
): Promise<AnalyticsIngestOutcome> {
  const { status, body } = await requestEither("POST", "/aforce/analytics", { events });
  if (status === 200) {
    if (typeof body?.["accepted"] === "number" && typeof body["received"] === "number") {
      return {
        outcome: "stored",
        received: body["received"] as number,
        accepted: body["accepted"] as number,
        deduped: typeof body["deduped"] === "number" ? (body["deduped"] as number) : 0,
      };
    }
    // `{inserted: 0}` — the gate's deliberately uninformative refusal.
    if (typeof body?.["inserted"] === "number") return { outcome: "refused" };
    return { outcome: "unavailable", status };
  }
  if (status === 403 && errorCode(body) === "analytics_id_not_owned") {
    return { outcome: "not_owned" };
  }
  return { outcome: "unavailable", status };
}

/**
 * S1-3 identity/consent authority. These replace the client's local mint and
 * its local consent assertion: the server issues the pseudonym and owns the
 * operative consent state.
 */
export interface AnalyticsConsentWire {
  granted: boolean;
  /** null = the member has NEVER decided. Never 0 — see the server's CAS. */
  decisionSeq: number | null;
  disclosureVersion: number | null;
}

export interface AnalyticsIdentityWire {
  analyticsId: string;
  status: "active" | "suppressed";
  consent: AnalyticsConsentWire;
}

/** A refusal carrying the server's own code, so the caller never guesses. */
export interface AnalyticsRefusal {
  ok: false;
  status: number;
  code: string | null;
}

function isConsentWire(b: Record<string, unknown> | null): b is Record<string, unknown> {
  return typeof b?.["granted"] === "boolean";
}

function consentFrom(b: Record<string, unknown>): AnalyticsConsentWire {
  const seq = b["decisionSeq"];
  const dv = b["disclosureVersion"];
  return {
    granted: b["granted"] === true,
    decisionSeq: typeof seq === "number" ? seq : null,
    disclosureVersion: typeof dv === "number" ? dv : null,
  };
}

export type ResolveIdentityResult =
  | { ok: true; identity: AnalyticsIdentityWire }
  | AnalyticsRefusal;

export async function resolveAnalyticsIdentity(): Promise<ResolveIdentityResult> {
  const { status, body } = await requestEither("POST", "/aforce/analytics-identity/resolve");
  if (status === 200 && typeof body?.["analyticsId"] === "string") {
    const consentRaw = body["consent"];
    const consent =
      consentRaw !== null && typeof consentRaw === "object"
        ? consentFrom(consentRaw as Record<string, unknown>)
        : { granted: false, decisionSeq: null, disclosureVersion: null };
    return {
      ok: true,
      identity: {
        analyticsId: body["analyticsId"] as string,
        status: body["status"] === "suppressed" ? "suppressed" : "active",
        consent,
      },
    };
  }
  return { ok: false, status, code: errorCode(body) };
}

/**
 * A consent decision, with the 409 as a first-class answer rather than an
 * exception: the server hands back the CURRENT state so the client can adopt
 * it, which is the whole point of the compare-and-set.
 */
export type PostConsentResult =
  | { ok: true; consent: AnalyticsConsentWire }
  | { ok: false; stale: true; current: AnalyticsConsentWire | null }
  | (AnalyticsRefusal & { stale?: false });

export async function postAnalyticsConsent(args: {
  action: "grant" | "revoke";
  disclosureVersion: number;
  expectedSeq: number | null;
}): Promise<PostConsentResult> {
  const { status, body } = await requestEither("POST", "/aforce/analytics-consent", args);
  if (status === 200 && isConsentWire(body)) return { ok: true, consent: consentFrom(body) };
  if (status === 409 && errorCode(body) === "consent_stale") {
    const cur = body?.["current"];
    return {
      ok: false,
      stale: true,
      current:
        cur !== null && typeof cur === "object" && isConsentWire(cur as Record<string, unknown>)
          ? consentFrom(cur as Record<string, unknown>)
          : null,
    };
  }
  return { ok: false, status, code: errorCode(body) };
}

/**
 * delete-my-data, S1-3 form: the pseudonym is resolved SERVER-SIDE from the
 * caller's own identity, so no id is sent.
 *
 * This replaces `forgetAnalytics(id)` on the client path for a reason the
 * transition creates: once the client stops minting locally, a member whose id
 * cache is empty has no id to send — and the legacy route's body schema
 * requires a well-formed one. Gating erasure on a local cache would mean a
 * reinstalled member could not be forgotten.
 */
export async function forgetAnalyticsIdentity(): Promise<{
  deleted: number;
  status: string;
}> {
  return request<{ deleted: number; status: string }>(
    "POST",
    "/aforce/analytics-identity/forget",
  );
}

export async function forgetAnalytics(
  analyticsId: string,
): Promise<{ deleted: number }> {
  return request<{ deleted: number }>("POST", "/aforce/analytics/forget", {
    analytics_id: analyticsId,
  });
}
