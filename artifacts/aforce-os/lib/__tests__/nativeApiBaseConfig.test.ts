/**
 * Every native release profile must ship an absolute HTTPS API base.
 *
 * Builds 59, 60 and 61 all shipped to TestFlight from the `internal` profile,
 * which set only EXPO_PUBLIC_INTERNAL_TESTFLIGHT. With no API base,
 * `resolveApiBase()` falls through every branch and — on a production native
 * build — logs and returns the RELATIVE string `/api`. A relative URL has no
 * origin on iOS, so `fetch` fails at the network layer before the request is
 * dispatched, and the client reports "That didn't reach the server."
 *
 * The symptom was three unrelated features failing identically (Home →
 * Log Water, Hydration → Log Water, Scan → save). The cause was one missing
 * line of configuration. Nothing in the unit lane could see it: the defect
 * lived in eas.json, and the app's own code was correct.
 *
 * apiBase.ts's header already records this happening ONCE BEFORE. That is why
 * this guard is a test rather than a comment — a config file with no test is
 * a config file that regresses.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');
const eas = JSON.parse(readFileSync(resolve(PKG, 'eas.json'), 'utf8')) as {
  build: Record<string, { distribution?: string; channel?: string; env?: Record<string, string> }>;
};
const apiBaseSrc = readFileSync(resolve(PKG, 'lib/apiBase.ts'), 'utf8');

/**
 * Profiles that produce a NATIVE binary a human installs. `development` is
 * excluded: it runs against a dev server and `resolveApiBase` deliberately
 * THROWS there rather than falling back, so the mistake is loud at first use.
 */
const NATIVE_RELEASE_PROFILES = ['internal', 'preview', 'production'] as const;

describe('native release profiles resolve a real server', () => {
  it.each(NATIVE_RELEASE_PROFILES)('%s declares an absolute HTTPS API base', (name) => {
    const base = eas.build[name]?.env?.['EXPO_PUBLIC_API_BASE'];
    expect(
      base,
      `eas.json build.${name}.env.EXPO_PUBLIC_API_BASE is missing — a native build ` +
        'without it silently falls back to the relative "/api" and cannot reach the server.',
    ).toBeDefined();
    expect(base, `${name}'s API base must be absolute HTTPS`).toMatch(/^https:\/\//);
    expect(base, `${name}'s API base must include the /api prefix`).toMatch(/\/api$/);
  });

  it('every native release profile points at the SAME host — no drift, no invented host', () => {
    const hosts = NATIVE_RELEASE_PROFILES.map((n) => {
      const b = eas.build[n]?.env?.['EXPO_PUBLIC_API_BASE'] ?? '';
      return /^https:\/\/([^/]+)/.exec(b)?.[1] ?? `<${n}: unset>`;
    });
    expect(new Set(hosts).size, `profiles disagree on the API host: ${hosts.join(', ')}`).toBe(1);
  });

  it('no native profile relies on the relative fallback', () => {
    for (const name of NATIVE_RELEASE_PROFILES) {
      expect(eas.build[name]?.env?.['EXPO_PUBLIC_API_BASE']).not.toBe('/api');
    }
  });

  it('the internal profile keeps its internal-TestFlight behaviour', () => {
    // The fix must not have been achieved by flattening `internal` into
    // `production` — the overlay flags and the offline outbox depend on it.
    expect(eas.build['internal']?.env?.['EXPO_PUBLIC_INTERNAL_TESTFLIGHT']).toBe('true');
  });
});

describe('the resolver these profiles depend on', () => {
  it('still prefers EXPO_PUBLIC_API_BASE above every other source', () => {
    const first = apiBaseSrc.indexOf("process.env['EXPO_PUBLIC_API_BASE']");
    const domain = apiBaseSrc.indexOf("process.env['EXPO_PUBLIC_DOMAIN']");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(domain);
  });

  it('still fails LOUDLY rather than fabricating a host', () => {
    // The relative-"/api" return is the honest last resort, not a fix. It must
    // stay paired with an error log so a misconfigured build is diagnosable.
    expect(apiBaseSrc).toContain('No API base configured');
    expect(apiBaseSrc).not.toMatch(/return\s+['"]https:\/\/[^'"]+['"]/);
  });
});
