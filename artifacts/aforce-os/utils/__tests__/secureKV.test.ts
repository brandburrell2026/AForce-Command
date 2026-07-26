import { describe, it, expect } from 'vitest';
import { createSecureKV, toSecureKey, type KVBackend } from '../secureKV';

function memBackend(failing = false): KVBackend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(k) {
      if (failing) throw new Error('backend down');
      return data.get(k) ?? null;
    },
    async setItem(k, v) {
      if (failing) throw new Error('backend down');
      data.set(k, v);
    },
    async removeItem(k) {
      if (failing) throw new Error('backend down');
      data.delete(k);
    },
  };
}

describe('toSecureKey', () => {
  it('keeps compliant keys and sanitizes the rest', () => {
    expect(toSecureKey('aforce.profileIdentity')).toBe('aforce.profileIdentity');
    expect(toSecureKey('a b/c')).toBe('a_b_c');
  });
});

describe('createSecureKV — K-1 migration contract', () => {
  it('reads from secure when present', async () => {
    const secure = memBackend();
    const plain = memBackend();
    secure.data.set('k', 'secure-value');
    plain.data.set('k', 'stale-plain');
    expect(await createSecureKV(secure, plain).getItem('k')).toBe('secure-value');
  });

  it('migrates a legacy plain value: secure write first, then plain delete', async () => {
    const secure = memBackend();
    const plain = memBackend();
    plain.data.set('k', 'legacy');
    const kv = createSecureKV(secure, plain);
    expect(await kv.getItem('k')).toBe('legacy');
    expect(secure.data.get('k')).toBe('legacy'); // migrated
    expect(plain.data.has('k')).toBe(false); // plain removed after success
  });

  it('keeps the plain copy when the secure write fails (no data loss)', async () => {
    const secure = memBackend(true); // secure backend down
    const plain = memBackend();
    plain.data.set('k', 'legacy');
    const kv = createSecureKV(secure, plain);
    expect(await kv.getItem('k')).toBe('legacy'); // still readable
    expect(plain.data.get('k')).toBe('legacy'); // NOT deleted
  });

  it('set writes secure and clears any stale plain copy', async () => {
    const secure = memBackend();
    const plain = memBackend();
    plain.data.set('k', 'old');
    await createSecureKV(secure, plain).setItem('k', 'new');
    expect(secure.data.get('k')).toBe('new');
    expect(plain.data.has('k')).toBe(false);
  });

  it('set degrades to plain when secure is unavailable (write never lost)', async () => {
    const secure = memBackend(true);
    const plain = memBackend();
    await createSecureKV(secure, plain).setItem('k', 'v');
    expect(plain.data.get('k')).toBe('v');
  });

  it('remove clears both stores', async () => {
    const secure = memBackend();
    const plain = memBackend();
    secure.data.set('k', 'a');
    plain.data.set('k', 'b');
    await createSecureKV(secure, plain).removeItem('k');
    expect(secure.data.size).toBe(0);
    expect(plain.data.size).toBe(0);
  });

  it('round-trips a ProfileIdentity-sized payload', async () => {
    const secure = memBackend();
    const plain = memBackend();
    const kv = createSecureKV(secure, plain);
    const payload = JSON.stringify({ bodyWeightLbs: 185, heightCm: 180, birthYear: 1990, extra: 'x'.repeat(500) });
    await kv.setItem('aforce.profileIdentity', payload);
    expect(await kv.getItem('aforce.profileIdentity')).toBe(payload);
  });
});
