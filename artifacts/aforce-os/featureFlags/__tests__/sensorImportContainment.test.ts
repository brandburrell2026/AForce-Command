/**
 * W2-N3 CONTAINMENT LOCK — the controlled TestFlight build must not be able to
 * fabricate a measurement.
 *
 * A sensor import persists a placeholder `70 / BALANCED` score row, and those
 * rows are read back by `/journal/rollups` (average score, band time-share,
 * Journal consistency KPI, Protocol compliance). Shipping that to a cohort
 * would put an invented observation in front of a tester as if it had been
 * measured. Stop-ship register W2-N3 (S2); constitution: code calculates, AI
 * explains, neither invents measurements.
 *
 * WHY THIS LOCK IS A SOURCE SCAN AND NOT A RENDER TEST. `app/**` matches NO
 * include glob in `vitest.config.ts` — the config itself carries three
 * comments about locks that silently never ran because of exactly that. A
 * `.test.tsx` render test next to the route would not execute, so the gate
 * would be unenforced while appearing covered. `featureFlags/**\/__tests__/
 * **\/*.test.ts` IS matched, so the lock lives here.
 *
 * WHAT WOULD DEFEAT A NAIVE VERSION OF THIS TEST, and is therefore asserted
 * explicitly:
 *   - deleting the gate                    -> (1) fails
 *   - moving the gate below a screen mount -> (2) fails, on ORDER not presence
 *   - mounting a screen from a second file -> (3) fails
 *   - a new caller of the write            -> (4) fails
 *
 * `spec_sensors` is deliberately NOT the lever here. It only selects which of
 * the two import screens renders, and BOTH call `postSensorImport`, so turning
 * it off swaps V2 for the legacy screen and contains nothing. Assertion (5)
 * pins that reading so a future reader cannot mistake the flag for a gate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '..', '..');
const ROUTE = join(APP_ROOT, 'app', 'sensors.tsx');

const GATE = 'INTERNAL_TESTFLIGHT_OVERLAY_ENABLED';
const SCREEN_V2 = 'SensorImportScreenV2';
const SCREEN_LEGACY = 'SensorImportScreen';
/** The single client function that POSTs to /aforce/sensors/import. */
const WRITER = 'postSensorImport';

/** Every source file in the app, excluding deps, build output and tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (
      entry === 'node_modules' || entry === '.expo' || entry === 'dist' ||
      entry === 'ios' || entry === 'android' || entry === '__tests__' ||
      entry.startsWith('.')
    ) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const ALL = sourceFiles(APP_ROOT);
const rel = (f: string) => f.slice(APP_ROOT.length + 1);
const route = readFileSync(ROUTE, 'utf8');

describe('W2-N3 — the sensors import is contained in the internal TestFlight build', () => {
  it('(1) the route gates on the internal-TestFlight build constant', () => {
    expect(route, 'app/sensors.tsx must import the internal-TestFlight gate').toContain(GATE);
    // A bare mention is not a gate — it has to actually short-circuit.
    expect(
      route,
      'the gate must produce an early return, not merely be referenced',
    ).toMatch(new RegExp(`if\\s*\\(\\s*${GATE}\\s*\\)\\s*return`));
  });

  it('(2) the gate short-circuits BEFORE either import screen can mount', () => {
    // Order, not presence. A gate that runs after the screens are returned is
    // dead code, and a presence-only assertion would pass against it.
    const gateAt = route.search(new RegExp(`if\\s*\\(\\s*${GATE}\\s*\\)\\s*return`));
    const v2At = route.indexOf(`<${SCREEN_V2}`);
    const legacyAt = route.indexOf(`<${SCREEN_LEGACY} `);

    expect(gateAt, 'gate not found').toBeGreaterThanOrEqual(0);
    expect(v2At, 'V2 screen mount not found').toBeGreaterThanOrEqual(0);
    expect(legacyAt, 'legacy screen mount not found').toBeGreaterThanOrEqual(0);
    expect(gateAt, 'gate must precede the V2 mount').toBeLessThan(v2At);
    expect(gateAt, 'gate must precede the legacy mount').toBeLessThan(legacyAt);
  });

  it('(3) app/sensors.tsx is the ONLY file that mounts either import screen', () => {
    // The gate is only a chokepoint while this holds. A second mount anywhere
    // would route around it silently.
    const mounts = ALL.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return src.includes(`<${SCREEN_V2}`) || src.includes(`<${SCREEN_LEGACY} `);
    }).map(rel);

    expect(mounts.sort()).toEqual(['app/sensors.tsx']);
  });

  it('(4) only those two screens call the import writer', () => {
    const callers = ALL.filter((f) => {
      const src = readFileSync(f, 'utf8');
      // Skip the definition site itself.
      if (src.includes(`export async function ${WRITER}`)) return false;
      return src.includes(`${WRITER}(`);
    }).map(rel).sort();

    expect(
      callers,
      'a new caller of postSensorImport would bypass the route gate entirely',
    ).toEqual(
      ['components/sensors/SensorImportScreenV2.tsx', 'screens/SensorImportScreen.tsx'].sort(),
    );
  });

  it('(6) the internal EAS profile actually sets the env the gate reads', () => {
    // WITHOUT THIS THE WHOLE LOCK IS VACUOUS. Assertions (1)-(4) prove the gate
    // is wired correctly in source, but the gate only engages when
    // EXPO_PUBLIC_INTERNAL_TESTFLIGHT === 'true' at build time. Drop that key
    // from the profile and every other assertion here still passes while the
    // shipped binary exposes the import again — the profile is the other half
    // of the containment and has to be pinned too.
    const eas = JSON.parse(readFileSync(join(APP_ROOT, 'eas.json'), 'utf8')) as {
      build: Record<string, { extends?: string; env?: Record<string, string> }>;
    };

    // Resolve `extends` the way EAS does, so an inherited value still counts.
    const envFor = (name: string): Record<string, string> => {
      const p = eas.build[name];
      if (!p) throw new Error(`eas.json has no build profile "${name}"`);
      const parent = p.extends ? envFor(p.extends) : {};
      return { ...parent, ...(p.env ?? {}) };
    };

    expect(
      envFor('internal')['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'],
      'the internal profile must set EXPO_PUBLIC_INTERNAL_TESTFLIGHT="true" or the gate never engages',
    ).toBe('true');
  });

  it('(5) spec_sensors is NOT a containment lever — both branches still import', () => {
    // Pinning the trap: the obvious "just turn spec_sensors off" fix selects
    // the LEGACY screen, which writes exactly the same placeholder row.
    const v2 = readFileSync(join(APP_ROOT, 'components', 'sensors', `${SCREEN_V2}.tsx`), 'utf8');
    const legacy = readFileSync(join(APP_ROOT, 'screens', `${SCREEN_LEGACY}.tsx`), 'utf8');

    expect(v2).toContain(`${WRITER}(`);
    expect(legacy, 'the legacy screen writes too — flipping the flag contains nothing').toContain(
      `${WRITER}(`,
    );
  });
});
