/**
 * Guard tests for the dev/demo-only P0 Screen Gallery.
 *
 * 1. `demo/galleryFixtures.ts` must throw when imported outside `__DEV__`
 *    and outside `EXPO_PUBLIC_DEMO_MODE` — the hard production guard at the
 *    top of that file.
 * 2. It must load cleanly under `__DEV__` and under demo mode.
 * 3. No production module (`screens/`, `hooks/`, `services/`, `store/`) may
 *    import anything from `demo/` — a static source scan, not a bundler
 *    trick, so it holds regardless of how the app is built.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const FIXTURES_MODULE = '../galleryFixtures';

const ORIGINAL_DEMO_ENV = process.env['EXPO_PUBLIC_DEMO_MODE'];

function restoreGlobals() {
  vi.unstubAllGlobals();
  if (ORIGINAL_DEMO_ENV === undefined) {
    delete process.env['EXPO_PUBLIC_DEMO_MODE'];
  } else {
    process.env['EXPO_PUBLIC_DEMO_MODE'] = ORIGINAL_DEMO_ENV;
  }
}

describe('demo/galleryFixtures — production guard', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    restoreGlobals();
  });

  it('throws on import when neither __DEV__ nor EXPO_PUBLIC_DEMO_MODE is set (simulated production)', async () => {
    vi.stubGlobal('__DEV__', false);
    delete process.env['EXPO_PUBLIC_DEMO_MODE'];

    await expect(import(FIXTURES_MODULE)).rejects.toThrow(/dev\/demo-only/i);
  });

  it('loads cleanly under __DEV__ = true', async () => {
    vi.stubGlobal('__DEV__', true);
    delete process.env['EXPO_PUBLIC_DEMO_MODE'];

    const mod = await import(FIXTURES_MODULE);
    expect(mod.GALLERY_FIXTURES).toBeDefined();
    expect(mod.GALLERY_FIXTURES.length).toBe(15);
  });

  it('loads cleanly under EXPO_PUBLIC_DEMO_MODE=true even when __DEV__ is false', async () => {
    vi.stubGlobal('__DEV__', false);
    process.env['EXPO_PUBLIC_DEMO_MODE'] = 'true';

    const mod = await import(FIXTURES_MODULE);
    expect(mod.GALLERY_FIXTURES.length).toBe(15);
  });

  it('every fixture has a unique id and a non-empty driver note', async () => {
    vi.stubGlobal('__DEV__', true);
    delete process.env['EXPO_PUBLIC_DEMO_MODE'];

    const mod = await import(FIXTURES_MODULE);
    const ids = new Set<string>();
    for (const fixture of mod.GALLERY_FIXTURES) {
      expect(fixture.driver).toBeTruthy();
      expect(ids.has(fixture.id)).toBe(false);
      ids.add(fixture.id);
    }
    expect(ids.size).toBe(15);
  });
});

describe('demo/ isolation — no production module imports from demo/', () => {
  const AFORCE_OS_ROOT = resolve(__dirname, '../..');
  // The gallery's own directory — the only `demo/` production code may never
  // reach into. Resolved (not string-matched) so this can't be confused with
  // the pre-existing, unrelated `services/demo/investorDemoBeats.ts` (a
  // different module that happens to also live under a directory named
  // "demo" one level down inside `services/`).
  const GALLERY_DEMO_DIR = join(AFORCE_OS_ROOT, 'demo');
  const PRODUCTION_DIRS = ['screens', 'hooks', 'services', 'store'];
  const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules']);
  const SOURCE_EXT = /\.(ts|tsx)$/;

  // Matches any bare/relative/aliased import or require specifier.
  const IMPORT_SPECIFIER_RE = /(?:from|require\()\s*['"]([^'"]+)['"]/g;

  function resolveSpecifier(fromFile: string, specifier: string): string | null {
    if (specifier.startsWith('@/')) {
      return resolve(AFORCE_OS_ROOT, specifier.slice(2));
    }
    if (specifier.startsWith('.')) {
      return resolve(dirname(fromFile), specifier);
    }
    return null; // bare package specifier (e.g. 'react') — never our demo/
  }

  function collectSourceFiles(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out; // directory doesn't exist — nothing to scan
    }
    for (const entry of entries) {
      if (SKIP_DIR_NAMES.has(entry)) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        collectSourceFiles(full, out);
      } else if (SOURCE_EXT.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  it('scans screens/, hooks/, services/, store/ for any import that resolves into demo/', () => {
    const offenders: string[] = [];

    for (const dirName of PRODUCTION_DIRS) {
      const dir = join(AFORCE_OS_ROOT, dirName);
      const files = collectSourceFiles(dir);
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        for (const match of content.matchAll(IMPORT_SPECIFIER_RE)) {
          const specifier = match[1];
          const resolved = resolveSpecifier(file, specifier);
          if (resolved && (resolved === GALLERY_DEMO_DIR || resolved.startsWith(GALLERY_DEMO_DIR + '/'))) {
            offenders.push(`${file} -> ${specifier}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('sanity: the scan actually walks a non-trivial number of files', () => {
    let total = 0;
    for (const dirName of PRODUCTION_DIRS) {
      total += collectSourceFiles(join(AFORCE_OS_ROOT, dirName)).length;
    }
    // Guards against a silently-broken path resolution making the isolation
    // test above pass vacuously (zero files scanned).
    expect(total).toBeGreaterThan(20);
  });
});
