/**
 * A production Clerk key must name an instance that actually exists.
 *
 * Builds 63 and 64 both opened to a permanent black screen. Neither crashed:
 * `app/index.tsx` waits for Clerk's `isLoaded` and renders a black canvas
 * while it waits, so an instance that can never answer produces a screen that
 * never changes. The cause was DNS — `clerk.travelgate.app` was NXDOMAIN,
 * because a Clerk production instance needs a customer-created CNAME and the
 * record had not been added yet.
 *
 * It survived a full device QA pass because a cached Clerk session renders and
 * functions WITHOUT reaching the instance, and the server validates tokens
 * through its own secret against api.clerk.com rather than the custom domain.
 * Build 63 therefore passed its write test, and only failed later when the
 * session needed refreshing. A guard that checks the key's SHAPE would not have
 * caught it; only reachability would.
 *
 * This is the third build-time configuration value to break the product
 * invisibly — after the missing API base and the dev/production Clerk mismatch.
 * The rule holds each time: configuration that can break the product must be
 * visible to CI.
 *
 * OFFLINE SAFETY. This is the one guard in the repo that touches the network,
 * so it distinguishes two failures that look alike:
 *   ENOTFOUND / NXDOMAIN → the name genuinely does not exist  → FAIL
 *   EAI_AGAIN, timeouts  → we cannot reach a resolver at all  → SKIP
 * A sandboxed or offline runner proves nothing either way, and a guard that
 * fails there would be turned off within a week.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lookup } from 'node:dns';

const PKG = resolve(__dirname, '..', '..');
const eas = JSON.parse(readFileSync(resolve(PKG, 'eas.json'), 'utf8')) as {
  build: Record<string, { env?: Record<string, string> }>;
};

const NATIVE_RELEASE_PROFILES = ['internal', 'preview', 'production'] as const;
const PRODUCTION_API_HOSTS = ['aforce-command-production.up.railway.app', 'api.drinkaforce.com'];

/** Clerk encodes the instance host in the publishable key's base64 payload. */
function instanceHost(key: string): string | null {
  const payload = key.replace(/^pk_(test|live)_/, '');
  try {
    const decoded = Buffer.from(
      payload + '='.repeat((4 - (payload.length % 4)) % 4),
      'base64',
    ).toString('utf8');
    const host = decoded.replace(/\$$/, '').trim();
    // A hostname, not a URL and not junk: labels separated by dots, no scheme,
    // no path, no spaces.
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)
      ? host
      : null;
  } catch {
    return null;
  }
}

type Resolution = { ok: true } | { ok: false; missing: boolean; code: string };

async function resolveHost(host: string): Promise<Resolution> {
  return new Promise((done) => {
    lookup(host, (err) => {
      if (!err) return done({ ok: true });
      const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
      // ENOTFOUND/NXDOMAIN is an authoritative "this name does not exist".
      // Everything else (EAI_AGAIN, ESERVFAIL, timeouts) means we could not ask.
      done({ ok: false, missing: code === 'ENOTFOUND' || code === 'NXDOMAIN', code });
    });
  });
}

/** The profiles that ship a pk_live key against a production API host. */
const productionPairings = NATIVE_RELEASE_PROFILES.flatMap((name) => {
  const env = eas.build[name]?.env ?? {};
  const base = env['EXPO_PUBLIC_API_BASE'] ?? '';
  const key = env['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'] ?? '';
  const apiHost = /^https:\/\/([^/]+)/.exec(base)?.[1] ?? '';
  return PRODUCTION_API_HOSTS.includes(apiHost) && key.startsWith('pk_live_')
    ? [{ name, key }]
    : [];
});

describe('production Clerk keys name an instance that exists', () => {
  it('there is at least one production pairing to check', () => {
    // If this ever drops to zero the assertions below would vacuously pass.
    expect(productionPairings.length).toBeGreaterThan(0);
  });

  it.each(productionPairings)('$name: the key decodes to a valid hostname', ({ name, key }) => {
    const host = instanceHost(key);
    expect(
      host,
      `eas.json build.${name} carries a pk_live key that does not decode to a hostname. ` +
        'A Clerk publishable key encodes its instance host; if this fails the key is malformed.',
    ).not.toBeNull();
  });

  it.each(productionPairings)('$name: that hostname resolves in DNS', async ({ name, key }) => {
    const host = instanceHost(key);
    if (host === null) return; // already failed above; do not double-report

    const res = await resolveHost(host);
    if (res.ok) return;

    if (!res.missing) {
      // No resolver reachable — this run cannot prove anything either way.
      console.warn(
        `[clerk-dns] skipped: could not reach a DNS resolver for ${host} (${res.code}).`,
      );
      return;
    }

    expect.fail(
      `eas.json build.${name} points at Clerk instance "${host}", which does NOT resolve ` +
        '(NXDOMAIN). A Clerk production instance requires a customer-created CNAME at that ' +
        'hostname. Until it exists, ClerkProvider can never initialise: the app does not crash, ' +
        'it waits for isLoaded and renders a black canvas forever (app/index.tsx). This is the ' +
        'Build-63/64 launch failure — a cached session hides it until the session needs ' +
        'refreshing, so device QA can pass and the app still be unlaunchable later.',
    );
  }, 15_000);
});
