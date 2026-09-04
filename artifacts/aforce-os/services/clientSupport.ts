/**
 * IS THIS BUILD STILL SUPPORTED? — evaluated on the client, from a policy the
 * server publishes on `/state`.
 *
 * ── WHY THE CLIENT DECIDES ──────────────────────────────────────────────
 *
 * The server publishes a POLICY, not a verdict. If it shipped a verdict, a
 * transient server state — a bad deploy, a half-rolled config, a proxy serving
 * a stale body — could declare a perfectly good build unsupported, and with no
 * OTA the only remedy would be an App Store review cycle. A policy the client
 * evaluates against its own identity has no such failure mode: if the policy
 * does not arrive, there is nothing to evaluate and nothing happens.
 *
 * ── EVERY UNCERTAINTY RESOLVES TO SUPPORTED ─────────────────────────────
 *
 * Never fetched, failed to fetch, offline, malformed, missing this platform,
 * unknown own identity — all `unknown`. `unknown` is not `unsupported` and
 * must never be rendered as one. The only path to `unsupported` is a policy
 * that actually arrived, carrying a positive minimum for THIS platform, that
 * this build's own native build number is genuinely below.
 */
import { buildClientIdentityHeader } from './clientIdentity';

export type SupportVerdict = 'supported' | 'unsupported' | 'unknown';

export interface ClientSupportPolicy {
  minSupportedBuild?: Partial<Record<'ios' | 'android', number>>;
}

/**
 * FORCED-UPDATE UI: OFF.
 *
 * Evaluation runs regardless — that is how the telemetry becomes meaningful
 * and how we learn what a real fleet looks like — but nothing is ever shown to
 * a member while this is false. Turning it on is the activation step and a
 * separate founder decision (PR-3). Do not flip it as part of another change.
 */
export const FORCED_UPDATE_UI_ENABLED = false;

/** Parsed from the same string the client sends, so the two cannot drift. */
export function parseOwnIdentity(header: string | null): { platform: 'ios' | 'android'; build: number } | null {
  if (!header) return null;
  const m = /^(ios|android)\/[0-9A-Za-z.\-]{1,32}\+(\d{1,10})$/.exec(header);
  if (!m) return null;
  const build = Number(m[2]);
  return Number.isSafeInteger(build) && build >= 0 ? { platform: m[1] as 'ios' | 'android', build } : null;
}

export function evaluateOwnSupport(
  policy: ClientSupportPolicy | null | undefined,
  header: string | null = buildClientIdentityHeader(),
): SupportVerdict {
  if (policy == null || typeof policy !== 'object') return 'unknown';
  const self = parseOwnIdentity(header);
  if (self == null) return 'unknown';
  const min = policy.minSupportedBuild?.[self.platform];
  // A policy that omits this platform, or carries a non-positive or
  // non-numeric minimum, gates nothing.
  if (typeof min !== 'number' || !Number.isFinite(min) || min <= 0) return 'supported';
  return self.build >= min ? 'supported' : 'unsupported';
}

/** True only when a member should actually be shown the blocking screen. */
export function shouldBlockForUpgrade(
  verdict: SupportVerdict,
  uiEnabled: boolean = FORCED_UPDATE_UI_ENABLED,
): boolean {
  return uiEnabled && verdict === 'unsupported';
}

/* ── The last policy the server sent ──────────────────────────────────────
 *
 * A module-level cache rather than a new fetch: `/state` already carries it,
 * so nothing here adds a request, a retry, or a second thing to go wrong.
 * Starts null — "we have never heard" — which evaluates to `unknown`.
 */
let lastPolicy: ClientSupportPolicy | null = null;
export function recordClientPolicy(policy: unknown): void {
  lastPolicy = policy != null && typeof policy === 'object' ? (policy as ClientSupportPolicy) : null;
}
export function getLastClientPolicy(): ClientSupportPolicy | null {
  return lastPolicy;
}
/** Test-only reset; production never needs to forget a policy. */
export function __resetClientPolicyForTests(): void {
  lastPolicy = null;
}
