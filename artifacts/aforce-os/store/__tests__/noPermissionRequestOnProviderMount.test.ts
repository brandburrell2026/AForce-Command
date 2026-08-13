/**
 * Wave-5 — no OS permission may be requested from `AppProvider` mount.
 *
 * The founder rule this pins: "Do not request a permission before the user
 * understands why AForce wants it." `AppProvider` wraps the entire route
 * tree, so anything it asks for is asked at cold launch — before any AForce
 * copy has appeared. Until this guard, a mount-once effect in
 * `useAppStore.tsx` called `Location.requestForegroundPermissionsAsync()`,
 * making an unexplained iOS location dialog the member's first interaction
 * with the product.
 *
 * This is a REACHABILITY guard, not a single-file string match: it walks the
 * static import graph out of `store/useAppStore.tsx` (relative and `@/`
 * specifiers, static `from '…'` and dynamic `import('…')` alike) and fails if
 * ANY first-party module in that closure contains a `request*PermissionsAsync`
 * call. Moving the request one module away — into a service or helper the
 * provider imports — does not escape it.
 *
 * Third-party specifiers are deliberately not followed: `expo-location` and
 * `expo-notifications` obviously define these functions; what matters is
 * whether AForce code CALLS them from the provider's reach.
 *
 * Source-text rather than a mounted `AppProvider`, same convention and same
 * reason as `appStoreTimerGating.test.ts` and `_renderCountHarness.tsx`:
 * `useAppStore.tsx` transitively imports native/expo services that fail to
 * load under this repo's vitest runtime (the documented `__DEV__ is not
 * defined` gap in `expo-modules-core`, see `governance/TEST-BASELINE.md`).
 *
 * Mutation-verify cases are inlined below: reintroducing the request in the
 * provider, and hiding it one module deep, each fail the graph walk.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const ENTRY = resolve(ROOT, 'store/useAppStore.tsx');
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Any call that can put an OS permission dialog on screen. */
const REQUEST_CALL = /request(?:Foreground|Background)?PermissionsAsync\s*\(/g;

/** Resolves a first-party specifier to a file; returns null for packages. */
function resolveFirstParty(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const ext of EXTENSIONS) {
      const idx = join(base, `index${ext}`);
      if (existsSync(idx)) return idx;
    }
  }
  return null;
}

interface Hit {
  file: string;
  call: string;
}

/**
 * Walks the first-party import closure from `entry`, reading each module
 * through `readSource` so a mutation case can substitute doctored text for
 * one file without touching the repo.
 */
function permissionRequestsReachableFrom(
  entry: string,
  readSource: (file: string) => string,
): { hits: Hit[]; moduleCount: number } {
  const seen = new Set<string>();
  const hits: Hit[] = [];
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    let src: string;
    try {
      src = readSource(file);
    } catch {
      continue;
    }
    // Comments are stripped so a doc comment *describing* the old call (this
    // repo documents removed defects in prose) is never mistaken for one.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
    for (const m of code.matchAll(REQUEST_CALL)) {
      hits.push({ file: file.replace(`${ROOT}/`, ''), call: m[0] });
    }
    for (const m of code.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const next = resolveFirstParty(m[1], file);
      if (next) stack.push(next);
    }
  }
  return { hits, moduleCount: seen.size };
}

const realRead = (file: string) => readFileSync(file, 'utf8');

describe('AppProvider mount requests no OS permission', () => {
  it('reaches no request*PermissionsAsync call anywhere in its first-party import graph', () => {
    const { hits, moduleCount } = permissionRequestsReachableFrom(ENTRY, realRead);
    expect(hits).toEqual([]);
    // Guards the walk itself: a resolver that silently stopped at the entry
    // file would report zero hits for the wrong reason.
    expect(moduleCount).toBeGreaterThan(50);
  });

  it('reads the existing grant instead — a query that never presents a dialog', () => {
    const src = readFileSync(ENTRY, 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
    expect(code).toMatch(/Location\.getForegroundPermissionsAsync\(\)/);
  });

  it('fetches NO weather when the grant is absent — no fabricated coordinates', () => {
    const src = readFileSync(ENTRY, 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
    // The old fallback shipped Denver's air to the engine as if it were the
    // member's; nothing in the UI could tell the two apart.
    expect(code).not.toContain('39.7392');
    expect(code).not.toContain('-104.9903');
    // The tick returns before `refreshWeather` when coordinates are unknown.
    expect(code).toMatch(/const coords = await resolveWeatherCoords\(\);\s*if \(!coords/);
  });

  it('mutation-verify: restoring the request in the provider is caught', () => {
    const doctored = readFileSync(ENTRY, 'utf8').replace(
      'Location.getForegroundPermissionsAsync()',
      'Location.requestForegroundPermissionsAsync()',
    );
    const read = (file: string) => (file === ENTRY ? doctored : realRead(file));
    const { hits } = permissionRequestsReachableFrom(ENTRY, read);
    expect(hits.map((h) => h.file)).toContain('store/useAppStore.tsx');
  });

  it('mutation-verify: hiding the request one module deep is caught too', () => {
    // `services/realApi.ts` is imported by the provider but is not itself the
    // provider — the exact "move it somewhere quieter" evasion the graph walk
    // exists to close.
    const decoy = resolve(ROOT, 'services/realApi.ts');
    const read = (file: string) =>
      file === decoy
        ? `${realRead(file)}\nexport const sneak = () => Location.requestForegroundPermissionsAsync();\n`
        : realRead(file);
    const { hits } = permissionRequestsReachableFrom(ENTRY, read);
    expect(hits.map((h) => h.file)).toContain('services/realApi.ts');
  });
});
