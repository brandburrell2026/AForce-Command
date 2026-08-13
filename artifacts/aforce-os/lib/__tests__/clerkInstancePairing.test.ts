/**
 * THE INVARIANT: the client's Clerk instance must equal the server's Clerk instance.
 *
 * A Clerk session token is signed by the instance that minted it and can only be
 * verified by that same instance's keys. `clerkMiddleware()` in the api-server
 * (`src/app.ts`) verifies against whatever instance `CLERK_SECRET_KEY` belongs to.
 * If the client mints tokens somewhere else, every authenticated request fails —
 * and if the client's instance has no DNS, the app cannot even start, because
 * `app/index.tsx` waits on Clerk's `isLoaded` and renders a black canvas while it
 * waits.
 *
 * WHAT THIS FILE USED TO ASSERT, AND WHY THAT WAS WRONG.
 * It previously required `pk_live_` on any profile pointing at a production API
 * host. That is an assumption, not a rule — it conflates "which deployment" with
 * "which Clerk instance". Acting on it produced the Build 63/64 launch failure:
 * the client was moved onto a `pk_live_` key for a DIFFERENT Clerk application
 * (`clerk.travelgate.app`) that the server was never paired with and whose
 * hostname does not resolve. The pairing that assumption "fixed" had been correct
 * already. Only the equality below is a real rule; it is the one encoded here.
 *
 * KEEPING THE DECLARED SERVER INSTANCE HONEST.
 * CI cannot read Railway's environment, so the server side is declared here and
 * proven separately by `scripts/verify-clerk-pairing.mjs`, which asks Clerk which
 * instance the deployed secret actually belongs to without ever printing it.
 * Re-run that script and update this constant whenever the server's Clerk
 * configuration changes. A declared value that nobody re-checks is how the last
 * misdiagnosis happened.
 *
 * CURRENT STATE — see governance/CLERK-PAIRING-STATE.md.
 * Client and server are both on the moving-ox-89 DEVELOPMENT instance. That is a
 * deliberate, temporary QA configuration: acceptable for internal TestFlight,
 * BLOCKED for public beta. Migration is planned in
 * governance/PRODUCTION-CLERK-MIGRATION-PLAN.md.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lookup } from 'node:dns';

/**
 * The Clerk instance the deployed api-server validates tokens against.
 * Verified against Railway production on 2026-08-13 via
 * `node scripts/verify-clerk-pairing.mjs` (run through `railway run`).
 */
const SERVER_CLERK_INSTANCE = 'moving-ox-89.clerk.accounts.dev';

/** Profiles that produce a native binary someone signs into. */
const NATIVE_RELEASE_PROFILES = ['internal', 'preview', 'production'] as const;

const PKG = resolve(__dirname, '..', '..');
const easRaw = readFileSync(resolve(PKG, 'eas.json'), 'utf8');
const eas = JSON.parse(easRaw) as { build: Record<string, { env?: Record<string, string> }> };

/** Clerk encodes the instance host in the publishable key's base64 payload. */
function instanceHost(key: string): string | null {
  const payload = key.replace(/^pk_(test|live)_/, '');
  try {
    const decoded = Buffer.from(
      payload + '='.repeat((4 - (payload.length % 4)) % 4),
      'base64',
    ).toString('utf8');
    const host = decoded.replace(/\$$/, '').trim();
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
      done({ ok: false, missing: code === 'ENOTFOUND' || code === 'NXDOMAIN', code });
    });
  });
}

const profiles = NATIVE_RELEASE_PROFILES.map((name) => ({
  name,
  key: eas.build[name]?.env?.['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'],
}));

describe('client Clerk instance == server Clerk instance', () => {
  it.each(profiles)('$name declares a Clerk publishable key in eas.json', ({ name, key }) => {
    expect(
      key,
      `eas.json build.${name} does not declare EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. A publishable ` +
        'key is not a secret; declaring it here keeps the pairing visible and testable rather ' +
        'than depending on whatever the EAS dashboard happens to hold at build time.',
    ).toBeDefined();
  });

  it.each(profiles)('$name is paired with the server instance', ({ name, key }) => {
    const host = key ? instanceHost(key) : null;
    expect(
      host,
      `eas.json build.${name} carries a publishable key that does not decode to a hostname.`,
    ).not.toBeNull();
    expect(
      host,
      `eas.json build.${name} points the client at Clerk instance "${host}", but the deployed ` +
        `api-server validates tokens against "${SERVER_CLERK_INSTANCE}". Tokens minted by one ` +
        'Clerk instance cannot be verified by another, so every authenticated request would ' +
        'fail. Change the client key, or update SERVER_CLERK_INSTANCE after re-verifying the ' +
        'server with scripts/verify-clerk-pairing.mjs — do not guess which one is right.',
    ).toBe(SERVER_CLERK_INSTANCE);
  });

  it('every native release profile agrees on one instance', () => {
    const hosts = new Set(profiles.map((p) => (p.key ? instanceHost(p.key) : null)));
    expect(
      hosts.size,
      `Native release profiles disagree on the Clerk instance: ${[...hosts].join(', ')}. ` +
        'A build promoted between channels would silently change identity provider.',
    ).toBe(1);
  });

  it('the paired instance resolves in DNS', async () => {
    const res = await resolveHost(SERVER_CLERK_INSTANCE);
    if (res.ok) return;
    if (!res.missing) {
      // No resolver reachable — this run cannot prove anything either way, and a
      // guard that fails offline gets disabled within a week.
      console.warn(
        `[clerk-pairing] skipped DNS check: no resolver for ${SERVER_CLERK_INSTANCE} (${res.code}).`,
      );
      return;
    }
    expect.fail(
      `Clerk instance "${SERVER_CLERK_INSTANCE}" does NOT resolve (NXDOMAIN). Clerk production ` +
        'instances require a customer-created CNAME. Until it exists, ClerkProvider can never ' +
        'initialise: the app does not crash, it waits for isLoaded and renders a black canvas ' +
        'forever (app/index.tsx). This is exactly the Build 63/64 launch failure.',
    );
  }, 15_000);

  it('no Clerk secret key is present in eas.json', () => {
    expect(
      /sk_(test|live)_/.test(easRaw),
      'eas.json contains something shaped like a Clerk SECRET key. Secret keys must never enter ' +
        'the repository, the client bundle, or build output — only the server holds one.',
    ).toBe(false);
  });
});
