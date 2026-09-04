/**
 * THE CLIENT VERSION/BUILD CONTRACT — additive, and non-blocking by default.
 *
 * WHY THIS EXISTS. The server has had no idea what build is talking to it.
 * Verified from the shipped artifacts: no request carries a version, none is
 * read, none is stored. That has two consequences the founder's release-
 * recovery ruling addresses — a bad client cannot be refused service, and the
 * sparse-contract retirement plan (ruling R3) requires "installed-version
 * evidence" that is currently unobtainable.
 *
 * ── THE TWO NUMBERS ARE NOT THE SAME NUMBER ──────────────────────────────
 *
 * `appVersion` is the marketing/semantic version ("1.0.0"). `build` is the
 * platform's monotonic native build counter — iOS `CFBundleVersion`, Android
 * `versionCode`. They move independently and are NOT interchangeable, which
 * is not hypothetical here: the shipped iOS artifact is version 1.0.0 build
 * **71**, while the shipped Android artifact is version 1.0.0 versionCode
 * **1**. Same app version, build numbers 70 apart.
 *
 * So `appVersion` is carried for TELEMETRY AND DISPLAY ONLY and is never
 * compared. Support is decided on `build` alone, and per platform, because
 * comparing an Android versionCode against an iOS threshold is meaningless.
 * The types enforce the distinction — `appVersion` is a string and `build` a
 * number, so a swap is a compile error rather than a silently wrong verdict.
 *
 * ── FAIL OPEN, ALWAYS ────────────────────────────────────────────────────
 *
 * Absent, malformed, unknown-platform, or unparseable input yields `unknown`,
 * and `unknown` is never grounds to refuse anyone. Every client in the field
 * today sends no header at all, so every client in the field today is
 * `unknown` — and must keep working. A version gate that can lock members out
 * of a working app because a header failed to parse is a worse failure than
 * the one it exists to prevent.
 */

export const CLIENT_PLATFORMS = ["ios", "android"] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

export interface ClientIdentity {
  platform: ClientPlatform;
  /** Semantic, e.g. "1.0.0". TELEMETRY ONLY — never compared. */
  appVersion: string;
  /** Monotonic native build (iOS CFBundleVersion / Android versionCode). */
  build: number;
}

export interface ClientSupportPolicy {
  /** Per platform, because the two counters are unrelated. `0` blocks nobody. */
  minSupportedBuild: Record<ClientPlatform, number>;
}

/**
 * THE SHIPPED POLICY. Both zero: nothing is gated, nobody is blocked.
 *
 * Raising either number IS the activation step, and activation is a separate
 * founder decision that has not been made. Do not raise these as part of any
 * other change — and note that raising them is only meaningful once builds
 * that actually SEND the header are in the field, since an older client is
 * `unknown` rather than `unsupported` and is unaffected either way.
 */
export const CLIENT_SUPPORT_POLICY: ClientSupportPolicy = {
  minSupportedBuild: { ios: 0, android: 0 },
};

/** The request header the client sends. */
export const CLIENT_HEADER = "x-aforce-client";

/**
 * `<platform>/<appVersion>+<build>` — e.g. `ios/1.0.0+71`.
 *
 * Deliberately strict about what it ACCEPTS and deliberately soft about what
 * it does on rejection: anything that does not match exactly returns `null`,
 * which reads downstream as `unknown` and never as `unsupported`.
 */
const HEADER_RE = /^(ios|android)\/([0-9A-Za-z.\-]{1,32})\+(\d{1,10})$/;

export function parseClientHeader(raw: unknown): ClientIdentity | null {
  // Express hands a repeated header over as an array; a caller that sends the
  // header twice is malformed, not unsupported.
  if (typeof raw !== "string") return null;
  const m = HEADER_RE.exec(raw.trim());
  if (!m) return null;
  const build = Number(m[3]);
  if (!Number.isSafeInteger(build) || build < 0) return null;
  return { platform: m[1] as ClientPlatform, appVersion: m[2]!, build };
}

export type SupportVerdict = "supported" | "unsupported" | "unknown";

/**
 * Decide whether a client is below the minimum for ITS OWN platform.
 *
 * `null` identity — no header, or one we could not parse — is `unknown`.
 * `unknown` is not a denial and callers must not treat it as one.
 */
export function evaluateClientSupport(
  identity: ClientIdentity | null,
  policy: ClientSupportPolicy = CLIENT_SUPPORT_POLICY,
): SupportVerdict {
  if (identity == null) return "unknown";
  const min = policy.minSupportedBuild[identity.platform];
  // A policy missing this platform gates nothing for it.
  if (typeof min !== "number" || !Number.isFinite(min) || min <= 0) return "supported";
  return identity.build >= min ? "supported" : "unsupported";
}

/** The additive field `/state` publishes so the client can evaluate itself. */
export function clientPolicyPayload(
  policy: ClientSupportPolicy = CLIENT_SUPPORT_POLICY,
): ClientSupportPolicy {
  return { minSupportedBuild: { ...policy.minSupportedBuild } };
}
