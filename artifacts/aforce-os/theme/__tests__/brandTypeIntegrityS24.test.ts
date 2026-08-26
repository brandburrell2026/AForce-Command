/**
 * S2-4 wave 1 — brand typeface integrity on the commerce surfaces.
 *
 * Stage-2 audit: Store and Cart declared text with bare `fontWeight` and no
 * `fontFamily`, so React Native rendered BOTH money surfaces in the OS
 * system face (SF Pro / Roboto) instead of the loaded Inter brand type —
 * the only screens in the app outside the brand typeface. Wave 1 replaces
 * every bare weight with the real family via `Typography.fonts.*`.
 *
 * (The companion off-palette fixes on the auth screens are locked by the
 * raw-color ratchet itself — their baseline entries now sit at 0.)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');

function files(dir: string): string[] {
  return readdirSync(resolve(PKG, dir))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(dir, f));
}

describe('S2-4 — commerce renders in the brand typeface', () => {
  for (const rel of [...files('components/store'), ...files('components/cart')]) {
    it(`${rel}: no bare fontWeight — every text style names a brand family`, () => {
      const src = readFileSync(resolve(PKG, rel), 'utf8');
      expect(src).not.toMatch(/fontWeight\s*:/);
    });
  }

  it('StoreScreenV2 and CartScreenV2 import the Typography families they now use', () => {
    for (const rel of ['components/store/StoreScreenV2.tsx', 'components/cart/CartScreenV2.tsx']) {
      const src = readFileSync(resolve(PKG, rel), 'utf8');
      expect(src).toMatch(/import \{ Typography \} from ['"]@\/theme\/typography['"]/);
      expect((src.match(/Typography\.fonts\./g) ?? []).length).toBeGreaterThan(5);
    }
  });
});
