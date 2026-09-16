/**
 * Sensor-import route integrity.
 *
 * W2-N3 is resolved server-side: sensor provenance is written as
 * NOT_COMPUTED and never becomes a readiness score. This client lock makes
 * sure both visual variants use that single server-owned writer, rather than
 * recreating a local score or taking a separate write path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '..', '..');
const ROUTE = join(APP_ROOT, 'app', 'sensors.tsx');
const SCREEN_V2 = 'SensorImportScreenV2';
const SCREEN_LEGACY = 'SensorImportScreen';
const WRITER = 'postSensorImport';

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

describe('sensor import — both presentations use the canonical provenance writer', () => {
  it('selects a visual variant without an obsolete TestFlight stop-ship redirect', () => {
    expect(route).not.toContain('INTERNAL_TESTFLIGHT_OVERLAY_ENABLED');
    expect(route).toContain(`return specSensors ? <${SCREEN_V2} /> : <${SCREEN_LEGACY} />`);
  });

  it('app/sensors.tsx is the only file that mounts either import screen', () => {
    const mounts = ALL.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return src.includes(`<${SCREEN_V2}`) || src.includes(`<${SCREEN_LEGACY} `);
    }).map(rel);
    expect(mounts.sort()).toEqual(['app/sensors.tsx']);
  });

  it('only the two presentation screens call the server-owned writer', () => {
    const callers = ALL.filter((f) => {
      const src = readFileSync(f, 'utf8');
      if (src.includes(`export async function ${WRITER}`)) return false;
      return src.includes(`${WRITER}(`);
    }).map(rel).sort();
    expect(callers).toEqual(
      ['components/sensors/SensorImportScreenV2.tsx', 'screens/SensorImportScreen.tsx'].sort(),
    );
  });

  it('each visual variant leaves measurement integrity to that same writer', () => {
    const v2 = readFileSync(join(APP_ROOT, 'components', 'sensors', `${SCREEN_V2}.tsx`), 'utf8');
    const legacy = readFileSync(join(APP_ROOT, 'screens', `${SCREEN_LEGACY}.tsx`), 'utf8');
    expect(v2).toContain(`${WRITER}(`);
    expect(legacy).toContain(`${WRITER}(`);
  });
});
