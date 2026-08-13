/**
 * A native release build must not pair a DEVELOPMENT Clerk client with a
 * PRODUCTION backend.
 *
 * Builds 59-62 shipped `pk_test_…`, which decodes to the development instance
 * `moving-ox-89.clerk.accounts.dev`, while the api-server validated tokens
 * against its own `CLERK_SECRET_KEY`. When those two belong to different Clerk
 * instances the server cannot verify the token it is handed, `requireAuth`
 * fails closed in production, and EVERY authenticated write returns 401 — while
 * unauthenticated reads keep working. On device that looked like "Home,
 * Hydration and Scan are all broken"; it was one credential pairing.
 *
 * Why this guard lives in the repo rather than in a runbook: the API-base
 * defect (Build 61) had exactly the same shape — a build-time value that no
 * test could see, wrong for three builds running. The lesson was not "check
 * eas.json more carefully", it was "configuration that can break the product
 * must be visible to CI".
 *
 * A Clerk PUBLISHABLE key is not a secret — it is designed to ship inside the
 * client binary — so it belongs in eas.json where it can be read and asserted.
 * The SECRET key stays in Railway and is never read here, by this test or by
 * anything else in this repository.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');
const eas = JSON.parse(readFileSync(resolve(PKG, 'eas.json'), 'utf8')) as {
  build: Record<string, { env?: Record<string, string> }>;
};

/** Profiles that produce a binary a human installs and signs into. */
const NATIVE_RELEASE_PROFILES = ['internal', 'preview', 'production'] as const;

/** Hosts that serve real member data. A dev Clerk client may never pair with these. */
const PRODUCTION_API_HOSTS = ['aforce-command-production.up.railway.app', 'api.drinkaforce.com'];

function apiHost(profile: string): string | null {
  const base = eas.build[profile]?.env?.['EXPO_PUBLIC_API_BASE'];
  return base ? (/^https:\/\/([^/]+)/.exec(base)?.[1] ?? null) : null;
}

function clerkKey(profile: string): string | undefined {
  return eas.build[profile]?.env?.['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'];
}

/** Clerk encodes the instance host in the publishable key's base64 payload. */
function clerkInstance(key: string): string {
  const payload = key.replace(/^pk_(test|live)_/, '');
  try {
    return Buffer.from(payload + '='.repeat((4 - (payload.length % 4)) % 4), 'base64')
      .toString('utf8')
      .replace(/\$$/, '');
  } catch {
    return '<undecodable>';
  }
}

describe('Clerk client/server instance pairing', () => {
  it.each(NATIVE_RELEASE_PROFILES)(
    '%s: a production API base requires a production Clerk key',
    (profile) => {
      const host = apiHost(profile);
      if (host === null || !PRODUCTION_API_HOSTS.includes(host)) return; // not a production pairing

      const key = clerkKey(profile);
      expect(
        key,
        `eas.json build.${profile} points at the production API (${host}) but declares no ` +
          'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. A publishable key is not a secret — declare it here ' +
          'so the pairing is visible to CI instead of living only in the EAS dashboard.',
      ).toBeDefined();

      expect(
        key!.startsWith('pk_live_'),
        `build.${profile} pairs a DEVELOPMENT Clerk client (${clerkInstance(key!)}) with the ` +
          `PRODUCTION API (${host}). The server cannot verify tokens minted by a different ` +
          'instance, so every authenticated write returns 401 while reads keep working. ' +
          'This is the Build-62 defect.',
      ).toBe(true);
    },
  );

  it('all native release profiles agree on ONE Clerk instance', () => {
    const instances = NATIVE_RELEASE_PROFILES.map((p) => {
      const k = clerkKey(p);
      return k ? clerkInstance(k) : null;
    }).filter((x): x is string => x !== null);
    if (instances.length < 2) return;
    expect(
      new Set(instances).size,
      `native profiles disagree on the Clerk instance: ${instances.join(', ')}`,
    ).toBe(1);
  });

  it('never reads, embeds or asserts the Clerk SECRET key', () => {
    // The secret lives in Railway. Nothing in the client repo may carry it —
    // and this guard must not become the reason someone pastes it in.
    const self = readFileSync(resolve(__dirname, 'clerkInstancePairing.test.ts'), 'utf8');
    expect(self).not.toMatch(/sk_(test|live)_[A-Za-z0-9]/);
    const easRaw = readFileSync(resolve(PKG, 'eas.json'), 'utf8');
    expect(easRaw, 'a Clerk SECRET key must never appear in eas.json').not.toMatch(
      /sk_(test|live)_[A-Za-z0-9]/,
    );
  });
});
