/**
 * CLIENT ANALYTICS REMEDIATION (Lane 2) — RELEASE-BLOCKING LAWS.
 *
 * Every law here exists because a defect got past the previous lane's laws.
 * Six of them were found by an adversarial audit of merged code; two of those
 * falsified a proof this program had published. So each law below names the
 * exact sequence it forbids, and the mutation matrix records which assertion
 * kills which mutant.
 *
 * Drives the REAL modules over in-memory storage and a driveable stand-in for
 * the S1-3 endpoints. Nothing here asserts on source text.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row { id: string; granted: boolean; seq: number | null; dv: number; suppressed: boolean }

const { mem, srv } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  srv: {
    actingAs: null as string | null,
    rows: new Map<string, Row>(),
    resolveFail: null as { status: number; code: string | null } | null,
    consentFail: null as { status: number; code: string | null } | null,
    forgetThrows: false,
    consentPosts: 0,
    /** Holds every getItem: the value is snapshotted at CALL time. */
    diskGate: null as null | Promise<void>,
    /** Keys whose read throws, to simulate a storage-layer fault. */
    readThrows: new Set<string>(),
  },
}));

function row(u: string): Row {
  let r = srv.rows.get(u);
  if (!r) { r = { id: `anon_srv_${u}`, granted: false, seq: null, dv: 1, suppressed: false }; srv.rows.set(u, r) }
  return r;
}

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => {
      if (srv.readThrows.has(k)) throw new Error('storage unavailable');
      // Faithful model of an in-flight read: value fixed at call time,
      // delivery delayed. A read that began before a write must not see it.
      const snapshot = mem.has(k) ? (mem.get(k) as string) : null;
      const g = srv.diskGate;
      if (g) await g;
      return snapshot;
    },
    setItem: async (k: string, v: string) => { mem.set(k, v) },
    removeItem: async (k: string) => { mem.delete(k) },
  },
}));
vi.mock('../../services/secureStorage', () => ({
  secureKV: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

vi.mock('@/lib/api', () => ({
  resolveAnalyticsIdentity: async () => {
    if (srv.resolveFail) return { ok: false as const, ...srv.resolveFail };
    const u = srv.actingAs;
    if (u === null) return { ok: false as const, status: 403, code: 'identity_requires_member' };
    const r = row(u);
    if (r.suppressed) return { ok: false as const, status: 409, code: 'analytics_identity_suppressed' };
    return { ok: true as const, identity: { analyticsId: r.id, status: 'active' as const,
      consent: { granted: r.granted, decisionSeq: r.seq, disclosureVersion: r.dv } } };
  },
  postAnalyticsConsent: async (a: { action: 'grant' | 'revoke'; disclosureVersion: number; expectedSeq: number | null }) => {
    srv.consentPosts += 1;
    if (srv.consentFail) return { ok: false as const, ...srv.consentFail };
    const u = srv.actingAs;
    if (u === null) return { ok: false as const, status: 403, code: 'identity_requires_member' };
    const r = row(u);
    const wire = (x: Row) => ({ granted: x.granted, decisionSeq: x.seq, disclosureVersion: x.dv });
    if (r.seq !== a.expectedSeq) return { ok: false as const, stale: true as const, current: wire(r) };
    r.granted = a.action === 'grant'; r.seq = (r.seq ?? 0) + 1; r.dv = a.disclosureVersion;
    return { ok: true as const, consent: wire(r) };
  },
  postAnalyticsBatch: async () => ({ outcome: 'stored' as const, received: 1, accepted: 1, deduped: 0 }),
  forgetAnalyticsIdentity: async () => {
    if (srv.forgetThrows) throw new Error('POST /aforce/analytics-identity/forget → 0 offline');
    const u = srv.actingAs;
    if (u !== null) { const r = row(u); r.suppressed = true; r.granted = false }
    return { deleted: 3, status: 'suppressed' };
  },
}));

const PENDING = (u: string) => `@aforce/analytics-pending.${u}`;
const SERVER_ID = (u: string) => `@aforce/analytics-id.v2.${u}`;

async function load() {
  vi.resetModules();
  const userScope = await import('../../services/userScope');
  const authority = await import('../consentAuthority');
  const privacy = await import('../privacy_manager');
  const dispatcher = await import('../event_dispatcher');
  return { userScope, authority, privacy, dispatcher };
}
const signIn = (us: Awaited<ReturnType<typeof load>>['userScope'], u: string | null) => {
  srv.actingAs = u;
  us.resolveScope(u === null ? { status: 'ANONYMOUS' } : { status: 'AUTHENTICATED', userId: u });
};
const settle = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  mem.clear(); srv.rows.clear(); srv.actingAs = null;
  srv.resolveFail = null; srv.consentFail = null; srv.forgetThrows = false;
  srv.consentPosts = 0; srv.diskGate = null; srv.readThrows.clear();
});

// ══ 1 · the server id is persisted and read back ═══════════════════════

describe('LAW R1 — the server pseudonym is actually persisted, and read back', () => {
  it('a reconcile writes it to disk, and a fresh process reads it from there', async () => {
    const first = await load();
    signIn(first.userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    await first.authority.reconcile();
    expect(
      mem.get(SERVER_ID('u1')),
      'the cache is unproven if nothing ever asserts it is WRITTEN with a value',
    ).toBe('anon_srv_u1');

    // A fresh process with the server unreachable must still recover the id
    // from disk — that is the only thing the cache is for.
    const next = await load();
    signIn(next.userScope, 'u1');
    srv.resolveFail = { status: 0, code: null };
    expect(await next.privacy.getAnalyticsId(), 'read back from disk, not re-fetched').toBe('anon_srv_u1');
    // MUTATION: make saveServerId a no-op → red. Delete `serverId = id` from
    // hydrate → red.
  });
});

// ══ 2 · failed persistence is distinguishable from success ═════════════

describe('LAW R2 — a failed persistence is not reported as a successful one', () => {
  it('an unreadable pending record is a DIFFERENT state from no record', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    await authority.reconcile();
    expect((await privacy.getConsentUiState()).status).toBe('settled');

    // Same member, same absence of a *readable* record — but one is a storage
    // fault and the other is genuinely nothing pending.
    mem.set(PENDING('u1'), '{"action":');           // truncated write
    const corrupt = await load();
    signIn(corrupt.userScope, 'u1');
    const cu = await corrupt.privacy.getConsentUiState();
    expect(cu.status, 'a fault must not masquerade as "no decision pending"').toBe('unreadable');
    expect(await corrupt.privacy.isConsentGranted()).toBe(false);

    mem.delete(PENDING('u1'));
    const clean = await load();
    signIn(clean.userScope, 'u1');
    await clean.authority.reconcile();
    expect((await clean.privacy.getConsentUiState()).status).toBe('settled');
  });

  it('a storage-layer read fault is also fail-closed, and retried rather than latched', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    srv.readThrows.add(PENDING('u1'));
    await authority.reconcile();
    expect(await privacy.isConsentGranted(), 'we do not know, so we do not collect').toBe(false);

    // The fault clears. Because an unreadable read must not latch
    // `hydratedFor`, the next read retries the disk and recovers.
    srv.readThrows.clear();
    await authority.reconcile();
    expect(await privacy.isConsentGranted()).toBe(true);
    // MUTATION: latch hydratedFor on the unreadable path → red (never recovers).
  });
});

// ══ 3 · a late hydrate cannot overwrite a newer server id ══════════════

describe('LAW R3 — a stale disk read cannot clobber a live pseudonym', () => {
  it('the proved state adopted.granted && serverId===null is impossible after hydration settles', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;

    // A hydrate begins while the cache is still empty and is held open.
    let open: () => void = () => {};
    srv.diskGate = new Promise<void>((r) => { open = r });
    void authority.getServerAnalyticsId();
    await settle();

    // A transient Clerk hiccup and recovery to the SAME member. This nulls the
    // hydrate latch WITHOUT cancelling the in-flight read, and with the
    // isolation flag off the generation never moves, so its scope token stays
    // valid — which is how the stale read used to get published.
    userScope.resolveScope({ status: 'UNVERIFIABLE', reason: 'signed_in_without_user_id' });
    userScope.resolveScope({ status: 'AUTHENTICATED', userId: 'u1' });

    srv.diskGate = null;
    await authority.reconcile();
    expect(authority.__authorityForTests.snapshot().serverId).toBe('anon_srv_u1');

    open();                       // the stale read lands
    await settle(); await settle();

    const snap = authority.__authorityForTests.snapshot();
    expect(snap.adopted?.granted).toBe(true);
    expect(
      snap.serverId,
      'THE state the retracted M1/M3 proof called unreachable: granted with no id ' +
        'while a valid id sits on disk',
    ).toBe('anon_srv_u1');
    expect(await privacy.getAnalyticsId()).toBe('anon_srv_u1');
    expect(await dispatcher.emit('territory_opened'), 'and collection continues').toBe(true);
    // MUTATION: drop the serverIdWriteSeq guard in hydrate → red.
  });
});

// ══ 4 · delete failure leaves analytics closed across restart ══════════

describe('LAW R4 — a failed delete-my-data fails CLOSED, and stays closed', () => {
  it('never: delete → failure → local cleared → server grant re-adopted → collection resumes', async () => {
    const first = await load();
    signIn(first.userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 5;
    await first.authority.reconcile();
    expect(await first.privacy.isConsentGranted()).toBe(true);

    srv.forgetThrows = true;
    await expect(
      first.privacy.deleteMyData(first.dispatcher.clearOutbox),
      'a failure must REACH the caller so the UI can say so',
    ).rejects.toThrow();

    // The server is untouched — it still says granted.
    expect(srv.rows.get('u1')).toMatchObject({ granted: true, suppressed: false });
    // And a durable ceiling is on disk.
    expect(mem.get(PENDING('u1')), 'the ceiling must be DURABLE').toBeDefined();
    expect(JSON.parse(mem.get(PENDING('u1')) as string)).toMatchObject({ action: 'revoke' });
    expect(await first.privacy.isConsentGranted()).toBe(false);

    // ── restart, server reachable and still granting ──
    const next = await load();
    signIn(next.userScope, 'u1');
    srv.forgetThrows = false;
    await next.authority.reconcile();
    expect(
      await next.privacy.isConsentGranted(),
      'the erase was never confirmed, so the gate stays closed across the restart',
    ).toBe(false);
    expect(await next.dispatcher.emit('territory_opened')).toBe(false);
    // and the revoke the member implicitly asked for did reach the server
    expect(srv.rows.get('u1')?.granted).toBe(false);
    // MUTATION: clear local state in a `finally` → red.
  });

  it('a CONFIRMED delete clears local state and reports the count', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 5;
    await authority.reconcile();
    const result = await privacy.deleteMyData(dispatcher.clearOutbox);
    expect(result.serverDeleted).toBe(3);
    expect(mem.get(SERVER_ID('u1'))).toBeUndefined();
    expect(mem.get(PENDING('u1'))).toBeUndefined();
    expect(await privacy.isConsentGranted()).toBe(false);
  });
});

// ══ 5 · a corrupt record cannot lift a revoke ceiling ══════════════════

describe('LAW R5 — corruption is not permission', () => {
  it('a corrupt pending record does not lift an established revoke ceiling', async () => {
    const first = await load();
    signIn(first.userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    await first.authority.reconcile();
    srv.consentFail = { status: 0, code: null };
    await first.privacy.revokeConsent();
    expect(mem.get(PENDING('u1'))).toBeDefined();

    // The record is damaged on disk between runs.
    mem.set(PENDING('u1'), '{"action":"rev');

    const next = await load();
    signIn(next.userScope, 'u1');
    srv.consentFail = null;                    // server reachable, still granting
    await next.authority.reconcile();
    expect(
      await next.privacy.isConsentGranted(),
      'unreadable bytes must NOT become "no ceiling" and re-adopt the grant',
    ).toBe(false);
    expect(await next.dispatcher.emit('territory_opened')).toBe(false);
    expect((await next.privacy.getConsentUiState()).status).toBe('unreadable');
    // MUTATION: return null for a corrupt parse → red.
  });

  it('and the member can recover by deciding again', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    mem.set(PENDING('u1'), 'not json at all');
    await authority.reconcile();
    expect((await privacy.getConsentUiState()).status).toBe('unreadable');

    const outcome = await privacy.grantConsent();
    expect(outcome.outcome, 'a real decision replaces the unreadable bytes').toBe('confirmed');
    expect(await privacy.isConsentGranted()).toBe(true);
  });
});

// ══ 6 · a decision made during reconcile survives publication ══════════

describe('LAW R6 — a decision recorded mid-flight is not erased by the older one', () => {
  it('a revoke made while a grant is in flight survives, and the ceiling holds', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    await authority.reconcile();                    // id issued, never decided

    // Hold the consent POST open so a second decision lands mid-flight.
    let open: () => void = () => {};
    const held = new Promise<void>((r) => { open = r });
    const api = await import('@/lib/api');
    const real = api.postAnalyticsConsent;
    const spy = vi.spyOn(api, 'postAnalyticsConsent').mockImplementation(async (a) => {
      await held;
      return real(a);
    });

    const granting = privacy.grantConsent();
    await settle();
    // The member changes their mind while the grant is still in flight.
    const revoking = privacy.revokeConsent();
    open();
    await Promise.all([granting, revoking]);
    spy.mockRestore();

    // The revoke either is still pending or has been published — both are
    // correct. What must NOT happen is that the in-flight grant's success
    // handler erased its record, which loses the decision entirely: the
    // re-run pass then finds nothing pending, the revoke never reaches the
    // server, and the adopted grant stands with no ceiling over it.
    expect(
      await privacy.isConsentGranted(),
      "the newer decision must not be erased by the older publication",
    ).toBe(false);
    expect(
      srv.rows.get('u1')?.granted,
      'and it must actually have reached the server',
    ).toBe(false);
    const snap = authority.__authorityForTests.snapshot();
    expect(snap.pending === null || snap.pending.action === 'revoke').toBe(true);
    // MUTATION: drop the publishSeq guard in publishPending → red.
  });
});

// ══ 7 · first-time consent is actionable ══════════════════════════════

describe('LAW R7 — a first-time member can actually decide', () => {
  it('`unsynced` does not disable the only control that can leave it', async () => {
    const { userScope, privacy } = await load();
    signIn(userScope, 'u1');
    // No reconcile has run: this is a first-time member on a cold start.
    const ui = await privacy.getConsentUiState();
    expect(ui.status, 'not `unknown` — that disabled the switch').toBe('unsynced');

    // The exact predicate AnalyticsConsentRow uses.
    const manageable =
      ui.status !== 'unknown' && ui.status !== 'not_a_member' && ui.status !== 'suppressed';
    expect(manageable, 'the switch must be operable').toBe(true);
    // MUTATION: return `unknown` for an authenticated member with no adopted
    // state → red.
  });

  it('and the decision they make reaches the server without any adopted state', async () => {
    const { userScope, privacy } = await load();
    signIn(userScope, 'u1');
    expect((await privacy.getConsentUiState()).status).toBe('unsynced');
    const outcome = await privacy.grantConsent();
    expect(outcome.outcome).toBe('confirmed');
    expect(srv.rows.get('u1')).toMatchObject({ granted: true, seq: 1 });
  });

  it('nothing is auto-granted or auto-revoked by merely rendering', async () => {
    const { userScope, privacy } = await load();
    signIn(userScope, 'u1');
    for (let i = 0; i < 5; i += 1) await privacy.getConsentUiState();
    expect(srv.consentPosts, 'rendering must never decide for the member').toBe(0);
    expect(srv.rows.has('u1'), 'and must not create server state').toBe(false);
  });
});

// ══ 8 · suppression offers no impossible retry ════════════════════════

describe('LAW R8 — a suppressed identity presents no retry that cannot succeed', () => {
  it('renders a terminal state, not needs_resolution', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    await authority.reconcile();
    await privacy.deleteMyData(dispatcher.clearOutbox);   // now suppressed

    await authority.reconcile();
    const ui = await privacy.getConsentUiState();
    expect(ui.status, 'suppression is permanent — `needs_resolution` implies a retry').toBe('suppressed');

    const manageable =
      ui.status !== 'unknown' && ui.status !== 'not_a_member' && ui.status !== 'suppressed';
    expect(manageable, 'and the control is not offered').toBe(false);
    expect(await dispatcher.emit('territory_opened')).toBe(false);
    // MUTATION: route the suppressed code to markNeedsResolution → red.
  });

  it('and an explicit retry is refused rather than POSTed forever', async () => {
    const { userScope, authority, privacy, dispatcher } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    await authority.reconcile();
    await privacy.deleteMyData(dispatcher.clearOutbox);
    await authority.reconcile();

    const before = srv.consentPosts;
    for (let i = 0; i < 4; i += 1) await privacy.retryPendingDecision();
    for (let i = 0; i < 4; i += 1) await authority.reconcile();
    expect(srv.consentPosts, 'nothing may keep asking an impossible question').toBe(before);
  });
});

// ══ 9 · disclosure version participates in conflict resolution ════════

describe('LAW R9 — a conflict compares intent AND disclosure version', () => {
  it('a re-grant under a NEW disclosure is sent, not short-circuited as satisfied', async () => {
    const { userScope, authority } = await load();
    signIn(userScope, 'u1');
    // The server holds a grant recorded under a DIFFERENT disclosure than the
    // one the member is acting under now. The direction does not matter — the
    // predicate is equality — and seeding it this way keeps the law valid when
    // DISCLOSURE_VERSION is eventually bumped.
    row('u1').granted = true; row('u1').seq = 3;
    row('u1').dv = authority.DISCLOSURE_VERSION + 1;
    await authority.reconcile();

    const before = srv.consentPosts;
    // The member re-grants under version 2 — the same INTENT, a different
    // disclosure. Comparing only the boolean drops this on the floor and the
    // server's evidence says forever that they agreed to v1.
    await authority.recordDecision('grant');
    expect(srv.consentPosts, 'the decision must actually be sent').toBeGreaterThan(before);
    expect(srv.rows.get('u1')?.dv).toBe(authority.DISCLOSURE_VERSION);
    // MUTATION: compare only `granted` in conflictSatisfiesIntent → red.
  });

  it('but an identical decision under the SAME disclosure is still not re-sent', async () => {
    const { userScope, authority } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 3; row('u1').dv = authority.DISCLOSURE_VERSION;
    await authority.reconcile();
    const before = srv.consentPosts;
    await authority.recordDecision('grant');
    expect(srv.consentPosts, 'no pointless write when the server already agrees').toBe(before);
  });
});

// ══ 10 · no corrupt record is restamped with the current version ══════

describe('LAW R10 — an unreadable disclosure version is never invented', () => {
  it('a record missing its disclosure version is unreadable, not restamped', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    // A record whose disclosureVersion is absent. Restamping it with the
    // current constant POSTs evidence that the member agreed to text they may
    // never have seen — the sentinel the server contract forbids.
    mem.set(PENDING('u1'), JSON.stringify({
      action: 'grant', basedOnSeq: null, state: 'queued', reissues: 0, createdAtMs: 1,
    }));
    await authority.reconcile();
    expect((await privacy.getConsentUiState()).status).toBe('unreadable');
    expect(
      srv.rows.get('u1')?.dv,
      'nothing may be POSTed on the strength of an invented version',
    ).toBe(1);
  });

  it('a non-numeric disclosure version is unreadable too', async () => {
    const { userScope, authority, privacy } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    mem.set(PENDING('u1'), JSON.stringify({
      action: 'revoke', disclosureVersion: 'v2', basedOnSeq: null,
      state: 'queued', reissues: 0, createdAtMs: 1,
    }));
    await authority.reconcile();
    expect((await privacy.getConsentUiState()).status).toBe('unreadable');
    expect(await privacy.isConsentGranted(), 'and fails closed').toBe(false);
    // MUTATION: fall back to DISCLOSURE_VERSION on a bad parse → red.
  });
});

// ══ NON-VACUITY ══════════════════════════════════════════════════════

describe('NON-VACUITY — a client that refuses everything must FAIL', () => {
  it('a granted member with a server id still collects', async () => {
    const { userScope, authority, dispatcher } = await load();
    signIn(userScope, 'u1');
    row('u1').granted = true; row('u1').seq = 1;
    await authority.reconcile();
    expect(await dispatcher.emit('territory_opened')).toBe(true);
  });
});
