import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = resolve(__dirname, '../..');
const eas = JSON.parse(readFileSync(resolve(app, 'eas.json'), 'utf8'));
const contract = JSON.parse(readFileSync(resolve(app, '../../docs/beta-candidate-2026-11-25.json'), 'utf8'));
function env(name: string): Record<string, string> {
  const p = eas.build[name];
  return { ...(p.extends ? env(p.extends) : {}), ...p.env };
}
function frontend(key: string) {
  return Buffer.from(key.split('_').slice(2).join('_'), 'base64').toString().replace(/\$$/, '');
}

describe('staging beta identity and transport pairing', () => {
  it.each(['beta-staging', 'beta-staging-apk', 'beta-staging-simulator'])('%s uses the identity provider paired with staging', (name) => {
    const e = env(name);
    expect(e.EXPO_PUBLIC_API_BASE).toBe(contract.backend);
    expect(frontend(e.EXPO_PUBLIC_BETA_CLERK_PUBLISHABLE_KEY)).toBe(contract.stagingAuthFrontend);
    expect(e.EXPO_PUBLIC_INTERNAL_TESTFLIGHT).toBe('true');
    expect(e.EXPO_PUBLIC_BETA_STAGING).toBe('1');
    expect(e.EXPO_PUBLIC_BETA_CLERK_PUBLISHABLE_KEY).toBe(e.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);
    expect(e.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY).not.toBe(env('production').EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);
  });

  it('leaves the normal app profiles on their existing server and identity provider', () => {
    for (const name of ['production', 'internal', 'internal-social']) {
      expect(env(name).EXPO_PUBLIC_BETA_STAGING).toBeUndefined();
      expect(env(name).EXPO_PUBLIC_API_BASE).toBe('https://aforce-command-production.up.railway.app/api');
      expect(frontend(env(name).EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY)).toBe('moving-ox-89.clerk.accounts.dev');
    }
  });
});
