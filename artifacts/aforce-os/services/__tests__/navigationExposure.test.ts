/**
 * PRODUCTION NAVIGATION EXPOSURE — Build-61 correction 5 (device QA, P1).
 *
 * Build 60 failed physical-device QA on a navigation defect, not a rendering
 * one: `app/modules.tsx` — the internal "All Modules" evaluation launcher —
 * shipped with NO feature flag and NO `developerControlsAvailable()` clamp, so
 * it reached production. Walking Profile → PROTOCOL TOOLS → All Modules → Social
 * put the member on the PROTOCOL tab (the launcher's Social card resolves
 * through `/social-v2` → `/night-out`, whose authorization gate then redirected
 * to Protocol). The same launcher listed Guardian, Clutch and Phantom —
 * internal-tier surfaces that must not be reachable in a beta build.
 *
 * Two structural rules came out of that, and this file is their regression lock:
 *
 *   1. The internal launcher is INTERNAL. Same clamp as the Profile DEVELOPER
 *      tab — the route is dead AND the entry point is invisible in production.
 *   2. Protocol is not a drawer. Protocol's job is TODAY / NEXT / WHY /
 *      PROGRESS; Circle (route name `competition`) owns community. A social
 *      entry point that cannot open must not dump the member on Protocol.
 *
 * These are SOURCE guards, not render tests: the screens involved pull in
 * `useAppStore` / `expo-router` / Clerk and are not mountable under Vitest —
 * the same convention `profileScreenV2SectionIA.test.ts` and
 * `services/nightOut/__tests__/routing.test.ts` already use for these files.
 * Comments are stripped before scanning so a file's own explanatory prose
 * (which necessarily names the routes it no longer points at) cannot satisfy
 * or trip an assertion.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const APP_ROOT = join(__dirname, '..', '..'); // artifacts/aforce-os

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const readCode = (...p: string[]): string =>
  stripComments(readFileSync(join(APP_ROOT, ...p), 'utf8'));

/** Every file expo-router treats as a route (everything under `app/`). */
function routeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (extname(entry) === '.tsx' || extname(entry) === '.ts') out.push(full);
    }
  };
  walk(join(APP_ROOT, 'app'));
  return out.map((f) => relative(APP_ROOT, f).split('\\').join('/')).sort();
}

/** Every non-test app source file, for tree-wide entry-point scans. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === 'dist') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (
        (extname(entry) === '.tsx' || extname(entry) === '.ts') &&
        !/\.test\.tsx?$/.test(entry)
      ) out.push(full);
    }
  };
  for (const top of ['app', 'components', 'screens', 'hooks', 'services', 'store']) {
    walk(join(APP_ROOT, top));
  }
  return out.map((f) => relative(APP_ROOT, f).split('\\').join('/')).sort();
}

/** Slice the balanced `{...}` body of the file's `export default function`. */
function defaultExportBody(code: string): string {
  const start = code.indexOf('export default function');
  if (start === -1) throw new Error('no `export default function` in this route file');
  let depth = 0;
  for (let i = code.indexOf('{', code.indexOf(')', start)); i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces in the default export');
}

/** Slice the balanced `(...)` payload of a `const <name> = (` declaration. */
function balancedDeclaration(code: string, name: string): string {
  const start = code.indexOf(`const ${name} = (`);
  if (start === -1) throw new Error(`no \`${name}\` declaration`);
  let depth = 0;
  for (let i = code.indexOf('(', start); i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    else if (code[i] === ')') {
      depth -= 1;
      if (depth === 0) return code.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced parens in \`${name}\``);
}

describe('the internal Modules launcher is not reachable in a production build', () => {
  const modules = readCode('app', 'modules.tsx');

  it('the route itself is clamped by developerControlsAvailable() and redirects out', () => {
    const body = defaultExportBody(modules);
    expect(body).toMatch(/if\s*\(!developerControlsAvailable\(\)\)/);
    expect(body).toMatch(/<Redirect href="\/\(tabs\)\/profile"/);
    // Profile is a terminal tab (it renders a screen, never a Redirect), so the
    // bounce cannot loop. Guarded below in the Circle/terminal-tab check.
  });

  it('the gate runs before any hook, so the clamp cannot be skipped by a render path', () => {
    const body = defaultExportBody(modules);
    // Every hook lives in the inner `ModulesLauncher`; the route function is
    // hook-free, which is what makes an early return legal here.
    expect(body).not.toMatch(/\buse[A-Z]\w*\(/);
    expect(modules).toMatch(/function ModulesLauncher\(\)/);
  });

  it('EXACTLY the two Profile rows link to it — a new entry point anywhere else fails here', () => {
    const linkers = sourceFiles().filter((f) =>
      stripComments(readFileSync(join(APP_ROOT, f), 'utf8')).includes("'/modules'"),
    );
    // S2-10b(2): the V2 row lives in the performance pane now (mechanism move).
    // Founder ruling 2026-08-27 (fifteen-twin retirement): ProfileLegacy is
    // deleted — the pane row is the ONLY launcher entry point left.
    expect(linkers).toEqual([
      'components/profile/panes/PerformancePane.tsx',
    ]);
  });

  it('the ProfileScreenV2 row sits inside the clamp (invisible to an ordinary member)', () => {
    // S2-10b(1): the tab-strip clamp moved verbatim into profileKit.tsx;
    // S2-10b(2): protocolToolsCard moved into panes/PerformancePane.tsx —
    // all three scanned together (mechanism moves, invariant intact).
    const profile =
      readCode('components', 'profile', 'ProfileScreenV2.tsx') +
      readCode('components', 'profile', 'profileKit.tsx') +
      readCode('components', 'profile', 'panes', 'PerformancePane.tsx');
    const tools = balancedDeclaration(profile, 'protocolToolsCard');
    expect(tools).toMatch(
      /developerControlsAvailable\(\)\s*\?\s*\([\s\S]{0,600}?router\.push\('\/modules'\)/,
    );
    // ...and it is the ONLY clamped row in that card: the member-facing tools
    // (sensors, cruise, achievements, science, weekly report) must not have
    // been swept behind the developer gate along with it.
    expect(tools.match(/developerControlsAvailable\(\)/g)).toHaveLength(1);
  });

  // (fifteen-twin retirement: ProfileLegacy and its clamped MODULES card are
  // deleted — that guard retired with its subject; the pane clamp above holds.)

  it('Phantom keeps its own route-level gate — the launcher was never its only lock', () => {
    // Defense in depth: closing the launcher removed the DISCOVERY path; the
    // internal-tier surfaces stay gated at the route/screen regardless.
    expect(readCode('app', 'phantom.tsx')).toMatch(
      /if\s*\(!flags\.phantom_wearable_enabled\)\s*return\s*<Redirect/,
    );
    for (const file of ['guardian.tsx', 'clutch.tsx']) {
      expect(readCode('app', file), `${file} keeps its FeatureGate`).toMatch(/FeatureGate/);
    }
  });
});

describe('Protocol does not become a miscellaneous feature drawer', () => {
  /**
   * `app/(tabs)/social-legacy.tsx` is the one remaining route whose fallback
   * lands on Protocol. It is EXPLICITLY founder-deferred for Build 61 (its
   * Developer-Mode gate was ruled already correct), so it is pinned here as a
   * known exception rather than silently tolerated: if it is ever fixed, this
   * list shrinks and the test says so.
   */
  const DEFERRED_PROTOCOL_FALLBACKS = ['app/(tabs)/social-legacy.tsx'];

  it('no route dumps the member on Protocol except the founder-deferred one', () => {
    const offenders = routeFiles().filter((f) =>
      /<Redirect href="\/\(tabs\)\/protocol"/.test(
        stripComments(readFileSync(join(APP_ROOT, f), 'utf8')),
      ),
    );
    expect(offenders).toEqual(DEFERRED_PROTOCOL_FALLBACKS);
  });

  it('the Protocol surfaces carry no launcher or internal-tier links', () => {
    for (const file of [
      ['app', '(tabs)', 'protocol.tsx'],
      ['components', 'protocol', 'ProtocolScreenV2.tsx'],
    ]) {
      const code = readCode(...file);
      for (const route of ['/modules', '/guardian', '/clutch', '/phantom']) {
        expect(code, `${file.join('/')} must not link to ${route}`).not.toContain(`'${route}'`);
      }
    }
  });

  it('Protocol still renders Protocol — the tab was not repurposed or redirected away', () => {
    const protocol = readCode('app', '(tabs)', 'protocol.tsx');
    expect(protocol).toContain('<ProtocolScreenV2 />');
    expect(protocol).toContain('<ProtocolScreenLegacy />');
    expect(protocol).not.toContain('<Redirect');
  });
});

describe('social entry points reachable in production resolve under Circle', () => {
  // Circle's route file is named `competition` for deep-link stability; the tab
  // label is "Circle" (RC-L1).
  const CIRCLE = /<Redirect href="\/\(tabs\)\/competition"/;

  it('/night-out lands on Circle when unauthorized, never on Protocol', () => {
    const code = readCode('app', 'night-out.tsx');
    expect(code).toMatch(/isNightOutEnabled/); // the gate itself is untouched
    expect(code).toMatch(CIRCLE);
    expect(code).not.toMatch(/href="\/\(tabs\)\/protocol"/);
  });

  it('the /social alias lands on Circle when unauthorized, never on Protocol', () => {
    const code = readCode('app', '(tabs)', 'social.tsx');
    expect(code).toMatch(/isNightOutEnabled/);
    expect(code).toMatch(CIRCLE);
    expect(code).not.toMatch(/href="\/\(tabs\)\/protocol"/);
  });

  it('/social-v2 defers to the canonical gated route, so its chain also ends at Circle', () => {
    const code = readCode('app', 'social-v2.tsx');
    expect(code).toMatch(/<Redirect href=\{NIGHT_OUT_HREF\}/);
    expect(code).toMatch(/'\/night-out'/);
    expect(code).not.toMatch(/href="\/\(tabs\)\/protocol"/);
  });

  it('Circle is terminal — the landing tab renders a screen and never redirects on', () => {
    const circle = readCode('app', '(tabs)', 'competition.tsx');
    expect(circle).not.toContain('Redirect');
    expect(circle).toContain('<CircleScreenV3 />');
    // Profile is terminal too — it is where the clamped Modules route bounces.
    expect(readCode('app', '(tabs)', 'profile.tsx')).not.toContain('Redirect');
  });
});

describe('no approved functionality became unreachable', () => {
  // S2-10b(1): the clamp expression lives in profileKit.tsx;
  // S2-10b(2): protocolToolsCard lives in panes/PerformancePane.tsx — scan all.
  const profile =
    readCode('components', 'profile', 'ProfileScreenV2.tsx') +
    readCode('components', 'profile', 'profileKit.tsx') +
    readCode('components', 'profile', 'panes', 'PerformancePane.tsx');
  const layout = readCode('app', '(tabs)', '_layout.tsx');

  /**
   * Everything the launcher listed that is APPROVED for production keeps a
   * member-facing entry point that does NOT go through the launcher. (Sleep,
   * Recovery, Guardian, Clutch and Phantom are deliberately absent: each was
   * already flag-gated or hidden-but-routable before this change, so closing
   * the launcher removed no approved production surface.)
   */
  const SURVIVING_ENTRIES: ReadonlyArray<{ module: string; needle: string }> = [
    { module: 'Providers', needle: "router.push('/sensors')" },
    { module: 'Cruise', needle: "router.push('/cruise')" },
    // Founder ruling 2026-08-27 (Build-70 validation): Sweat's only member
    // entry — the legacy Home tile row — retired with the fifteen twins;
    // this Profile row is now its canonical path and must survive.
    { module: 'Sweat Calculator', needle: "router.push('/sweat')" },
    { module: 'Science', needle: "router.push('/science')" },
    { module: 'Achievements', needle: "router.push('/achievements')" },
    { module: 'Weekly Report', needle: "router.push('/weekly-report')" },
  ];

  for (const { module, needle } of SURVIVING_ENTRIES) {
    it(`${module} is still reachable from Profile without developer controls`, () => {
      expect(balancedDeclaration(profile, 'protocolToolsCard')).toContain(needle);
    });
  }

  it('Scan keeps its Home + Hydration entries (it was never launcher-only)', () => {
    expect(readCode('components', 'home', 'HomeDashboard.tsx')).toContain("router.push('/scan')");
    expect(readCode('components', 'hydration', 'HydrationScreenV2.tsx'))
      .toContain("router.push('/scan')");
  });

  it('the five approved bottom tabs are untouched — nothing was added or removed', () => {
    for (const name of ['index', 'journal', 'protocol', 'competition', 'profile']) {
      expect(layout).toMatch(new RegExp(`name="${name}"`));
    }
    expect(layout).not.toMatch(/name="modules"/);
    expect(layout).not.toMatch(/name="night-out"/);
  });

  it('the Profile DEVELOPER tab clamp is unchanged — this correction reused it, it did not widen it', () => {
    expect(profile).toMatch(/developerControlsAvailable\(\)\s*\?\s*PROFILE_TABS/);
  });
});
