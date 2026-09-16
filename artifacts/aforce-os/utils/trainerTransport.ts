/**
 * Turning one queued entry into one HTTP request.
 *
 * Split from `trainerSync` on purpose: the loop's rules — ordering, blocking,
 * backoff, never discarding — are proven against a scripted transport with no
 * network anywhere near them. This module is the part that knows about URLs
 * and status codes, and it is deliberately the only part that does.
 *
 * THE STATUS MAPPING IS THE WHOLE DESIGN, so it is written as a table rather
 * than as a chain of ifs. Getting one of these wrong is not a bug that shows
 * up as an error; it shows up as a trainer's entry silently stuck, or
 * silently retried forever, or silently applied over someone else's decision.
 */
import type { OutboxItem } from "./trainerOutbox";
import type { SendResult, SyncTransport } from "./trainerSync";

export interface TransportOptions {
  baseUrl: string;
  /** Resolves the bearer token, or null when signed out. */
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

/** Where each kind of entry goes. */
function pathFor(item: OutboxItem): string | null {
  const p = `/trainer/programs/${encodeURIComponent(item.programId)}/athletes/${encodeURIComponent(item.athleteUserId)}`;
  switch (item.kind) {
    case "availability":
      return `${p}/availability`;
    case "note":
      return `${p}/notes`;
    case "session":
      return `${p}/sessions`;
    case "rtp_signoff":
      return `${p}/rtp/signoff`;
    default:
      return null;
  }
}

/**
 * The body, including the version the entry was made against.
 *
 * `baseVersion` is sent for every kind. The server requires it on
 * availability — an absent version is a 400 there, because a client that
 * states no version is one that would overwrite anything — and ignores it on
 * the append-only kinds, which cannot conflict.
 */
function bodyFor(item: OutboxItem): Record<string, unknown> {
  return { ...item.payload, baseVersion: item.baseVersion, idempotencyKey: item.id };
}

export function createTrainerTransport(options: TransportOptions): SyncTransport {
  const doFetch = options.fetchImpl ?? fetch;

  return {
    async send(item): Promise<SendResult> {
      const path = pathFor(item);
      if (!path) {
        // An entry this build does not know how to send. Kept, not dropped —
        // a newer build may understand it.
        return { ok: false, kind: "retry", message: "unsupported_kind" };
      }

      const token = await options.getToken();
      if (!token) {
        // Signed out mid-flush. Not the entry's fault and not permanent.
        return { ok: false, kind: "retry", message: "no_session" };
      }

      const res = await doFetch(`${options.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyFor(item)),
      });

      if (res.ok) return { ok: true };

      if (res.status === 409) {
        // The server moved. Both values are kept for a person to choose; this
        // is the path Phase 7 built and could never reach.
        const payload = (await res.json().catch(() => ({}))) as {
          current?: { version?: unknown } & Record<string, unknown>;
        };
        const version = payload.current?.version;
        return {
          ok: false,
          kind: "conflict",
          serverVersion: typeof version === "number" ? version : 0,
          serverValue: payload.current ?? {},
        };
      }

      // 404 IS A RETRY, NOT A REJECTION. The trainer API answers 404 when its
      // feature flag is off — identical to what a non-member sees — so a 404
      // may simply mean "not enabled yet". Treating it as permanent would
      // block that athlete's chain until someone noticed.
      if (res.status === 404 || res.status === 429 || res.status >= 500) {
        return { ok: false, kind: "retry", message: `http_${res.status}` };
      }

      // 400, 401, 403 and the rest: retrying the same bytes cannot help.
      // The entry is KEPT in `failed` with the reason on it — a trainer's
      // entry is evidence of a clinical decision even when the server will
      // not take it.
      const code = await res
        .json()
        .then((b: { code?: unknown; error?: unknown }) =>
          typeof b.code === "string" ? b.code : typeof b.error === "string" ? b.error : null,
        )
        .catch(() => null);
      return { ok: false, kind: "permanent", message: code ?? `http_${res.status}` };
    },
  };
}
