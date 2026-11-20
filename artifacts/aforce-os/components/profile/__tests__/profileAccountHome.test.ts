/**
 * Account section of Profile, laid out as the approved prototype: a short
 * list whose rows open named views. The rule this file protects: nothing that
 * used to sit on the Account section may become unreachable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const home = strip(read('AccountHome.tsx'));
const shell = strip(read('ProfileScreenV2.tsx'));
const pane = strip(read('panes/AccountPane.tsx'));

/** Read a `Record<AccountViewId, ...>` literal out of the source (the module itself needs React Native). */
function literal(name: string): string {
  const start = home.indexOf(`export const ${name}`);
  return home.slice(home.indexOf('{', home.indexOf('=', start)), home.indexOf('};', start));
}
const ACCOUNT_VIEW_BLOCKS: Record<string, string[]> = Object.fromEntries(
  [...literal('ACCOUNT_VIEW_BLOCKS').matchAll(/(\w+):\s*\[([^\]]*)\]/g)].map(([, view, list]) => [
    view,
    [...list.matchAll(/'(\w+)'/g)].map((m) => m[1]),
  ]),
);
const ACCOUNT_VIEW_TITLE: Record<string, string> = Object.fromEntries(
  [...literal('ACCOUNT_VIEW_TITLE').matchAll(/(\w+):\s*'([^']+)'/g)].map(([, view, title]) => [view, title]),
);

/** The identifiers in the pane's `return [...]`, in order. */
function paneReturn(): string[] {
  const fn = pane.indexOf('export function renderAccountSections(');
  const start = pane.indexOf('return [', fn);
  return pane.slice(start + 8, pane.indexOf(']', start)).split(',').map((x) => x.trim()).filter(Boolean);
}
/** The names in `ACCOUNT_SECTION_ORDER`, read from source (the module pulls in native code). */
function sectionOrder(): string[] {
  const start = pane.indexOf('export const ACCOUNT_SECTION_ORDER = [');
  return [...pane.slice(start, pane.indexOf('] as const', start)).matchAll(/'(\w+)'/g)].map((m) => m[1]);
}

describe('Account blocks keep a home', () => {
  it('the declared order is exactly what the pane returns', () => {
    expect(sectionOrder()).toEqual(paneReturn());
    expect(sectionOrder().length).toBeGreaterThan(0);
  });

  it('every block is filed under exactly one view', () => {
    expect(Object.keys(ACCOUNT_VIEW_BLOCKS).sort()).toEqual(['body', 'data', 'help', 'plan', 'settings']);
    const filed = Object.values(ACCOUNT_VIEW_BLOCKS).flat();
    const expected = [...sectionOrder(), 'identityBlock', 'gentleEntry', 'skinIAEntry'];
    expect([...filed].sort()).toEqual([...expected].sort());
    expect(new Set(filed).size).toBe(filed.length);
  });

  it('every view can be opened from the list', () => {
    for (const view of Object.keys(ACCOUNT_VIEW_BLOCKS)) {
      expect(home).toContain(`onOpen('${view}')`);
      expect(ACCOUNT_VIEW_TITLE[view]).toBeTruthy();
    }
  });

  it('legal and support stay under Help; sign out under Settings', () => {
    expect(ACCOUNT_VIEW_BLOCKS.help).toContain('legalBlock');
    expect(ACCOUNT_VIEW_BLOCKS.settings).toContain('settingsBlock');
    expect(pane).toMatch(/const settingsBlock = \([\s\S]*?<SignOutRow \/>/);
    expect(home).toContain('sub="Reminders, voice, units, language, sign out"');
  });
});

describe('Account wiring in Profile', () => {
  it('draws the list, or one view with a way back', () => {
    expect(shell).toMatch(/<AccountHome\s+onOpen=\{setAccountView\}\s+onOpenCircle=\{\(\) => router\.push\('\/competition'\)\}/);
    expect(shell).toContain('<AccountViewHeader view={accountView} onBack={() => setAccountView(null)} />');
    expect(shell).toContain('...ACCOUNT_VIEW_BLOCKS[accountView].map((name) => accountBlocks[name])');
  });

  it('builds the views from the same blocks, by declared order', () => {
    expect(shell).toContain('const accountBlocks: Record<string, React.ReactNode> = { identityBlock, gentleEntry, skinIAEntry };');
    expect(shell).toMatch(/ACCOUNT_SECTION_ORDER\.forEach\(\(name, i\) => \{\s*accountBlocks\[name\] = tabSections\.account\[i\];/);
  });

  it('switching section returns Account to its list', () => {
    expect(shell).toMatch(/const setProfileTab = useCallback\(\(tab: ProfileTabId\) => \{\s*setAccountView\(null\);[\s\S]{0,80}setProfileTabRaw\(tab\);/);
  });
});

describe('Account list shows only what is real', () => {
  it('has the prototype rows that exist in the app', () => {
    for (const title of ['Plan', 'Settings', 'What your Circle can see', 'Body details', 'Your data', 'Help']) {
      expect(home).toContain(`title="${title}"`);
    }
    expect(home).toContain('>PRIVACY</Text>');
  });

  it('does not promise a shop, a data download or in-app deletion', () => {
    expect(home).not.toMatch(/Shop AFORCE|Download or delete|Beta preview|no billing/);
  });
});

describe('"What AFORCE remembers" row', () => {
  const route = strip(readFileSync(join(__dirname, '..', '..', '..', 'app', 'remembers.tsx'), 'utf8'));

  it('is drawn only when Profile is given a way to open it', () => {
    expect(home).toMatch(/\{onOpenRemembers \? \(\s*<Row\s+title="What AFORCE remembers"/);
  });

  it('Profile offers it only where Replay exists (internal builds)', () => {
    expect(shell).toContain('const remembersOn = preparationPreviewEnabled();');
    expect(shell).toMatch(/onOpenRemembers=\{remembersOn \? \(\) => router\.push\('\/remembers' as never\) : undefined\}/);
  });

  it('the page itself is closed outside internal builds and to anyone not signed in', () => {
    expect(route).toContain("if (!preparationPreviewEnabled()) return <Redirect href=\"/\" />;");
    expect(route).toContain('if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;');
    expect(route).toContain("scope.status !== 'AUTHENTICATED' || scope.userId !== userId");
  });
});
