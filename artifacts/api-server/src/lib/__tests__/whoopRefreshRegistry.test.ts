/**
 * Tests for the process-level WHOOP refresh singleflight registry.
 *
 * Pins the invariants the fetch worker relies on:
 *   - Concurrent coordinators for the SAME userId share one inflight
 *     promise (one impl invocation, identical result by object identity).
 *   - Coordinators for DIFFERENT userIds do NOT share — each fires its
 *     own impl call.
 *   - Settlement (resolve OR reject) clears the registry entry, so the
 *     next call retries cleanly without caching the failure.
 *   - `coordinatorFor("")` refuses to bind to an empty key.
 *   - `size()` reflects the in-flight count.
 */
import { describe, it, expect } from "vitest";
import type { WhoopTokens } from "@workspace/db";
import { createWhoopRefreshRegistry } from "../whoopRefreshRegistry";

function makeTokens(accessToken: string): WhoopTokens {
  return {
    accessToken,
    refreshToken: `refresh-${accessToken}`,
    expiresAt: 1_700_000_000_000,
    scope: null,
  };
}

/** A gated impl: returns a promise that doesn't resolve until release().
 *  Lets a test assert how many invocations have started BEFORE any
 *  result is observable. */
function makeGatedImpl(token: WhoopTokens): {
  impl: () => Promise<WhoopTokens>;
  calls: number;
  release: () => void;
} {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const state = { calls: 0 };
  const impl = async (): Promise<WhoopTokens> => {
    state.calls += 1;
    await gate;
    return token;
  };
  return {
    impl,
    get calls() {
      return state.calls;
    },
    release,
  };
}

describe("createWhoopRefreshRegistry", () => {
  it("N concurrent coordinator calls for the same userId share one inflight (one impl call, identity-equal results)", async () => {
    const registry = createWhoopRefreshRegistry();
    const coord = registry.coordinatorFor("u1");
    const gate = makeGatedImpl(makeTokens("fresh"));
    const pending = [
      coord(gate.impl),
      coord(gate.impl),
      coord(gate.impl),
      coord(gate.impl),
      coord(gate.impl),
    ];
    // Yield so the first impl invocation registers.
    await Promise.resolve();
    expect(gate.calls).toBe(1);
    expect(registry.size()).toBe(1);
    gate.release();
    const results = await Promise.all(pending);
    expect(gate.calls).toBe(1);
    // Object identity — strong proof the same promise was awaited,
    // not just that values matched.
    for (const r of results) expect(r).toBe(results[0]);
    // Slot cleared on settle.
    expect(registry.size()).toBe(0);
  });

  it("different userIds do not share — each fires its own impl call", async () => {
    const registry = createWhoopRefreshRegistry();
    const a = registry.coordinatorFor("user-a");
    const b = registry.coordinatorFor("user-b");
    const gateA = makeGatedImpl(makeTokens("token-a"));
    const gateB = makeGatedImpl(makeTokens("token-b"));
    const pa = a(gateA.impl);
    const pb = b(gateB.impl);
    await Promise.resolve();
    expect(gateA.calls).toBe(1);
    expect(gateB.calls).toBe(1);
    expect(registry.size()).toBe(2);
    gateA.release();
    gateB.release();
    const [ra, rb] = await Promise.all([pa, pb]);
    expect(ra.accessToken).toBe("token-a");
    expect(rb.accessToken).toBe("token-b");
    expect(registry.size()).toBe(0);
  });

  it("clears the slot on rejection — a follow-up call invokes impl again (no failure caching)", async () => {
    const registry = createWhoopRefreshRegistry();
    const coord = registry.coordinatorFor("u1");
    let calls = 0;
    const impl = async (): Promise<WhoopTokens> => {
      calls += 1;
      if (calls === 1) throw new Error("nope");
      return makeTokens("fresh");
    };
    // Two concurrent callers share the failing call (one impl
    // invocation, both reject).
    const [a, b] = await Promise.allSettled([coord(impl), coord(impl)]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("rejected");
    expect(calls).toBe(1);
    expect(registry.size()).toBe(0);
    // Follow-up call fires a fresh impl.
    const next = await coord(impl);
    expect(calls).toBe(2);
    expect(next.accessToken).toBe("fresh");
    expect(registry.size()).toBe(0);
  });

  it("a second coordinatorFor(same userId) shares the SAME inflight as the first", async () => {
    // This is THE critical property for the fetch worker: two
    // independent call sites can each ask `coordinatorFor(userId)`
    // and still dedupe.
    const registry = createWhoopRefreshRegistry();
    const c1 = registry.coordinatorFor("u1");
    const c2 = registry.coordinatorFor("u1");
    const gate = makeGatedImpl(makeTokens("fresh"));
    const p1 = c1(gate.impl);
    const p2 = c2(gate.impl);
    await Promise.resolve();
    expect(gate.calls).toBe(1);
    gate.release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);
  });

  it("coordinatorFor('') throws — empty userId would cross-contaminate", () => {
    const registry = createWhoopRefreshRegistry();
    expect(() => registry.coordinatorFor("")).toThrow(/userId must be non-empty/);
  });
});
