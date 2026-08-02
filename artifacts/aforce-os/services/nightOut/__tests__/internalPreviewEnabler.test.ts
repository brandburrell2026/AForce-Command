import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isInternalEvidenceBuild,
  INTERNAL_BUNDLE_ID,
  PRODUCTION_BUNDLE_ID,
  INTERNAL_PROFILE,
  type InternalBuildInputs,
} from '@/internal-preview/internalGate';
import {
  enableEvidenceMode,
  disableEvidenceMode,
  evidenceAccessGranted,
} from '@/internal-preview/evidenceModeService';
import {
  syncInternalPreviewRoute,
  generatedRouteContent,
  assertNoGeneratedRoute,
  GENERATED_ROUTE_FILENAME,
} from '@/internal-preview/routeSync.mjs';
import { resolveBuildIdentity } from '@/internal-preview/buildConfig.mjs';
import { disableNightOutForInternalPreview, enableNightOutForInternalPreview } from '@/services/nightOut/access';
import { baseFlags } from '@/store/__tests__/_fixtures';
import type { FeatureFlags } from '@/types';

const OK: InternalBuildInputs = {
  buildProfile: INTERNAL_PROFILE,
  appVariant: 'internal',
  internalPreview: 'true',
  demoMode: true,
  applicationId: INTERNAL_BUNDLE_ID,
};

describe('internal-build gate — fails closed', () => {
  it('passes only for the full authorized internal build', () => {
    expect(isInternalEvidenceBuild(OK)).toBe(true);
    // runtime (buildProfile absent) still passes on native identity + markers
    expect(isInternalEvidenceBuild({ ...OK, buildProfile: null })).toBe(true);
  });

  it('env markers ALONE cannot enable it (no internal bundle identity)', () => {
    expect(isInternalEvidenceBuild({ ...OK, applicationId: null })).toBe(false);
    expect(isInternalEvidenceBuild({ ...OK, applicationId: PRODUCTION_BUNDLE_ID })).toBe(false);
  });

  it('the production bundle id fails closed regardless of every marker', () => {
    expect(isInternalEvidenceBuild({ ...OK, applicationId: PRODUCTION_BUNDLE_ID })).toBe(false);
  });

  it('internal identity but a non-internal build profile fails closed', () => {
    expect(isInternalEvidenceBuild({ ...OK, buildProfile: 'production' })).toBe(false);
  });

  it('missing markers fail closed', () => {
    expect(isInternalEvidenceBuild({ ...OK, appVariant: 'production' })).toBe(false);
    expect(isInternalEvidenceBuild({ ...OK, internalPreview: 'false' })).toBe(false);
    expect(isInternalEvidenceBuild({ ...OK, demoMode: false })).toBe(false);
  });
});

describe('evidence-mode service — sanctioned APIs only, gated', () => {
  it('enable calls the sanctioned enabler through setFeatureFlags only when eligible', () => {
    const setFeatureFlags = vi.fn();
    expect(enableEvidenceMode({ flags: baseFlags, setFeatureFlags, build: OK })).toBe(true);
    expect(setFeatureFlags).toHaveBeenCalledWith(enableNightOutForInternalPreview(baseFlags));
  });

  it('enable is a no-op (fail closed) outside the authorized internal build', () => {
    const setFeatureFlags = vi.fn();
    expect(enableEvidenceMode({ flags: baseFlags, setFeatureFlags, build: { ...OK, applicationId: PRODUCTION_BUNDLE_ID } })).toBe(false);
    expect(setFeatureFlags).not.toHaveBeenCalled();
  });

  it('disable uses the sanctioned disabler and PRESERVES every unrelated flag', () => {
    const setFeatureFlags = vi.fn();
    const enabled = enableNightOutForInternalPreview(baseFlags);
    expect(disableEvidenceMode({ flags: enabled, setFeatureFlags, build: OK })).toBe(true);
    const applied = setFeatureFlags.mock.calls[0][0] as FeatureFlags;
    expect(applied.night_out_enabled).toBe(false);
    // every OTHER key identical to the enabled input
    for (const k of Object.keys(enabled) as (keyof FeatureFlags)[]) {
      if (k === 'night_out_enabled') continue;
      expect(applied[k], k).toBe(enabled[k]);
    }
  });

  it('sanctioned disable modifies only night_out_enabled', () => {
    const out = disableNightOutForInternalPreview({ ...baseFlags, night_out_enabled: true } as FeatureFlags);
    expect(out.night_out_enabled).toBe(false);
    for (const k of Object.keys(baseFlags) as (keyof FeatureFlags)[]) {
      if (k === 'night_out_enabled') continue;
      expect(out[k], k).toBe(baseFlags[k]);
    }
  });

  it('access is granted only with the flag AND demo context', () => {
    const enabled = enableNightOutForInternalPreview(baseFlags);
    expect(evidenceAccessGranted(enabled, true)).toBe(true);
    expect(evidenceAccessGranted(enabled, false)).toBe(false); // no demo context
    expect(evidenceAccessGranted(baseFlags, true)).toBe(false); // flag off
  });
});

describe('route synchronization — deterministic, idempotent, fails closed', () => {
  const appDir = () => mkdtempSync(join(tmpdir(), 'no-c-app-'));

  it('internal build CREATES the generated route with the generated header', () => {
    const dir = appDir();
    const r = syncInternalPreviewRoute({ variant: 'internal', appDir: dir });
    expect(r.action).toBe('created');
    const content = readFileSync(join(dir, GENERATED_ROUTE_FILENAME), 'utf8');
    expect(content).toBe(generatedRouteContent());
    expect(content).toMatch(/@generated AFORCE-INTERNAL-PREVIEW-ROUTE/);
  });

  it('repeated internal synchronization is idempotent', () => {
    const dir = appDir();
    syncInternalPreviewRoute({ variant: 'internal', appDir: dir });
    const r2 = syncInternalPreviewRoute({ variant: 'internal', appDir: dir });
    expect(r2.action).toBe('refreshed');
    expect(readFileSync(join(dir, GENERATED_ROUTE_FILENAME), 'utf8')).toBe(generatedRouteContent());
  });

  it('production synchronization DELETES a stale internal route', () => {
    const dir = appDir();
    writeFileSync(join(dir, GENERATED_ROUTE_FILENAME), 'stale', 'utf8');
    const r = syncInternalPreviewRoute({ variant: 'production', appDir: dir });
    expect(r.action).toBe('deleted');
    expect(existsSync(join(dir, GENERATED_ROUTE_FILENAME))).toBe(false);
  });

  it('internal → production cannot carry the route forward', () => {
    const dir = appDir();
    syncInternalPreviewRoute({ variant: 'internal', appDir: dir });
    syncInternalPreviewRoute({ variant: 'production', appDir: dir });
    expect(existsSync(join(dir, GENERATED_ROUTE_FILENAME))).toBe(false);
    expect(() => assertNoGeneratedRoute({ appDir: dir })).not.toThrow();
  });

  it('assertNoGeneratedRoute fails closed when a route is present', () => {
    const dir = appDir();
    writeFileSync(join(dir, GENERATED_ROUTE_FILENAME), 'x', 'utf8');
    expect(() => assertNoGeneratedRoute({ appDir: dir })).toThrow(/must not exist/);
  });
});

describe('build-config resolver — deterministic identity, contradictions throw', () => {
  it('internal profile yields the internal identity', () => {
    const id = resolveBuildIdentity({ EAS_BUILD_PROFILE: INTERNAL_PROFILE, EXPO_PUBLIC_APP_VARIANT: 'internal', EXPO_PUBLIC_DEMO_MODE: 'true' });
    expect(id).toMatchObject({ variant: 'internal', bundleId: INTERNAL_BUNDLE_ID, name: 'AForce OS Internal', scheme: 'aforce-os-internal' });
  });

  it('no selector defaults to the SAFE production identity', () => {
    expect(resolveBuildIdentity({})).toMatchObject({ variant: 'production', bundleId: PRODUCTION_BUNDLE_ID });
  });

  it('contradictory config throws at build time', () => {
    expect(() => resolveBuildIdentity({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_INTERNAL_PREVIEW: 'true' })).toThrow();
    expect(() => resolveBuildIdentity({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_APP_VARIANT: 'internal' })).toThrow();
    expect(() => resolveBuildIdentity({ EAS_BUILD_PROFILE: INTERNAL_PROFILE, EXPO_PUBLIC_DEMO_MODE: 'false' })).toThrow();
    expect(() => resolveBuildIdentity({ EAS_BUILD_PROFILE: 'bogus-profile' })).toThrow(/unsupported/);
  });
});
