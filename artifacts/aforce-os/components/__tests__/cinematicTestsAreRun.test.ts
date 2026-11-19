/**
 * The test runner only picks up the folders listed in vitest.config. Tests
 * once sat in `components/<area>/cinematic/__tests__/`, which is not listed,
 * so they never ran. They now live in `components/<area>/__tests__/`. This
 * keeps a test from being put back where it would silently not run.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = join(__dirname, '..');

describe('cinematic folders hold no unrun tests', () => {
  for (const area of ['home', 'hydration', 'moments']) {
    it(`${area}/cinematic has no __tests__ folder or test file`, () => {
      const dir = join(COMPONENTS, area, 'cinematic');
      expect(existsSync(dir)).toBe(true);
      expect(existsSync(join(dir, '__tests__'))).toBe(false);
      expect(readdirSync(dir).filter((f) => /\.test\.tsx?$/.test(f))).toEqual([]);
    });
  }
});
