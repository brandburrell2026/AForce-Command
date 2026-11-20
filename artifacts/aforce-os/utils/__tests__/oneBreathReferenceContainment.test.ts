/**
 * One Breath reference containment.
 *
 * `reference/one-breath/` holds the approved prototype and its screenshots.
 * It is the visual source of truth and nothing else: the app must never
 * import its demo code, scripts or sample data (One Breath Final Build Spec,
 * "Brandon's setup"; CLAUDE.md "One Breath"). This scan fails if any app
 * source file points at that folder.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', '..');
const ROOTS = ['app', 'components', 'config', 'context', 'data', 'featureFlags', 'hooks', 'services', 'theme', 'types', 'utils'];
const NEEDLE = ['reference', 'one-breath'].join('/');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx|js|jsx|json)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe('One Breath reference containment', () => {
  const files = ROOTS.map((r) => join(APP, r)).filter(existsSync).flatMap((r) => sources(r));

  it('scans the app sources', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  it('no app source points at the prototype reference folder', () => {
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(NEEDLE));
    expect(offenders).toEqual([]);
  });
});
