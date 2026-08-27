/**
 * ProfileScreenV2 — Terms / Privacy / Health Disclaimer / Contact Support
 * must be reachable by ORDINARY signed-in members (Wave-5 compliance fix).
 *
 * The regression this file exists to prevent: `legalBlock` was assigned to
 * the `developer` tab, and `VISIBLE_PROFILE_TABS` strips that tab whenever
 * `developerControlsAvailable()` is false — i.e. in every production build.
 * The four App-Store-required legal/support destinations were therefore
 * dead in the shipped app, contradicting `docs/COMPLIANCE_FRAMEWORK.md`.
 *
 * `ProfileScreenV2` pulls in `useAppStore` / `expo-router` / the WHOOP,
 * Garmin, and Apple Health service modules, so it is not mounted directly —
 * see `profileScreenV2ErrorAndSkeletonWiring.test.ts`'s header for the
 * source-text-guard pattern this repo uses for that container. The guard
 * here reads the tab→sections map and the developer-strip filter out of the
 * source and reasons over them, so it fails on the STRUCTURE that caused
 * the outage, not on any particular wording.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// S2-10b(1): the shared primitives + StyleSheet moved verbatim to
// profileKit.tsx; both files are scanned so every assertion keeps its
// original target. tabSections stays in the shell; the tab-strip consts live in the kit.
const SOURCE =
  readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8') +
  readFileSync(join(__dirname, '..', 'profileKit.tsx'), 'utf8') +
  // S2-10b(2): the tab blocks live in panes/*.tsx now (mechanism move).
  readFileSync(join(__dirname, '..', 'panes', 'PerformancePane.tsx'), 'utf8') +
  readFileSync(join(__dirname, '..', 'panes', 'DevicesPane.tsx'), 'utf8') +
  readFileSync(join(__dirname, '..', 'panes', 'AccountPane.tsx'), 'utf8') +
  readFileSync(join(__dirname, '..', 'panes', 'DeveloperPane.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

/**
 * Slice the balanced `(...)` payload of a `const <name> = (` declaration.
 * Paren-counting (rather than a fixed end marker) keeps the guard working
 * if neighbouring blocks are reordered around the one under test.
 */
function balancedDeclaration(name: string): string {
  const start = CODE.indexOf(`const ${name} = (`);
  if (start === -1) throw new Error(`ProfileScreenV2 no longer declares \`${name}\``);
  let depth = 0;
  for (let i = CODE.indexOf('(', start); i < CODE.length; i += 1) {
    if (CODE[i] === '(') depth += 1;
    else if (CODE[i] === ')') {
      depth -= 1;
      if (depth === 0) return CODE.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced parens in \`${name}\``);
}

/**
 * tab id -> the block identifiers that render under it.
 * S2-10b(2): `tabSections` wires each tab to a pane render function
 * (`renderXSections(paneCtx)` in panes/<X>Pane.tsx) and each pane's
 * `return [...]` lists its blocks — the map follows that chain, so it still
 * fails if a tab loses its pane or a block is moved, duplicated, or dropped.
 */
function tabSectionsMap(): Record<string, string[]> {
  const start = CODE.indexOf('const tabSections: Record<ProfileTabId, React.ReactNode[]>');
  if (start === -1) throw new Error('ProfileScreenV2 no longer declares `tabSections`');
  const body = CODE.slice(start, CODE.indexOf('};', start));
  const map: Record<string, string[]> = {};
  for (const [, id, fn] of body.matchAll(/(\w+):\s*(render\w+Sections)\(paneCtx\)/g)) {
    const fnStart = CODE.indexOf(`export function ${fn}(`);
    if (fnStart === -1) throw new Error(`pane render function \`${fn}\` is not defined in the scanned panes`);
    const retStart = CODE.indexOf('return [', fnStart);
    if (retStart === -1) throw new Error(`\`${fn}\` no longer returns a block array`);
    const list = CODE.slice(retStart + 'return ['.length, CODE.indexOf(']', retStart));
    map[id] = list.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return map;
}

/** Tab ids `VISIBLE_PROFILE_TABS` removes when developer controls are off. */
function developerStrippedTabIds(): string[] {
  const start = CODE.indexOf('const VISIBLE_PROFILE_TABS');
  if (start === -1) throw new Error('ProfileScreenV2 no longer declares `VISIBLE_PROFILE_TABS`');
  const decl = CODE.slice(start, CODE.indexOf(';', start));
  return [...decl.matchAll(/tab\.id\s*!==\s*'(\w+)'/g)].map(([, id]) => id);
}

/**
 * The four destinations App Review and the compliance framework require a
 * member to be able to open from Profile, keyed by the testID each row
 * carries so the assertion names the actual affordance.
 */
const REQUIRED_DESTINATIONS: ReadonlyArray<{ testID: string; target: string }> = [
  { testID: 'profile-legal-terms', target: "router.push('/legal/terms')" },
  { testID: 'profile-legal-privacy', target: "router.push('/legal/privacy')" },
  { testID: 'profile-legal-health', target: "router.push('/legal/health-disclaimer')" },
  { testID: 'profile-legal-support', target: 'mailto:support@aforce.com' },
];

describe('ProfileScreenV2 — legal/support is reachable without developer controls', () => {
  it('assigns `legalBlock` to a tab that survives the developer strip (THE regression: it used to live under `developer`)', () => {
    const sections = tabSectionsMap();
    const stripped = developerStrippedTabIds();
    const hostTabs = Object.entries(sections)
      .filter(([, blocks]) => blocks.includes('legalBlock'))
      .map(([id]) => id);

    expect(hostTabs.length).toBeGreaterThan(0);
    const reachable = hostTabs.filter((id) => !stripped.includes(id));
    expect(
      reachable,
      `legalBlock is only reachable from developer-gated tab(s): ${hostTabs.join(', ')}`,
    ).not.toHaveLength(0);
  });

  it('never lists `legalBlock` under the `developer` tab', () => {
    expect(tabSectionsMap()['developer'] ?? []).not.toContain('legalBlock');
  });

  it('hosts legal/support on ACCOUNT, alongside subscription + settings (founder Profile brief grouping)', () => {
    const account = tabSectionsMap()['account'] ?? [];
    expect(account).toContain('legalBlock');
    expect(account).toContain('subscriptionBlock');
    expect(account).toContain('settingsBlock');
  });

  it('renders legal/support as its own headed group rather than appended to a neighbouring card', () => {
    const block = balancedDeclaration('legalBlock');
    expect(block).toContain("<SectionHeader label={t('profile.v2.legal_label')}");
    expect(block).toContain('testID="profile-legal-support-card"');
  });

  for (const { testID, target } of REQUIRED_DESTINATIONS) {
    it(`keeps the ${testID} row inside legalBlock, pointing at ${target}`, () => {
      const block = balancedDeclaration('legalBlock');
      expect(block).toContain(`testID="${testID}"`);
      expect(block).toContain(target);
    });
  }

  it('the three in-app legal routes it pushes to actually exist', () => {
    const appDir = join(__dirname, '..', '..', '..', 'app');
    for (const route of ['terms', 'privacy', 'health-disclaimer']) {
      expect(existsSync(join(appDir, 'legal', `${route}.tsx`)), `app/legal/${route}.tsx`).toBe(true);
    }
  });
});

describe('ProfileScreenV2 — the developer gate itself is untouched by the compliance fix', () => {
  it('still strips the `developer` tab when developerControlsAvailable() is false (SS-01)', () => {
    expect(developerStrippedTabIds()).toEqual(['developer']);
    expect(CODE).toMatch(/developerControlsAvailable\(\)\s*\?\s*PROFILE_TABS/);
  });

  it('keeps the developer-only contents on the developer tab', () => {
    const developer = tabSectionsMap()['developer'] ?? [];
    expect(developer).toContain('demoAccessCard');
    expect(developer).toContain('developerBlock');
  });
});

describe('ProfileScreenV2 — the LEGAL & SUPPORT group is labelled for what it holds', () => {
  it('every locale names support in the group label (the block carries Contact Support, not only legal docs)', () => {
    const localesDir = join(__dirname, '..', '..', '..', 'locales');
    for (const locale of ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'hi', 'ar']) {
      const json = JSON.parse(readFileSync(join(localesDir, `${locale}.json`), 'utf8'));
      const v2 = json.profile.v2;
      expect(v2.legal_label, `${locale}.json profile.v2.legal_label`).toContain('SUPPORT');
      expect(v2.contact_support, `${locale}.json profile.v2.contact_support`).toBeTruthy();
    }
  });
});
