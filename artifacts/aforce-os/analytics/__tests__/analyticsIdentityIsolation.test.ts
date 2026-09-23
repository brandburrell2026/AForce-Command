/**
 * Wave-3 PR12 — analytics identity + consent isolation (approved W2-N4
 * subset), driven through the REAL privacy manager over in-memory
 * storage:
 *
 *   USER A grants consent → sign-out → USER B signs in
 *     → B has NO consent, NO pseudonym (never inherits A's grant or id)
 *   USER A returns → A's consent + pseudonym are intact.
 *
 * UPDATED for the client analytics transition. The assertions that mattered are
 * unchanged — B inherits nothing, A gets their own state back — but HOW they
 * hold is now different, and the difference is the point of that lane:
 *
 *   - the pseudonym is ISSUED BY THE SERVER, not minted locally, so `grant`
 *     no longer produces an id by itself and A's id is A's because the server
 *     says so;
 *   - consent is the SERVER'S state, adopted on reconcile and deliberately not
 *     cached on disk, so a returning member's grant comes back from the server
 *     rather than from a local file that could disagree with it.
 *
 * Legacy consent record — QUARANTINE (DR-016, 2026-09-23). The pre-isolation
 * GLOBAL `@aforce/analytics-consent` record is RETAINED in place, byte for
 * byte; it is NEVER copied into a member's namespace, never attributed to a
 * member, and never read as that member's consent or as that member's answer
 * to the prompt. The device is marked `aforce.namespaceMigration.quarantined`
 * = '1' (a marker that carries no member identity) and nothing else moves.
 * This supersedes the Wave-3 PR12 copy-and-retain rule (commit 71c46b5c,
 * 2026-08-12) and retires the retention-exception export it relied on. The
 * quarantine implementation landed in #987 (2026-09-15) without a decision
 * record; DR-016 is its first ratification. The 'DR-016 — legacy consent
 * quarantine evidence' block below is the privacy-review evidence the decision
 * requires before merge, one case per evidence item, all driven through the
 * real modules (userScope, scopedStorage, privacy_manager, consentAuthority).
 *
 * STOP portion honored (documented, not scoped): the pre-auth
 * activation capture keys stay global by design.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mem, server } = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  server: {
    /** userId → the member's server-side identity + consent row. */
    rows: new Map<string, { id: string; granted: boolean; seq: number | null }>(),
    /** Which member the auth token presents as. Set alongside the scope. */
    actingAs: null as string | null,
    /**
     * OFFLINE switch. `{ status: 0, code: null }` is exactly what
     * `lib/api.requestEither` reports for a transport failure — status 0,
     * no body, therefore no code. Mirrors clientAnalyticsTransition.test.ts.
     */
    resolveFail: null as { status: number; code: string | null } | null,
    consentFail: null as { status: number; code: string | null } | null,
  },
}));

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

/** A minimal stand-in for the S1-3 endpoints, keyed by the acting member. */
vi.mock('@/lib/api', () => ({
  resolveAnalyticsIdentity: async () => {
    if (server.resolveFail) return { ok: false, ...server.resolveFail };
    const u = server.actingAs;
    if (u === null) return { ok: false, status: 403, code: 'identity_requires_member' };
    let row = server.rows.get(u);
    if (!row) {
      row = { id: `anon_srv_${u}`, granted: false, seq: null };
      server.rows.set(u, row);
    }
    return {
      ok: true,
      identity: {
        analyticsId: row.id,
        status: 'active',
        consent: { granted: row.granted, decisionSeq: row.seq, disclosureVersion: 1 },
      },
    };
  },
  postAnalyticsConsent: async (args: { action: 'grant' | 'revoke'; expectedSeq: number | null }) => {
    if (server.consentFail) return { ok: false, ...server.consentFail };
    const u = server.actingAs;
    if (u === null) return { ok: false, status: 403, code: 'identity_requires_member' };
    const row = server.rows.get(u) ?? { id: `anon_srv_${u}`, granted: false, seq: null };
    if (row.seq !== args.expectedSeq) {
      return {
        ok: false,
        stale: true,
        current: { granted: row.granted, decisionSeq: row.seq, disclosureVersion: 1 },
      };
    }
    row.granted = args.action === 'grant';
    row.seq = (row.seq ?? 0) + 1;
    server.rows.set(u, row);
    return { ok: true, consent: { granted: row.granted, decisionSeq: row.seq, disclosureVersion: 1 } };
  },
  forgetAnalyticsIdentity: async () => ({ deleted: 0, status: 'suppressed' }),
}));

async function fresh() {
  vi.resetModules();
  const userScope = await import('../../services/userScope');
  const privacy = await import('../privacy_manager');
  return { userScope, privacy };
}

type UserScopeModule = Awaited<ReturnType<typeof fresh>>['userScope'];

const LEGACY_CONSENT_KEY = '@aforce/analytics-consent';
const LEGACY_ID_KEY = '@aforce/analytics-id';
const QUARANTINE_KEY = 'aforce.namespaceMigration.quarantined';
const OFFLINE = { status: 0, code: null };

/** The member-scoped form scopedStorage uses for an AsyncStorage base key. */
const scoped = (base: string, userId: string): string => `${base}:${userId}`;

/** A {granted, version, updatedAt} record, the shape the legacy key held. */
const consentRecord = (granted: boolean, updatedAt: string): string =>
  JSON.stringify({ granted, version: 1, updatedAt });

/** Every stored key that names this member, under either separator. */
const keysMentioning = (userId: string): string[] =>
  [...mem.keys()].filter((k) => k.includes(userId)).sort();

/**
 * Resolve the scope as `userId` (null = affirmative sign-out), point the
 * stand-in server at them, and settle the legacy migration. `offline` makes
 * every S1-3 call fail the way a transport failure does.
 */
async function signInAs(
  userScope: UserScopeModule,
  userId: string | null,
  network: 'online' | 'offline',
): Promise<void> {
  server.actingAs = userId;
  server.resolveFail = network === 'offline' ? { ...OFFLINE } : null;
  server.consentFail = network === 'offline' ? { ...OFFLINE } : null;
  userScope.__setUserScopeForTests(userId);
  await userScope.migrationSettled();
}

function goOnline(): void {
  server.resolveFail = null;
  server.consentFail = null;
}

beforeEach(() => {
  mem.clear();
  server.rows.clear();
  server.actingAs = null;
  server.resolveFail = null;
  server.consentFail = null;
});

describe('consent + analytics id never leak across accounts', () => {
  it('USER B inherits nothing; USER A gets their grant and pseudonym back', async () => {
    const { userScope, privacy } = await fresh();

    server.actingAs = 'user_A';
    userScope.__setUserScopeForTests('user_A');
    await userScope.migrationSettled();
    await privacy.grantConsent();
    const idA = await privacy.getAnalyticsId();
    expect(await privacy.isConsentGranted()).toBe(true);
    // Server-issued, not locally minted.
    expect(idA).toBe('anon_srv_user_A');

    // account switch — the security boundary
    server.actingAs = null;
    userScope.__setUserScopeForTests(null);
    server.actingAs = 'user_B';
    userScope.__setUserScopeForTests('user_B');
    await userScope.migrationSettled();
    expect(await privacy.isConsentGranted()).toBe(false);
    expect(await privacy.getAnalyticsId()).toBeNull();
    // And reconciling as B must not hand B anything of A's.
    await privacy.syncAnalyticsAuthority();
    expect(await privacy.isConsentGranted()).toBe(false);
    expect(await privacy.getAnalyticsId()).toBe('anon_srv_user_B');

    // A returns: same grant, same pseudonym — both restated by the SERVER.
    server.actingAs = 'user_A';
    userScope.__setUserScopeForTests('user_A');
    await userScope.migrationSettled();
    await privacy.syncAnalyticsAuthority();
    expect(await privacy.isConsentGranted()).toBe(true);
    expect(await privacy.getAnalyticsId()).toBe(idA);
  });

  it('the module cache cannot serve USER A grant to USER B (invalidation lock)', async () => {
    const { userScope, privacy } = await fresh();
    server.actingAs = 'user_A';
    userScope.__setUserScopeForTests('user_A');
    await userScope.migrationSettled();
    await privacy.grantConsent();
    expect(await privacy.isConsentGranted(), 'A really is granted before the switch').toBe(true);
    // cache is hot with A's grant; switch WITHOUT any async gap
    server.actingAs = 'user_B';
    userScope.__setUserScopeForTests('user_B');
    await userScope.migrationSettled();
    expect(await privacy.isConsentGranted()).toBe(false);
  });
});

describe('legacy migration quarantines the consent record (DR-016)', () => {
  it('the global consent record is RETAINED in place and NEVER copied to the claiming user', async () => {
    const { userScope } = await fresh();
    const legacyRecord = consentRecord(true, '2026-07-01T00:00:00Z');
    mem.set(LEGACY_CONSENT_KEY, legacyRecord);
    mem.set(LEGACY_ID_KEY, 'anon_legacy_abc');

    userScope.__setUserScopeForTests('user_A');
    await userScope.migrationSettled();

    // Retained byte for byte — "who consented, to version N, when" survives…
    expect(mem.get(LEGACY_CONSENT_KEY)).toBe(legacyRecord);
    expect(mem.get(LEGACY_ID_KEY)).toBe('anon_legacy_abc');
    // …but it is nobody's: nothing is written under A for either key.
    expect(mem.has(scoped(LEGACY_CONSENT_KEY, 'user_A'))).toBe(false);
    expect(mem.has(scoped(LEGACY_ID_KEY, 'user_A'))).toBe(false);
    // The device is marked, and the marker names no member.
    expect(mem.get(QUARANTINE_KEY)).toBe('1');
    // And that marker is the ONLY thing migration wrote.
    expect([...mem.keys()].sort()).toEqual([LEGACY_CONSENT_KEY, LEGACY_ID_KEY, QUARANTINE_KEY].sort());
  });
});

/**
 * The privacy-review evidence DR-016 requires before merge. One case per item
 * the founder named — account switching, existing scoped records,
 * legacy-record retention, offline prompting — plus the rule itself (the
 * legacy record is not the member's consent). Every expectation here would
 * fail if migration copied the record, if the legacy record were read as the
 * member's consent or answer, or if a member's own record were lost.
 */
describe('DR-016 — legacy consent quarantine evidence', () => {
  it('(a) legacy-record retention — the global record outlives A and a later B, claimed by neither', async () => {
    const { userScope, privacy } = await fresh();
    const legacyRecord = consentRecord(true, '2026-07-01T00:00:00Z');
    mem.set(LEGACY_CONSENT_KEY, legacyRecord);
    mem.set(LEGACY_ID_KEY, 'anon_legacy_abc');

    await signInAs(userScope, 'user_A', 'online');
    await privacy.syncAnalyticsAuthority();
    expect(mem.get(LEGACY_CONSENT_KEY)).toBe(legacyRecord);
    expect(mem.get(LEGACY_ID_KEY)).toBe('anon_legacy_abc');
    expect(mem.has(scoped(LEGACY_CONSENT_KEY, 'user_A'))).toBe(false);
    expect(mem.has(scoped(LEGACY_ID_KEY, 'user_A'))).toBe(false);
    expect(mem.get(QUARANTINE_KEY)).toBe('1');
    // A's pseudonym is the SERVER's, not the legacy local mint.
    expect(await privacy.getAnalyticsId()).toBe('anon_srv_user_A');

    await signInAs(userScope, null, 'online');
    await signInAs(userScope, 'user_B', 'online');
    await privacy.syncAnalyticsAuthority();
    expect(mem.get(LEGACY_CONSENT_KEY), 'still byte-identical after a second member').toBe(legacyRecord);
    expect(mem.get(LEGACY_ID_KEY)).toBe('anon_legacy_abc');
    expect(mem.has(scoped(LEGACY_CONSENT_KEY, 'user_A'))).toBe(false);
    expect(mem.has(scoped(LEGACY_CONSENT_KEY, 'user_B'))).toBe(false);
    expect(mem.has(scoped(LEGACY_ID_KEY, 'user_A'))).toBe(false);
    expect(mem.has(scoped(LEGACY_ID_KEY, 'user_B'))).toBe(false);
    expect(mem.get(QUARANTINE_KEY)).toBe('1');
    expect(await privacy.getAnalyticsId()).toBe('anon_srv_user_B');
  });

  it('(b) not treated as the member’s consent — a GRANTED legacy record opens nothing for A, offline or online', async () => {
    const { userScope, privacy } = await fresh();
    mem.set(LEGACY_CONSENT_KEY, consentRecord(true, '2026-07-01T00:00:00Z'));

    // A signs in with the server unreachable: the legacy grant is the only
    // consent-shaped record on the device.
    await signInAs(userScope, 'user_A', 'offline');
    await privacy.syncAnalyticsAuthority();
    expect(await privacy.isConsentGranted(), 'the legacy grant is not A’s grant').toBe(false);
    expect(await privacy.getAnalyticsId(), 'and there is no server id to collect under').toBeNull();
    expect(mem.has(scoped(LEGACY_CONSENT_KEY, 'user_A')), 'no copy was made for A to read').toBe(false);

    // The server comes back with A's row UNDECIDED. Still nothing.
    goOnline();
    await privacy.syncAnalyticsAuthority();
    expect(server.rows.get('user_A')).toMatchObject({ granted: false, seq: null });
    expect(await privacy.isConsentGranted(), 'an undecided row is not a grant either').toBe(false);
    // Non-vacuity: the server DID answer — A has a pseudonym now — so the
    // `false` above is the undecided row, not an unreachable server.
    expect(await privacy.getAnalyticsId()).toBe('anon_srv_user_A');
    expect(mem.get(LEGACY_CONSENT_KEY)).toBe(consentRecord(true, '2026-07-01T00:00:00Z'));
  });

  it('(c) offline prompting — with ONLY the legacy record, A is asked: the legacy answer is not attributed to A', async () => {
    const { userScope, privacy } = await fresh();
    mem.set(LEGACY_CONSENT_KEY, consentRecord(true, '2026-07-01T00:00:00Z'));

    await signInAs(userScope, 'user_A', 'offline');
    await privacy.syncAnalyticsAuthority();
    // The server has not answered, so this IS the local fallback path.
    expect((await privacy.getConsentUiState()).status).toBe('unsynced');
    expect(
      await privacy.hasAnsweredConsent(),
      'a legacy answer under the bare key is nobody’s answer — A will be asked',
    ).toBe(false);
    expect(mem.get(QUARANTINE_KEY)).toBe('1');
  });

  it('(c) offline prompting — A’s OWN scoped record suppresses the re-prompt offline', async () => {
    const { userScope, privacy } = await fresh();
    // A decided on a previous build, under A's own namespace; no legacy record.
    const ownRecord = consentRecord(false, '2026-08-20T10:00:00Z');
    mem.set(scoped(LEGACY_CONSENT_KEY, 'user_A'), ownRecord);

    await signInAs(userScope, 'user_A', 'offline');
    await privacy.syncAnalyticsAuthority();
    expect((await privacy.getConsentUiState()).status).toBe('unsynced');
    expect(await privacy.hasAnsweredConsent(), 'A’s own record answers — no re-prompt').toBe(true);
    // "answered" is not "granted": A said no, and nothing is collected.
    expect(await privacy.isConsentGranted()).toBe(false);
    expect(mem.get(scoped(LEGACY_CONSENT_KEY, 'user_A'))).toBe(ownRecord);
    // A member-scoped record is not legacy data: nothing to quarantine.
    expect(mem.has(QUARANTINE_KEY)).toBe(false);
  });

  it('(c) offline prompting — online, the server’s decision wins over every local record', async () => {
    const { userScope, privacy } = await fresh();
    // Both local records say NO; the member then decides YES with the server.
    const legacyNo = consentRecord(false, '2026-07-01T00:00:00Z');
    const ownNo = consentRecord(false, '2026-08-20T10:00:00Z');
    mem.set(LEGACY_CONSENT_KEY, legacyNo);
    mem.set(scoped(LEGACY_CONSENT_KEY, 'user_A'), ownNo);

    await signInAs(userScope, 'user_A', 'online');
    const outcome = await privacy.grantConsent();
    expect(outcome.outcome).toBe('confirmed');
    await privacy.syncAnalyticsAuthority();
    expect(await privacy.getConsentUiState()).toEqual({ status: 'settled', granted: true, answered: true });
    expect(await privacy.hasAnsweredConsent(), 'the server’s answer, not a local file').toBe(true);
    expect(await privacy.isConsentGranted()).toBe(true);
    expect(server.rows.get('user_A')).toMatchObject({ granted: true, seq: 1 });
    // Neither local record was rewritten to agree.
    expect(mem.get(LEGACY_CONSENT_KEY)).toBe(legacyNo);
    expect(mem.get(scoped(LEGACY_CONSENT_KEY, 'user_A'))).toBe(ownNo);
  });

  it('(d) existing scoped records preserved — A’s own records survive migration byte for byte beside the untouched legacy record', async () => {
    const { userScope, privacy } = await fresh();
    const legacyRecord = consentRecord(true, '2026-07-01T00:00:00Z');
    // Deliberately DIFFERENT bytes from the legacy record, so an overwrite
    // in either direction is visible.
    const ownRecord = consentRecord(false, '2026-08-20T10:00:00Z');
    mem.set(LEGACY_CONSENT_KEY, legacyRecord);
    mem.set(LEGACY_ID_KEY, 'anon_legacy_abc');
    mem.set(scoped(LEGACY_CONSENT_KEY, 'user_A'), ownRecord);
    mem.set(scoped(LEGACY_ID_KEY, 'user_A'), 'anon_scoped_A');

    await signInAs(userScope, 'user_A', 'offline');
    expect(mem.get(scoped(LEGACY_CONSENT_KEY, 'user_A'))).toBe(ownRecord);
    expect(mem.get(scoped(LEGACY_ID_KEY, 'user_A'))).toBe('anon_scoped_A');
    expect(mem.get(LEGACY_CONSENT_KEY)).toBe(legacyRecord);
    expect(mem.get(LEGACY_ID_KEY)).toBe('anon_legacy_abc');
    expect(mem.get(QUARANTINE_KEY)).toBe('1');
    expect([...mem.keys()].sort()).toEqual(
      [
        LEGACY_CONSENT_KEY,
        LEGACY_ID_KEY,
        scoped(LEGACY_CONSENT_KEY, 'user_A'),
        scoped(LEGACY_ID_KEY, 'user_A'),
        QUARANTINE_KEY,
      ].sort(),
    );

    // And it is A's own record — not the legacy one — that the prompt reads.
    await privacy.syncAnalyticsAuthority();
    expect(await privacy.hasAnsweredConsent()).toBe(true);
    expect(await privacy.isConsentGranted()).toBe(false);
  });

  it('(e) account switching — B inherits neither the legacy record nor A’s; A’s record is intact on return', async () => {
    const { userScope, privacy } = await fresh();
    const legacyRecord = consentRecord(true, '2026-07-01T00:00:00Z');
    const ownA = consentRecord(true, '2026-08-20T10:00:00Z');
    mem.set(LEGACY_CONSENT_KEY, legacyRecord);
    mem.set(scoped(LEGACY_CONSENT_KEY, 'user_A'), ownA);

    await signInAs(userScope, 'user_A', 'offline');
    await privacy.syncAnalyticsAuthority();
    expect(await privacy.hasAnsweredConsent(), 'A has answered, by A’s own record').toBe(true);

    // sign out, then B signs in with the server unreachable
    await signInAs(userScope, null, 'offline');
    await signInAs(userScope, 'user_B', 'offline');
    await privacy.syncAnalyticsAuthority();
    expect(await privacy.hasAnsweredConsent(), 'B will be asked — neither record is B’s').toBe(false);
    expect(await privacy.isConsentGranted()).toBe(false);
    expect(await privacy.getAnalyticsId()).toBeNull();
    expect(keysMentioning('user_B'), 'nothing is written for B').toEqual([]);
    expect(mem.get(LEGACY_CONSENT_KEY), 'legacy global untouched').toBe(legacyRecord);
    expect(mem.get(scoped(LEGACY_CONSENT_KEY, 'user_A')), 'A’s record untouched by B').toBe(ownA);

    // A returns
    await signInAs(userScope, null, 'offline');
    await signInAs(userScope, 'user_A', 'offline');
    await privacy.syncAnalyticsAuthority();
    expect(mem.get(scoped(LEGACY_CONSENT_KEY, 'user_A'))).toBe(ownA);
    expect(await privacy.hasAnsweredConsent(), 'A’s own answer is still A’s').toBe(true);
    expect(mem.get(LEGACY_CONSENT_KEY)).toBe(legacyRecord);
    // Across the whole A → out → B → out → A sequence, the device gained
    // exactly one key: the quarantine marker.
    expect([...mem.keys()].sort()).toEqual(
      [LEGACY_CONSENT_KEY, scoped(LEGACY_CONSENT_KEY, 'user_A'), QUARANTINE_KEY].sort(),
    );
  });
});

describe('STOP portion: pre-auth activation capture stays global (documented)', () => {
  it('activation-pending/emitted are NOT in the migration manifest', async () => {
    const { userScope } = await fresh();
    expect(userScope.MIGRATED_GLOBAL_KEYS).not.toContain('@aforce/activation-pending');
    expect(userScope.MIGRATED_GLOBAL_KEYS).not.toContain('@aforce/activation-emitted');
    // and the newly scoped analytics keys ARE
    for (const k of [
      '@aforce/analytics-consent',
      '@aforce/analytics-id',
      '@aforce/analytics-outbox',
      '@aforce/first-command-at',
      'aforce.notificationSettings',
    ]) {
      expect(userScope.MIGRATED_GLOBAL_KEYS).toContain(k);
    }
  });
});
