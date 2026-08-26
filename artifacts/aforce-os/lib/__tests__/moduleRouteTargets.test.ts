/**
 * NAVIGATION LOCK — every affordance that names a destination must have one.
 *
 * Build 65 device QA: choosing "Recovery" in the Modules launcher returned the
 * member to Home. The entry pointed at `/cruise/recovery`, a route that has
 * never existed — expo-router could not resolve it and fell through to the
 * index. Nothing crashed and nothing logged; the app simply promised a screen
 * and delivered a different one, which is indistinguishable from a bug in the
 * screen itself and cost a full QA cycle to attribute.
 *
 * Two properties are locked here, and the second is what keeps ordinary members
 * away from any dead entry that slips in later:
 *
 *   1. Every `href` in the launcher resolves to a real route file.
 *   2. The launcher itself stays developer-gated, so a production member cannot
 *      reach it at all.
 *
 * Source-scanning rather than rendering, per the convention used by the other
 * screen guards in this repo: the assertion is about what the file DECLARES,
 * and rendering expo-router's tree in node would prove far less.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..');
const MODULES_SRC = readFileSync(resolve(PKG, 'app', 'modules.tsx'), 'utf8');

/** Comments are stripped first: a commented-out href is not an affordance. */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const hrefs = [...withoutComments(MODULES_SRC).matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]!);

/** The file layouts expo-router accepts for a given href. */
function routeExists(href: string): boolean {
  const clean = href.replace(/^\//, '');
  return [
    resolve(PKG, 'app', `${clean}.tsx`),
    resolve(PKG, 'app', clean, 'index.tsx'),
    resolve(PKG, 'app', '(tabs)', `${clean}.tsx`),
  ].some(existsSync);
}

describe('modules launcher navigation lock', () => {
  it('declares at least one destination', () => {
    // Guards against the regex silently matching nothing, which would make
    // every assertion below vacuous.
    expect(hrefs.length).toBeGreaterThan(0);
  });

  it.each(hrefs)('%s resolves to a real route', (href) => {
    expect(
      routeExists(href),
      `app/modules.tsx offers "${href}", but no route file exists for it. expo-router cannot ` +
        'resolve it, so choosing that entry silently falls back to Home — the member is promised ' +
        'a destination and given a different one, with nothing logged. Either add the route or ' +
        'remove the entry; do not repoint it at an unrelated screen.',
    ).toBe(true);
  });

  it('the launcher is developer-gated, so production members cannot reach it', () => {
    const src = withoutComments(MODULES_SRC);
    expect(
      /developerControlsAvailable\(\)/.test(src),
      'app/modules.tsx must gate on developerControlsAvailable(). Without it the internal ' +
        'evaluation launcher — which exposes Guardian, Clutch and Phantom — ships to members.',
    ).toBe(true);
    expect(
      /<Redirect\s+href=/.test(src),
      'app/modules.tsx must redirect non-developers away rather than rendering an empty shell.',
    ).toBe(true);
  });

  it('Recovery is not offered as a destination while it has no route', () => {
    // The pointed-at implementation still exists and stays dark behind
    // `spec_recoveryCoach`; what must not exist is a reachable promise of it.
    expect(
      /cruise\/recovery/.test(withoutComments(MODULES_SRC)),
      'The Recovery launcher entry pointed at /cruise/recovery, which does not exist. It was ' +
        'removed rather than repointed — choosing a destination for it is a product decision.',
    ).toBe(false);
  });
});
