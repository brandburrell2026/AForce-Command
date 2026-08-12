/**
 * Wave-3 PR1 — environment resolution locks for the ONE canonical API
 * base resolver. Split-brain regression background: lib/api.ts skipped
 * EXPO_PUBLIC_API_BASE and carried the entire commerce path to a dead
 * domain while everything else talked to Railway.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const platformState = { OS: 'ios' as string };
vi.mock('react-native', () => ({ Platform: platformState }));

const ENV_KEYS = ['EXPO_PUBLIC_API_BASE', 'EXPO_PUBLIC_DOMAIN'] as const;
let prev: Record<string, string | undefined> = {};

beforeEach(() => {
  prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  platformState.OS = 'ios';
  vi.resetModules();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
});

async function resolve(): Promise<{ base: string; origin: string }> {
  const mod = await import('../apiBase');
  return { base: mod.resolveApiBase(), origin: mod.API_BASE.replace(/\/api$/, '') };
}

describe('canonical API base resolution', () => {
  it('EXPO_PUBLIC_API_BASE wins outright (full URL incl. /api), trailing slash stripped', async () => {
    process.env['EXPO_PUBLIC_API_BASE'] = 'https://aforce-command-production.up.railway.app/api/';
    process.env['EXPO_PUBLIC_DOMAIN'] = 'api.drinkaforce.com';
    const { base } = await resolve();
    expect(base).toBe('https://aforce-command-production.up.railway.app/api');
  });

  it('EXPO_PUBLIC_DOMAIN (host-only) → https://host/api', async () => {
    process.env['EXPO_PUBLIC_DOMAIN'] = 'my-repl.replit.dev';
    const { base } = await resolve();
    expect(base).toBe('https://my-repl.replit.dev/api');
  });

  it('a scheme-bearing DOMAIN is stripped — never https://https://', async () => {
    process.env['EXPO_PUBLIC_DOMAIN'] = 'https://my-repl.replit.dev/';
    const { base } = await resolve();
    expect(base).toBe('https://my-repl.replit.dev/api');
  });

  it('TestFlight/production intent: API_BASE alone fully determines the base', async () => {
    process.env['EXPO_PUBLIC_API_BASE'] = 'https://aforce-command-production.up.railway.app/api';
    const { base } = await resolve();
    expect(base).toBe('https://aforce-command-production.up.railway.app/api');
    expect(base).not.toContain('drinkaforce');
  });

  it('native with NOTHING configured fails loudly AT IMPORT (never a silent localhost)', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    try {
      await expect(import('../apiBase')).rejects.toThrow(/No API base configured/);
    } finally {
      delete (globalThis as { __DEV__?: boolean }).__DEV__;
    }
  });

  it('host is transport, not identity: resolver output never feeds key derivation', async () => {
    // The user-scope key derivation must not import the API base at all.
    const { readFileSync } = await import('node:fs');
    const { resolve: presolve } = await import('node:path');
    const userScopeSrc = readFileSync(presolve(__dirname, '../../services/userScope.ts'), 'utf8');
    expect(userScopeSrc).not.toMatch(/apiBase|API_BASE|EXPO_PUBLIC_DOMAIN|EXPO_PUBLIC_API_BASE/);
    const deviceIdSrc = readFileSync(presolve(__dirname, '../api.ts'), 'utf8');
    expect(deviceIdSrc).not.toMatch(/DEVICE_ID_KEY.*API_BASE|API_BASE.*DEVICE_ID_KEY/);
  });

  it('the dead production domain is gone from the EAS production profile', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve: presolve } = await import('node:path');
    const eas = JSON.parse(readFileSync(presolve(__dirname, '../../eas.json'), 'utf8'));
    expect(eas.build.production.env.EXPO_PUBLIC_DOMAIN).toBeUndefined();
    expect(eas.build.production.env.EXPO_PUBLIC_API_BASE).toMatch(/^https:\/\/.+\/api$/);
    expect(JSON.stringify(eas)).not.toContain('api.drinkaforce.com');
  });
});
