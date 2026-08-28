/**
 * Hidden-route guard lock (founder-authorized cruise-placeholder lane,
 * 2026-08-28).
 *
 * The Stage-2 audit flagged the five Rule #15 cruise placeholder screens
 * as "unguarded, deep-link-reachable in production". DEEPER TRACING
 * DISPROVED THAT: the guard exists at the GROUP level —
 * `app/(hidden)/cruise/_layout.tsx` redirects home whenever `spec_cruise`
 * is off, and `spec_cruise` is build-dark in production (false in
 * DEFAULT_FLAGS; production flags initialize fresh each launch with no
 * remote flag service, so no member can reach the placeholders). The
 * audit read the screen files, not the layout. Per the standing rule —
 * "do not manufacture a change" — nothing was changed; this lock exists
 * so the ALREADY-CORRECT guards cannot silently regress:
 *
 *  1. `spec_cruise` stays OFF in production defaults (and ON in the
 *     demo-unlock payload — the sanctioned internal admit path).
 *  2. The cruise group layout keeps its flag gate + redirect, and the
 *     five placeholder screens stay INSIDE the guarded group (a screen
 *     moved out of the group would escape the layout guard).
 *  3. Every standalone hidden/dev route (screen gallery, motion demo,
 *     ui-gallery) keeps its own __DEV__/DEMO redirect.
 *  4. Structural sweep: any FUTURE file added directly under
 *     `app/(hidden)/` must either live in a guarded group or carry its
 *     own Redirect guard — a new hidden route cannot ship guardless.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';

const AOS = join(__dirname, '..', '..');
const HIDDEN = join(AOS, 'app', '(hidden)');
const read = (p: string) => readFileSync(p, 'utf8');

describe('cruise placeholders — build-dark behind the group guard', () => {
  it('spec_cruise is OFF in production defaults and ON only via the demo unlock', () => {
    expect(DEFAULT_FLAGS.spec_cruise).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.spec_cruise).toBe(true);
  });

  it('the group layout gates every child on the flag and redirects home', () => {
    const layout = read(join(HIDDEN, 'cruise', '_layout.tsx'));
    expect(layout).toMatch(/if \(!flags\.spec_cruise\)/);
    expect(layout).toMatch(/<Redirect href="\/" \/>/);
  });

  it('all five placeholder screens live INSIDE the guarded group', () => {
    for (const name of ['journey', 'port', 'pre-port', 'excursion', 'recovery']) {
      expect(
        existsSync(join(HIDDEN, 'cruise', `${name}.tsx`)),
        `${name}.tsx left the guarded (hidden)/cruise group`,
      ).toBe(true);
    }
  });
});

describe('standalone hidden/dev routes keep their own guards', () => {
  it('screen gallery redirects unless __DEV__ or DEMO_MODE', () => {
    expect(read(join(HIDDEN, 'gallery.tsx'))).toMatch(
      /if \(!__DEV__ && !DEMO_MODE\) return <Redirect href="\/" \/>;/,
    );
  });

  it('motion demo redirects unless dev or DEMO_MODE', () => {
    expect(read(join(HIDDEN, 'motion-demo.tsx'))).toMatch(
      /if \(!isDev && !DEMO_MODE\) return <Redirect href="\/" \/>;/,
    );
  });

  it('ui-gallery redirects outside __DEV__', () => {
    expect(read(join(AOS, 'app', 'ui-gallery.tsx'))).toMatch(
      /if \(!__DEV__\) return <Redirect href="\/" \/>;/,
    );
  });
});

describe('structural sweep — no future hidden route ships guardless', () => {
  it('every file directly under app/(hidden)/ is a guarded group or carries a Redirect guard', () => {
    for (const name of readdirSync(HIDDEN)) {
      const full = join(HIDDEN, name);
      if (statSync(full).isDirectory()) {
        // A group is acceptable only if its layout guards (flag or dev/demo).
        const layoutPath = join(full, '_layout.tsx');
        expect(existsSync(layoutPath), `(hidden)/${name}/ has no _layout.tsx guard host`).toBe(true);
        const layout = read(layoutPath);
        expect(layout, `(hidden)/${name}/_layout.tsx must Redirect when its gate is closed`).toMatch(
          /<Redirect/,
        );
        continue;
      }
      if (!/\.tsx?$/.test(name) || name === '_layout.tsx') continue;
      const src = read(full);
      expect(src, `(hidden)/${name} must carry its own Redirect guard`).toMatch(/<Redirect/);
      expect(
        /__DEV__|DEMO_MODE|flags\./.test(src),
        `(hidden)/${name}'s guard must key on __DEV__/DEMO_MODE/a flag`,
      ).toBe(true);
    }
  });
});
