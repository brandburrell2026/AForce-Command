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
 * Consent-evidence preservation: the pre-migration GLOBAL consent
 * record is COPIED, never deleted (RETAIN_GLOBAL_COPY) — "who
 * consented, to version N, when" stays answerable.
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

beforeEach(() => {
  mem.clear();
  server.rows.clear();
  server.actingAs = null;
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

describe('legacy migration preserves consent evidence', () => {
  it('the global consent record is COPIED to the claiming user and RETAINED globally', async () => {
    const { userScope } = await fresh();
    const legacyRecord = JSON.stringify({ granted: true, version: 1, updatedAt: '2026-07-01T00:00:00Z' });
    mem.set('@aforce/analytics-consent', legacyRecord);
    mem.set('@aforce/analytics-id', 'anon_legacy_abc');

    userScope.__setUserScopeForTests('user_A');
    await userScope.migrationSettled();

    // scoped copies exist
    expect(mem.get('@aforce/analytics-consent:user_A')).toBe(legacyRecord);
    expect(mem.get('@aforce/analytics-id:user_A')).toBe('anon_legacy_abc');
    // the consent EVIDENCE survives globally; the id does not need to
    expect(mem.get('@aforce/analytics-consent')).toBe(legacyRecord);
    expect(mem.has('@aforce/analytics-id')).toBe(false);
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
