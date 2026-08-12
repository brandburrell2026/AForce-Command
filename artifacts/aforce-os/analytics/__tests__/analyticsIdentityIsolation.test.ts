/**
 * Wave-3 PR12 — analytics identity + consent isolation (approved W2-N4
 * subset), driven through the REAL privacy manager over in-memory
 * storage:
 *
 *   USER A grants consent (id minted) → sign-out → USER B signs in
 *     → B has NO consent, NO id (never inherits A's grant or pseudonym)
 *   USER A returns → A's consent + id are intact.
 *
 * Consent-evidence preservation: the pre-migration GLOBAL consent
 * record is COPIED, never deleted (RETAIN_GLOBAL_COPY) — "who
 * consented, to version N, when" stays answerable.
 *
 * STOP portion honored (documented, not scoped): the pre-auth
 * activation capture keys stay global by design.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));

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

async function fresh() {
  vi.resetModules();
  const userScope = await import('../../services/userScope');
  const privacy = await import('../privacy_manager');
  return { userScope, privacy };
}

beforeEach(() => {
  mem.clear();
});

describe('consent + analytics id never leak across accounts', () => {
  it('USER B inherits nothing; USER A gets their grant and pseudonym back', async () => {
    const { userScope, privacy } = await fresh();

    userScope.setUserScope('user_A');
    await userScope.migrationSettled();
    await privacy.grantConsent();
    const idA = await privacy.getAnalyticsId();
    expect(await privacy.isConsentGranted()).toBe(true);
    expect(idA).toMatch(/^anon_/);

    // account switch — the security boundary
    userScope.setUserScope(null);
    userScope.setUserScope('user_B');
    await userScope.migrationSettled();
    expect(await privacy.isConsentGranted()).toBe(false);
    expect(await privacy.getAnalyticsId()).toBeNull();

    // A returns: same grant, same pseudonym (per-user id, not reset-on-switch)
    userScope.setUserScope('user_A');
    await userScope.migrationSettled();
    expect(await privacy.isConsentGranted()).toBe(true);
    expect(await privacy.getAnalyticsId()).toBe(idA);
  });

  it('the module cache cannot serve USER A grant to USER B (invalidation lock)', async () => {
    const { userScope, privacy } = await fresh();
    userScope.setUserScope('user_A');
    await userScope.migrationSettled();
    await privacy.grantConsent();
    // cache is hot with A's grant; switch WITHOUT any async gap
    userScope.setUserScope('user_B');
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

    userScope.setUserScope('user_A');
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
