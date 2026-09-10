/**
 * CLIENT ANALYTICS TRANSITION — RELEASE-BLOCKING LAWS.
 *
 * The lane this covers moved two authorities off the device: the pseudonymous
 * analytics id (was minted locally) and the operative consent state (was a
 * local file the client treated as truth). What stays on the device is ONE
 * thing — a decision the member made while the server was unreachable — and it
 * is held as a CEILING that can only restrict.
 *
 * Each law below names the defect it forbids, and every safety boundary has a
 * mutation recorded in docs/analytics/CLIENT-TRANSITION-MUTATIONS.md. The final
 * describe block is the non-vacuity control: a "refuse everything" mutant must
 * break at least one law, or the suite would be satisfiable by a client that
 * simply never collects anything.
 *
 * Drives the REAL modules — consentAuthority, privacy_manager, event_dispatcher,
 * userScope — over in-memory storage and a driveable stand-in for the S1-3
 * endpoints. Nothing here asserts on source text.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── the driveable server ──────────────────────────────────────────────

interface Row {
  id: string;
  granted: boolean;
  seq: number | null;
  suppressed: boolean;
}

const { mem, srv } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  srv: {
    actingAs: null as string | null,
    rows: new Map<string, Row>(),
    /** Force the next N resolve calls to fail with this. */
    resolveFail: null as { status: number; code: string | null } | null,
    /** Force every consent POST to fail with this. */
    consentFail: null as { status: number; code: string | null } | null,
    /** Answer every consent POST with a 409 carrying the current row. */
    consentAlwaysStale: false,
    resolveCalls: 0,
    consentPosts: 0,
    /** What the ingest endpoint answers. */
    ingest: 'stored' as 'stored' | 'refused' | 'not_owned' | 'unavailable',
    ingestBatches: [] as Array<Array<{ eventId: string; analytics_id: string }>>,
  },
}));

function row(u: string): Row {
  let r = srv.rows.get(u);
  if (!r) {
    r = { id: `anon_srv_${u}`, granted: false, seq: null, suppressed: false };
    srv.rows.set(u, r);
  }
  return r;
}

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

vi.mock('../../services/secureStorage', () => ({
  secureKV: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

vi.mock('@/lib/api', () => ({
  resolveAnalyticsIdentity: async () => {
    srv.resolveCalls += 1;
    if (srv.resolveFail) return { ok: false as const, ...srv.resolveFail };
    const u = srv.actingAs;
    if (u === null) return { ok: false as const, status: 403, code: 'identity_requires_member' };
    const r = row(u);
    if (r.suppressed) {
      return { ok: false as const, status: 409, code: 'analytics_identity_suppressed' };
    }
    return {
      ok: true as const,
      identity: {
        analyticsId: r.id,
        status: 'active' as const,
        consent: { granted: r.granted, decisionSeq: r.seq, disclosureVersion: 1 },
      },
    };
  },
  postAnalyticsConsent: async (args: {
    action: 'grant' | 'revoke';
    disclosureVersion: number;
    expectedSeq: number | null;
  }) => {
    srv.consentPosts += 1;
    if (srv.consentFail) return { ok: false as const, ...srv.consentFail };
    const u = srv.actingAs;
    if (u === null) return { ok: false as const, status: 403, code: 'identity_requires_member' };
    const r = row(u);
    const wire = (x: Row) => ({
      granted: x.granted,
      decisionSeq: x.seq,
      disclosureVersion: 1,
    });
    if (srv.consentAlwaysStale || r.seq !== args.expectedSeq) {
      return { ok: false as const, stale: true as const, current: wire(r) };
    }
    r.granted = args.action === 'grant';
    r.seq = (r.seq ?? 0) + 1;
    return { ok: true as const, consent: wire(r) };
  },
  postAnalyticsBatch: async (events: Array<{ eventId: string; analytics_id: string }>) => {
    srv.ingestBatches.push(events);
    switch (srv.ingest) {
      case 'refused':
        return { outcome: 'refused' as const };
      case 'not_owned':
        return { outcome: 'not_owned' as const };
      case 'unavailable':
        return { outcome: 'unavailable' as const, status: 0 };
      default:
        return {
          outcome: 'stored' as const,
          received: events.length,
          accepted: events.length,
          deduped: 0,
        };
    }
  },
  forgetAnalyticsIdentity: async () => {
    const u = srv.actingAs;
    if (u !== null) {
      const r = row(u);
      r.suppressed = true;
      r.granted = false;
    }
    return { deleted: 3, status: 'suppressed' };
  },
}));

const OUTBOX_KEY = '@aforce/analytics-outbox';
const LEGACY_ID_KEY = '@aforce/analytics-id';

async function load() {
  vi.resetModules();
  const userScope = await import('../../services/userScope');
  const authority = await import('../consentAuthority');
  const privacy = await import('../privacy_manager');
  const dispatcher = await import('../event_dispatcher');
  return { userScope, authority, privacy, dispatcher };
}

/**
 * Sign a member in and point the stand-in server's token at them.
 *
 * Drives `resolveScope` directly rather than `__setUserScopeForTests`, because
 * that helper turns the isolation flag ON — and production has it OFF, which is
 * the whole reason the pending record composes its own per-member key. Under
 * the helper, `scopedStorage` renames the outbox to `…:<userId>` and the laws
 * below would be reading a key the app does not use in production.
 */
function signIn(
  userScope: Awaited<ReturnType<typeof load>>['userScope'],
  userId: string | null,
): void {
  srv.actingAs = userId;
  userScope.resolveScope(
    userId === null ? { status: 'ANONYMOUS' } : { status: 'AUTHENTICATED', userId },
  );
}

/**
 * Let the fire-and-forget flush `emit` kicks off actually run.
 *
 * `emit` ends with `void flush()`. Without this, a test's own `flush()` call
 * finds `flushing` already true and returns immediately — the assertions then
 * describe a flush that never happened.
 */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function outbox(): Array<{ eventId: string; analytics_id: string; eventType: string }> {
  const raw = mem.get(OUTBOX_KEY);
  return raw ? (JSON.parse(raw) as never[]) : [];
}

function pendingOnDisk(userId: string): Record<string, unknown> | null {
  const raw = mem.get(`@aforce/analytics-pending.${userId}`);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

beforeEach(() => {
  mem.clear();
  srv.rows.clear();
  srv.actingAs = null;
  srv.resolveFail = null;
  srv.consentFail = null;
  srv.consentAlwaysStale = false;
  srv.resolveCalls = 0;
  srv.consentPosts = 0;
  srv.ingest = 'stored';
  srv.ingestBatches = [];
});

// ══ LAW 1 · the local mint is gone ════════════════════════════════════

describe('LAW 1 — no client module mints an analytics id', () => {
  it('the privacy manager exposes no id-creating function at all', async () => {
    const { privacy } = await load();
    // `ensureAnalyticsId` was the mint. Its absence is the law: a reinstall or a
    // second device used to invent its own pseudonym, so one member became
    // several — and a member who asked to be forgotten was silently re-enrolled
    // with a brand-new identity on the next launch.
    expect(Object.keys(privacy)).not.toContain('ensureAnalyticsId');
  });

  it('a granted member with no server answer has NO id — nothing is invented', async () => {
    const { userScope, privacy, authority } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    // The server is unreachable; consent is irrelevant to the point.
    srv.resolveFail = { status: 0, code: null };
    await privacy.syncAnalyticsAuthority();
    expect(await privacy.getAnalyticsId()).toBeNull();
    expect(authority.__authorityForTests.snapshot().serverId).toBeNull();
    // MUTATION M1: restore a local mint in getAnalyticsId → red.
  });
});

// ══ LAW 2 · emission requires a server id ═════════════════════════════

describe('LAW 2 — emission requires a SERVER-ISSUED id', () => {
  it('effective consent without a server id emits nothing', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    // Consent granted server-side, but the id resolve never succeeded.
    row('u1').granted = true;
    row('u1').seq = 1;
    srv.resolveFail = { status: 500, code: null };
    await authority.reconcile();

    expect(await dispatcher.emit('territory_opened')).toBe(false);
    expect(outbox(), 'no envelope may be stamped without a server id').toEqual([]);
  });

  it('the pseudonym and the adopted consent are set and cleared TOGETHER', async () => {
    // This coupling is load-bearing for the mutation analysis: because the only
    // writer of `serverId` is also the only writer of `adopted`, the state
    // "effective consent but no id" is unreachable, and a synthesised-id
    // fallback in the gate is therefore dead code rather than a live hole
    // (mutants M1/M3, recorded EQUIVALENT). If a later change decouples them
    // that argument expires silently — so the coupling itself is a law.
    const { userScope, authority } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();
    const ok = authority.__authorityForTests.snapshot();
    expect(ok.serverId).toBe('anon_srv_u1');
    expect(ok.adopted?.granted).toBe(true);

    // A deterministic refusal must clear BOTH, never just one.
    srv.resolveFail = { status: 403, code: 'identity_requires_member' };
    await authority.reconcile();
    const refused = authority.__authorityForTests.snapshot();
    expect(refused.serverId, 'the id must go').toBeNull();
    expect(refused.adopted?.granted, 'and the grant must go with it').toBe(false);
    expect(mem.get('@aforce/analytics-id.v2.u1')).toBeUndefined();
    // MUTATION M22: leave the cached id in place on a refusal → red.
  });
});

// ══ LAW 3 · emission requires effective consent ═══════════════════════

describe('LAW 3 — emission requires effective consent', () => {
  it('a resolved id with consent NOT granted emits nothing', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    await authority.reconcile(); // id issued, consent never decided
    expect(authority.__authorityForTests.snapshot().serverId).toBe('anon_srv_u1');

    expect(await dispatcher.emit('territory_opened')).toBe(false);
    expect(outbox()).toEqual([]);
    // MUTATION M3: drop the consent half of the gate → red.
  });

  it('a granted member with a resolved id DOES emit — the law is not vacuous', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    expect(await dispatcher.emit('territory_opened')).toBe(true);
    await settle();
    expect(srv.ingestBatches.flat()).toHaveLength(1);
    expect(srv.ingestBatches.flat()[0]!.analytics_id).toBe('anon_srv_u1');
  });
});

// ══ LAW 4 · an offline revoke is operative IMMEDIATELY ════════════════

describe('LAW 4 — an offline revoke takes effect before the server is told', () => {
  it('the ceiling is up synchronously, with no await in between', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();
    expect(await privacy.isConsentGranted()).toBe(true);

    srv.consentFail = { status: 0, code: null }; // offline
    const inFlight = privacy.revokeConsent(); // deliberately NOT awaited
    // Read the authority with zero intervening awaits. A revoke that is
    // "immediate except for one disk read" is not immediate.
    expect(
      authority.effectiveGranted(
        authority.__authorityForTests.snapshot().adopted,
        authority.__authorityForTests.snapshot().pending,
      ),
      'collection must already be closed',
    ).toBe(false);
    await inFlight;
    expect(await privacy.isConsentGranted()).toBe(false);
    // MUTATION M4: move the `setPending` behind `await hydrate()` → red.
  });

  it('a revoke recorded DURING a disk read is not overwritten by it', async () => {
    const { userScope, authority, privacy } = await load();
    // The disk holds an older, still-unpublished GRANT.
    mem.set(
      '@aforce/analytics-pending.u1',
      JSON.stringify({
        action: 'grant',
        disclosureVersion: 1,
        basedOnSeq: null,
        state: 'queued',
        reissues: 0,
        createdAtMs: 1,
      }),
    );
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    srv.consentFail = { status: 0, code: null }; // offline throughout

    // Start a hydrate, then record a revoke while the disk is still answering.
    const reading = privacy.isConsentGranted();
    const revoking = privacy.revokeConsent();
    await Promise.all([reading, revoking]);

    expect(
      authority.__authorityForTests.snapshot().pending?.action,
      'the disk value is older than the decision the member just made — ' +
        'letting it land would silently lift a revoke already in force',
    ).toBe('revoke');
    expect(await privacy.getConsentUiState()).toMatchObject({ action: 'revoke' });
    // MUTATION M23: make hydrate assign `pending` unconditionally → red.
  });

  it('an emit racing the revoke is refused', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();
    srv.consentFail = { status: 0, code: null };

    const revoking = privacy.revokeConsent();
    const emitted = await dispatcher.emit('territory_opened');
    await revoking;
    expect(emitted, 'an event stamped after the member said stop').toBe(false);
    expect(outbox()).toEqual([]);
  });
});

// ══ LAW 5 · the ceiling survives a restart and outranks the server ════

describe('LAW 5 — an undelivered revoke is not lifted by the server’s older grant', () => {
  it('survives a process restart and still closes collection', async () => {
    const first = await load();
    signIn(first.userScope, 'u1');
    await first.userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await first.authority.reconcile();
    srv.consentFail = { status: 0, code: null }; // offline revoke
    await first.privacy.revokeConsent();
    expect(pendingOnDisk('u1'), 'the decision must be durable').toMatchObject({
      action: 'revoke',
    });

    // ── restart. The server still holds the older GRANT. ──
    const next = await load();
    signIn(next.userScope, 'u1');
    await next.userScope.migrationSettled();
    srv.consentFail = { status: 0, code: null }; // still offline
    await next.authority.reconcile();

    expect(
      await next.privacy.isConsentGranted(),
      'the server’s stale grant must not re-open collection',
    ).toBe(false);
    expect(await next.dispatcher.emit('territory_opened')).toBe(false);
    // MUTATION M5: make effectiveGranted return `adopted.granted` alone → red.
  });

  it('and is cleared once the server accepts it', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();
    srv.consentFail = { status: 0, code: null };
    await privacy.revokeConsent();
    expect(pendingOnDisk('u1')).not.toBeNull();

    srv.consentFail = null; // back online
    await authority.reconcile();
    expect(pendingOnDisk('u1'), 'a delivered decision must stop being pending').toBeNull();
    expect(row('u1').granted).toBe(false);
  });
});

// ══ LAW 6 · the ceiling is ASYMMETRIC ════════════════════════════════

describe('LAW 6 — an offline GRANT never opens collection', () => {
  it('a queued grant collects nothing until the server confirms', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    await authority.reconcile(); // id issued, not granted
    srv.consentFail = { status: 0, code: null }; // offline

    const outcome = await privacy.grantConsent();
    expect(outcome.outcome).toBe('queued');
    expect(
      await privacy.isConsentGranted(),
      'an unconfirmed grant is not a grant',
    ).toBe(false);
    expect(await dispatcher.emit('territory_opened')).toBe(false);
    expect(outbox()).toEqual([]);
    // MUTATION M6: make the ceiling symmetric (pending grant ⇒ granted) → red.
  });

  it('and opens it the moment the server confirms', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    await authority.reconcile();
    const outcome = await privacy.grantConsent();
    expect(outcome.outcome).toBe('confirmed');
    expect(await dispatcher.emit('territory_opened')).toBe(true);
  });
});

// ══ LAW 7 · the pending record is per-member ══════════════════════════

describe('LAW 7 — one member’s pending decision is never read for another', () => {
  it('the record is keyed by the member id, and B cannot see A’s', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'user_A');
    await userScope.migrationSettled();
    row('user_A').granted = true;
    row('user_A').seq = 1;
    await authority.reconcile();
    srv.consentFail = { status: 0, code: null };
    await privacy.revokeConsent();

    expect(pendingOnDisk('user_A')).toMatchObject({ action: 'revoke' });
    expect(pendingOnDisk('user_B'), 'B must have no record at all').toBeNull();
    // And the bare, device-global key must not exist — that is the whole
    // reason this record bypasses `scopedStorage` while isolation is off.
    expect(mem.has('@aforce/analytics-pending')).toBe(false);

    signIn(userScope, 'user_B');
    await userScope.migrationSettled();
    expect(authority.__authorityForTests.snapshot().pending).toBeNull();
    row('user_B').granted = true;
    row('user_B').seq = 1;
    await authority.reconcile();
    expect(
      await privacy.isConsentGranted(),
      'A’s revoke must not restrict B, and B’s grant is B’s own',
    ).toBe(true);
    // MUTATION M7: drop the `.${userId}` suffix from the key → red.
  });

  it('nothing is written when the scope is not a definite member', async () => {
    const { userScope, privacy } = await load();
    signIn(userScope, null); // signed out
    await userScope.migrationSettled();
    const outcome = await privacy.revokeConsent();
    expect(outcome).toEqual({ outcome: 'not_a_member' });
    expect([...mem.keys()].filter((k) => k.includes('analytics-pending'))).toEqual([]);
  });
});

// ══ LAW 8 · an account switch cancels in-flight publication ═══════════

describe('LAW 8 — a reconcile begun as A publishes nothing as B', () => {
  it('the switch discards A’s answer instead of writing it under B', async () => {
    const { userScope, authority } = await load();
    signIn(userScope, 'user_A');
    await userScope.migrationSettled();
    row('user_A').granted = true;
    row('user_A').seq = 1;

    // The reconcile is requested as A and the switch lands while it is still
    // waiting on its first await, so the identity round trip completes with the
    // token presenting as B.
    const inFlight = authority.reconcile();
    signIn(userScope, 'user_B'); // ← the account switch, mid-flight
    await inFlight;

    // The precise damage a missing barrier does is NOT "A's id becomes B's".
    // The reconcile captured `userId = 'user_A'` before the switch but the
    // answer arrives describing whoever the token now presents as — so it
    // writes the INCOMING member's pseudonym under the OUTGOING member's key.
    // A cancelled reconcile must therefore write nothing at all.
    expect(
      mem.get('@aforce/analytics-id.v2.user_A'),
      'a cancelled reconcile must not write under the member it started as',
    ).toBeUndefined();
    expect(mem.get('@aforce/analytics-id.v2.user_B')).toBeUndefined();
    const snap = authority.__authorityForTests.snapshot();
    expect(snap.serverId, 'and must publish nothing to memory either').toBeNull();
    expect(snap.adopted).toBeNull();
    // MUTATION M9: delete the post-resolve scopeTokenStillValid check → red.
  });

  it('a flush in flight during a switch does not settle the new member’s outbox', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'user_A');
    await userScope.migrationSettled();
    row('user_A').granted = true;
    row('user_A').seq = 1;
    await authority.reconcile();

    srv.ingest = 'unavailable';
    await dispatcher.emit('territory_opened');
    await settle();
    expect(outbox()).toHaveLength(1);

    // Switch accounts from INSIDE the request, so the switch lands exactly
    // while the POST is in flight. Doing it from the test body instead trips
    // the earlier barrier (the one guarding the gate) and the post-POST check
    // this law is about is never reached — the mutant then survives a law that
    // looks like it covers it.
    const api = await import('@/lib/api');
    const spy = vi.spyOn(api, 'postAnalyticsBatch').mockImplementation(async () => {
      signIn(userScope, 'user_B'); // ← the account switch, mid-request
      return { outcome: 'refused' as const };
    });

    await dispatcher.flush();
    // Asserted BEFORE mockRestore — restoring clears the call history, and a
    // law that checks it afterwards always reads zero.
    expect(spy, 'the law is worthless if the request never happened').toHaveBeenCalledTimes(1);
    spy.mockRestore();

    // The outbox is still device-global in this lane, so settling it against
    // the OUTGOING member's answer would delete the INCOMING member's events.
    expect(
      outbox(),
      'a flush cancelled by an account switch must not touch the outbox',
    ).toHaveLength(1);
    // MUTATION M20: delete the post-POST scopeTokenStillValid check → red.
  });

  it('an account switch drops the previous member’s state synchronously', async () => {
    const { userScope, authority } = await load();
    signIn(userScope, 'user_A');
    await userScope.migrationSettled();
    row('user_A').granted = true;
    row('user_A').seq = 1;
    await authority.reconcile();
    expect(authority.__authorityForTests.snapshot().serverId).toBe('anon_srv_user_A');

    signIn(userScope, 'user_B'); // no awaits after this line
    const snap = authority.__authorityForTests.snapshot();
    expect(snap.serverId).toBeNull();
    expect(snap.adopted).toBeNull();
    expect(snap.pending).toBeNull();
    // MUTATION M9: remove the subscribeUserScope reset → red.
  });
});

// ══ LAW 9 · transient vs terminal failures ════════════════════════════

describe('LAW 9 — a temporary session loss stays queued', () => {
  it('a 401 leaves the decision retryable and the ceiling up', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    srv.consentFail = { status: 401, code: null };
    const outcome = await privacy.revokeConsent();
    expect(outcome.outcome).toBe('queued');
    expect(pendingOnDisk('u1')).toMatchObject({ action: 'revoke', state: 'queued' });
    expect(await privacy.isConsentGranted()).toBe(false);

    srv.consentFail = null;
    await authority.reconcile();
    expect(pendingOnDisk('u1'), 'the retry must eventually land').toBeNull();
    expect(row('u1').granted).toBe(false);
    // MUTATION M10: classify 401 as terminal → red (it would go to
    // needs_resolution and never retry on its own).
  });
});

describe('LAW 10 — a permanent refusal is never re-POSTed forever', () => {
  it('a standing 403 goes to needs_resolution and stops being sent', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    srv.consentFail = { status: 403, code: 'identity_requires_member' };
    const outcome = await privacy.revokeConsent();
    expect(outcome.outcome).toBe('needs_resolution');
    const postsAfterFirst = srv.consentPosts;

    // Six foregrounds. None of them may ask the server the same impossible
    // question again. This is the infinite-retry-state law.
    for (let i = 0; i < 6; i += 1) await authority.reconcile();
    expect(srv.consentPosts, 'a terminal decision must not be re-sent').toBe(postsAfterFirst);

    // …and the ceiling is still up while it waits for the member.
    expect(await privacy.isConsentGranted()).toBe(false);
    const ui = await privacy.getConsentUiState();
    expect(ui.status).toBe('needs_resolution');
    // MUTATION M11: treat an unknown/unnamed 403 as transient → red.
  });

  it('an unnamed 403 is treated as terminal too — fail closed on the LOOP', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    await authority.reconcile();
    srv.consentFail = { status: 403, code: null };
    const outcome = await privacy.grantConsent();
    expect(outcome.outcome).toBe('needs_resolution');
    const posts = srv.consentPosts;
    for (let i = 0; i < 4; i += 1) await authority.reconcile();
    expect(srv.consentPosts).toBe(posts);
  });

  it('only the member’s explicit retry leaves needs_resolution', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();
    srv.consentFail = { status: 400, code: 'invalid_body' };
    await privacy.revokeConsent();
    expect((await privacy.getConsentUiState()).status).toBe('needs_resolution');

    srv.consentFail = null; // the condition has cleared…
    await authority.reconcile();
    expect(
      (await privacy.getConsentUiState()).status,
      'reconcile alone must NOT revive it — that is what terminal means',
    ).toBe('needs_resolution');

    const outcome = await privacy.retryPendingDecision();
    expect(outcome.outcome).toBe('confirmed');
    expect(row('u1').granted).toBe(false);
    // MUTATION M12: let reconcile revive needs_resolution → red.
  });
});

// ══ LAW 11 · conflict handling is bounded ═════════════════════════════

describe('LAW 11 — a 409 whose state already satisfies the member clears', () => {
  it('another device’s identical decision settles ours without re-issuing', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    srv.consentFail = { status: 0, code: null }; // offline revoke
    await privacy.revokeConsent();
    // Meanwhile the OTHER device revoked successfully.
    row('u1').granted = false;
    row('u1').seq = 5;
    srv.consentFail = null;
    const postsBefore = srv.consentPosts;

    await authority.reconcile();
    expect(pendingOnDisk('u1'), 'intent satisfied ⇒ nothing left pending').toBeNull();
    expect(
      srv.consentPosts,
      'there is nothing to send when the server already agrees',
    ).toBe(postsBefore);
    // MUTATION M13: always re-POST on conflict → red.
  });
});

describe('LAW 12 — a genuine conflict is re-issued at most once, then parked', () => {
  it('stops at MAX_CONFLICT_REISSUES instead of spinning', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    await authority.reconcile();

    // The server disagrees forever AND never matches the expected seq: a
    // genuine, permanent disagreement.
    srv.consentAlwaysStale = true;
    row('u1').granted = false;
    row('u1').seq = 9;
    const outcome = await privacy.grantConsent();

    expect(outcome.outcome).toBe('needs_resolution');
    expect(
      srv.consentPosts,
      'one attempt plus MAX_CONFLICT_REISSUES re-issues, and no more',
    ).toBe(1 + authority.MAX_CONFLICT_REISSUES);

    const posts = srv.consentPosts;
    for (let i = 0; i < 5; i += 1) await authority.reconcile();
    expect(srv.consentPosts).toBe(posts);
    // MUTATION M14: remove the reissue bound → red (unbounded POSTs).
  });
});

// ══ LAW 13 · `inserted: 0` is settlement, not delivery ════════════════

describe('LAW 13 — a refused batch is settled and counted, never called delivered', () => {
  it('the envelopes leave the outbox and are not retried forever', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    srv.ingest = 'unavailable';
    await dispatcher.emit('territory_opened');
    await dispatcher.emit('territory_engaged', { action: 'region_selected' });
    await settle();
    expect(outbox(), 'an unavailable server keeps the batch owed').toHaveLength(2);

    srv.ingest = 'refused';
    await dispatcher.flush();
    expect(outbox(), 'a refusal is terminal for those envelopes').toEqual([]);
    expect(dispatcher.getSettlementCounters().refused).toBe(2);

    const batchesBefore = srv.ingestBatches.length;
    await dispatcher.flush();
    await settle();
    await dispatcher.flush();
    await settle();
    expect(
      srv.ingestBatches.length,
      'nothing may be re-sent — there is nothing left owed',
    ).toBe(batchesBefore);
    // MUTATION M15: treat `{inserted:0}` as retryable → red (outbox never
    // drains). MUTATION M16: count it as `accepted` → red.
  });

  it('settlement is reported as settlement — delivery is counted separately', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    srv.ingest = 'unavailable';
    await dispatcher.emit('territory_opened');
    await settle();
    srv.ingest = 'refused';
    await dispatcher.flush();

    const c = dispatcher.getSettlementCounters();
    // A refusal is deliberately uninformative: it could be revoked, suppressed,
    // or not-a-member. The client must not claim to know which, and must not
    // read a privacy state out of the number.
    expect(c.refused).toBe(1);
    expect(c.notOwned).toBe(0);
    expect(c.foreign).toBe(0);
  });

  it('a 403 not_owned also settles rather than wedging', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    srv.ingest = 'unavailable';
    await dispatcher.emit('territory_opened');
    await settle();
    srv.ingest = 'not_owned';
    await dispatcher.flush();
    expect(outbox()).toEqual([]);
    expect(dispatcher.getSettlementCounters().notOwned).toBe(1);
  });
});

// ══ LAW 14 · the legacy outbox is filtered, not purged ════════════════

describe('LAW 14 — one legacy envelope cannot wedge the outbox', () => {
  it('foreign envelopes are settled out and the rest still flush', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    // A leftover from the old LOCAL mint, plus one legitimate envelope.
    mem.set(
      OUTBOX_KEY,
      JSON.stringify([
        {
          eventId: 'evt_legacy_00000001',
          eventType: 'territory_opened',
          analytics_id: 'anon_locally_minted',
          occurredAt: new Date().toISOString(),
          schemaVersion: 1,
          payload: {},
        },
      ]),
    );
    await dispatcher.emit('territory_opened'); // stamped with the server id
    await settle();

    await dispatcher.flush();
    await settle();
    expect(dispatcher.getSettlementCounters().foreign).toBe(1);
    for (const batch of srv.ingestBatches) {
      expect(
        batch.every((e) => e.analytics_id === 'anon_srv_u1'),
        'a batch containing a foreign id is refused WHOLESALE by the server',
      ).toBe(true);
    }
    expect(outbox(), 'everything is settled or stored').toEqual([]);
    // MUTATION M17: stop filtering foreign envelopes → red (the server
    // refuses the whole batch and it never drains).
  });

  it('the outbox KEY survives, and the legacy id key is never deleted', async () => {
    const { userScope, authority, dispatcher } = await load();
    mem.set(LEGACY_ID_KEY, 'anon_locally_minted');
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();
    await dispatcher.emit('territory_opened');
    await settle();

    expect(mem.has(OUTBOX_KEY), 'the outbox key itself is not purged in this lane').toBe(true);
    expect(
      mem.get(LEGACY_ID_KEY),
      'purging the legacy analytics-id key is explicitly out of scope (PR D)',
    ).toBe('anon_locally_minted');
  });

  it('the legacy id is never used as an identity', async () => {
    const { userScope, authority, privacy } = await load();
    mem.set(LEGACY_ID_KEY, 'anon_locally_minted');
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    srv.resolveFail = { status: 0, code: null }; // no server answer
    await authority.reconcile();
    expect(
      await privacy.getAnalyticsId(),
      'the old local value must not become the member’s pseudonym',
    ).toBeNull();
    // MUTATION M18: read LEGACY_ID_KEY as a fallback id → red.
  });
});

// ══ LAW 15 · suppression ══════════════════════════════════════════════

describe('LAW 15 — a suppressed member is not re-enrolled', () => {
  it('no id, no emission, and a pending revoke is treated as satisfied', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    srv.consentFail = { status: 0, code: null };
    await privacy.revokeConsent(); // queued offline
    row('u1').suppressed = true; // forgotten on another device
    srv.consentFail = null;
    await authority.reconcile();

    expect(await privacy.getAnalyticsId()).toBeNull();
    expect(await privacy.isConsentGranted()).toBe(false);
    expect(await dispatcher.emit('territory_opened')).toBe(false);
    expect(
      pendingOnDisk('u1'),
      'a suppressed member is not collected — the revoke’s intent is met',
    ).toBeNull();
    // MUTATION M19: keep minting/caching an id for a suppressed member → red.
  });

  it('delete-my-data clears the local authority state and the outbox', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();
    srv.ingest = 'unavailable';
    await dispatcher.emit('territory_opened');
    await settle();
    expect(outbox()).toHaveLength(1);

    const result = await privacy.deleteMyData(dispatcher.clearOutbox);
    expect(result.serverDeleted).toBe(3);
    expect(outbox()).toEqual([]);
    expect(await privacy.getAnalyticsId()).toBeNull();
    expect(await privacy.isConsentGranted()).toBe(false);
    expect(mem.get('@aforce/analytics-id.v2.u1')).toBeUndefined();
  });
});

// ══ LAW 16 · a crash mid-flight is recoverable ════════════════════════

describe('LAW 16 — an inflight decision is re-sent after a crash', () => {
  it('the record is durable BEFORE the request, so the next launch retries', async () => {
    const first = await load();
    signIn(first.userScope, 'u1');
    await first.userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await first.authority.reconcile();

    // Crash during the POST: the request is issued, the answer never arrives.
    const api = await import('@/lib/api');
    const spy = vi.spyOn(api, 'postAnalyticsConsent').mockImplementation(async () => {
      throw new Error('process died');
    });
    await first.privacy.revokeConsent().catch(() => undefined);
    spy.mockRestore();
    expect(
      pendingOnDisk('u1'),
      'the decision must be on disk before the request, not after it',
    ).toMatchObject({ action: 'revoke' });

    // ── relaunch ──
    const next = await load();
    signIn(next.userScope, 'u1');
    await next.userScope.migrationSettled();
    await next.authority.reconcile();
    expect(row('u1').granted, 'the re-send must land').toBe(false);
    expect(pendingOnDisk('u1')).toBeNull();
    // MUTATION M20: persist the record only AFTER the response → red.
  });
});

// ══ LAW 17 · the UI can render every state ════════════════════════════

describe('LAW 17 — the consent UI has a state for every outcome', () => {
  it('unknown → settled → pending → needs_resolution are all distinguishable', async () => {
    const { userScope, authority, privacy } = await load();

    userScope.__resetUserScopeForTests(); // UNRESOLVED
    srv.actingAs = null;
    expect((await privacy.getConsentUiState()).status).toBe('unknown');

    signIn(userScope, null); // signed out
    expect((await privacy.getConsentUiState()).status).toBe('not_a_member');

    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    await authority.reconcile();
    const settled = await privacy.getConsentUiState();
    expect(settled).toEqual({ status: 'settled', granted: false, answered: false });

    srv.consentFail = { status: 0, code: null };
    await privacy.revokeConsent();
    expect(await privacy.getConsentUiState()).toEqual({
      status: 'pending',
      action: 'revoke',
      granted: false,
    });

    srv.consentFail = { status: 403, code: 'identity_requires_member' };
    await authority.reconcile();
    expect(await privacy.getConsentUiState()).toEqual({
      status: 'needs_resolution',
      action: 'revoke',
      granted: false,
    });
  });

  it('`answered` reflects a real server decision, never a sentinel', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 4;
    await authority.reconcile();
    expect(await privacy.getConsentUiState()).toEqual({
      status: 'settled',
      granted: true,
      answered: true,
    });
  });
});

// ══ NON-VACUITY CONTROL ══════════════════════════════════════════════

describe('NON-VACUITY — a client that refuses everything must FAIL', () => {
  it('there is at least one law that only a collecting client can pass', async () => {
    // The mutant: the gate always refuses. If every law above were a
    // "must not collect" law, this mutant would pass the whole suite and the
    // suite would prove nothing about the feature working at all.
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    await userScope.migrationSettled();
    row('u1').granted = true;
    row('u1').seq = 1;
    await authority.reconcile();

    const emitted = await dispatcher.emit('territory_opened');
    expect(
      emitted,
      'a fully granted member with a server id MUST collect — this is the ' +
        'assertion the refuse-everything mutant cannot satisfy',
    ).toBe(true);
    await settle();
    expect(srv.ingestBatches.flat().map((e) => e.analytics_id)).toEqual(['anon_srv_u1']);
  });
});
