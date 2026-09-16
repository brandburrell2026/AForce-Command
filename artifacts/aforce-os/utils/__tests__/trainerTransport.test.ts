/**
 * One queued entry → one HTTP request, and the status mapping.
 *
 * Getting one of these wrong does not show up as an error. It shows up as a
 * trainer's entry silently stuck, or silently retried forever, or silently
 * applied over someone else's decision — so each row of the mapping is a
 * test.
 */
import { describe, expect, it } from "vitest";

import type { OutboxItem } from "../trainerOutbox";
import { createTrainerTransport } from "../trainerTransport";

const BASE = "https://api.example.test";

function item(over: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: "outbox_item_1",
    kind: "availability",
    athleteUserId: "athlete_1",
    programId: "prog_1",
    payload: { status: "out" },
    baseVersion: 7,
    state: "pending",
    attempts: 0,
    createdAtMs: 0,
    nextAttemptAtMs: 0,
    ...over,
  };
}

function transportFor(
  responder: (url: string, init: RequestInit) => Response | Promise<Response>,
  token: string | null = "tok",
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const transport = createTrainerTransport({
    baseUrl: BASE,
    getToken: async () => token,
    fetchImpl: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return responder(url, init);
    }) as unknown as typeof fetch,
  });
  return { transport, calls };
}

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("each kind goes to its own route", () => {
  it.each([
    ["availability", "/trainer/programs/prog_1/athletes/athlete_1/availability"],
    ["note", "/trainer/programs/prog_1/athletes/athlete_1/notes"],
    ["session", "/trainer/programs/prog_1/athletes/athlete_1/sessions"],
    ["rtp_signoff", "/trainer/programs/prog_1/athletes/athlete_1/rtp/signoff"],
  ] as const)("%s → %s", async (kind, path) => {
    const { transport, calls } = transportFor(() => json(201));
    await transport.send(item({ kind }));
    expect(calls[0]!.url).toBe(`${BASE}${path}`);
    expect(calls[0]!.init.method).toBe("POST");
  });

  it("escapes ids rather than pasting them into a URL", async () => {
    const { transport, calls } = transportFor(() => json(201));
    await transport.send(item({ athleteUserId: "a/../b", programId: "p 1" }));
    expect(calls[0]!.url).toContain("a%2F..%2Fb");
    expect(calls[0]!.url).toContain("p%201");
  });

  it("sends the base version and the entry id as an idempotency key", async () => {
    const { transport, calls } = transportFor(() => json(201));
    await transport.send(item());
    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      status: "out",
      baseVersion: 7,
      idempotencyKey: "outbox_item_1",
    });
  });
});

describe("the status mapping", () => {
  it("2xx is a send", async () => {
    const { transport } = transportFor(() => json(201));
    expect(await transport.send(item())).toEqual({ ok: true });
  });

  it("409 is a conflict, carrying the server's value for a person to choose", async () => {
    const { transport } = transportFor(() =>
      json(409, {
        error: "availability_conflict",
        current: { version: 12, status: "out", reason: "held from contact" },
      }),
    );
    expect(await transport.send(item())).toEqual({
      ok: false,
      kind: "conflict",
      serverVersion: 12,
      serverValue: { version: 12, status: "out", reason: "held from contact" },
    });
  });

  /**
   * The trainer API answers 404 when its feature flag is off — identical to
   * what a non-member sees. Treating that as permanent would block the
   * athlete's chain until somebody noticed.
   */
  it.each([404, 429, 500, 502, 503])("%i is a retry", async (status) => {
    const { transport } = transportFor(() => json(status));
    expect(await transport.send(item())).toMatchObject({ ok: false, kind: "retry" });
  });

  it.each([400, 401, 403, 422])("%i is permanent, and the entry is still kept", async (status) => {
    const { transport } = transportFor(() => json(status, { code: "invalid_availability_status" }));
    expect(await transport.send(item())).toEqual({
      ok: false,
      kind: "permanent",
      message: "invalid_availability_status",
    });
  });

  it("falls back to the status when there is no error code", async () => {
    const { transport } = transportFor(() => new Response("not json", { status: 400 }));
    expect(await transport.send(item())).toMatchObject({ kind: "permanent", message: "http_400" });
  });

  it("a missing session is a retry, not a rejection", async () => {
    const { transport, calls } = transportFor(() => json(201), null);
    expect(await transport.send(item())).toMatchObject({ kind: "retry", message: "no_session" });
    // And nothing was sent unauthenticated.
    expect(calls).toEqual([]);
  });

  it("an unknown kind is kept for a newer build to understand", async () => {
    const { transport } = transportFor(() => json(201));
    const result = await transport.send(item({ kind: "something_new" as never }));
    expect(result).toMatchObject({ kind: "retry", message: "unsupported_kind" });
  });

  it("sends the bearer token", async () => {
    const { transport, calls } = transportFor(() => json(201));
    await transport.send(item());
    expect((calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe("Bearer tok");
  });
});
