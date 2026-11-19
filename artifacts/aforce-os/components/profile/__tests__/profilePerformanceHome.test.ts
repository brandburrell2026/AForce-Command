/**
 * Performance section of Profile, laid out as the approved prototype: the
 * status line and a short list whose rows open named views. Nothing that used
 * to sit on the section may become unreachable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const home = strip(read('PerformanceHome.tsx'));
const shell = strip(read('ProfileScreenV2.tsx'));
const pane = strip(read('panes/PerformancePane.tsx'));

function paneReturn(): string[] {
  const fn = pane.indexOf('export function renderPerformanceSections(');
  const start = pane.indexOf('return [', fn);
  return pane.slice(start + 8, pane.indexOf(']', start)).split(',').map((x) => x.trim()).filter(Boolean);
}
function sectionOrder(): string[] {
  const start = pane.indexOf('export const PERFORMANCE_SECTION_ORDER = [');
  return [...pane.slice(start, pane.indexOf('] as const', start)).matchAll(/'(\w+)'/g)].map((m) => m[1]);
}
function viewBlocks(): Record<string, string[]> {
  const start = home.indexOf('export const PERFORMANCE_VIEW_BLOCKS');
  const body = home.slice(home.indexOf('{', home.indexOf('=', start)), home.indexOf('};', start));
  return Object.fromEntries(
    [...body.matchAll(/(\w+):\s*\[([^\]]*)\]/g)].map(([, view, list]) => [view, [...list.matchAll(/'(\w+)'/g)].map((m) => m[1])]),
  );
}

describe('Performance blocks keep a home', () => {
  it('the declared order is exactly what the pane returns', () => {
    expect(sectionOrder()).toEqual(paneReturn());
    expect(sectionOrder()).toHaveLength(2);
  });

  it('every block is filed under exactly one view, and every view opens from the list', () => {
    const views = viewBlocks();
    expect(Object.values(views).flat().sort()).toEqual([...sectionOrder()].sort());
    for (const view of Object.keys(views)) expect(home).toContain(`onOpen('${view}')`);
  });
});

describe('Performance wiring in Profile', () => {
  it('draws the list, or one view with a way back', () => {
    expect(shell).toContain("<PerformanceHome onOpen={setPerformanceView} onOpenHow={() => router.push('/science')} />");
    expect(shell).toContain('<PerformanceViewHeader view={performanceView} onBack={() => setPerformanceView(null)} />');
    expect(shell).toContain('...PERFORMANCE_VIEW_BLOCKS[performanceView].map((name) => performanceBlocks[name])');
    expect(shell).toMatch(/PERFORMANCE_SECTION_ORDER\.forEach\(\(name, i\) => \{\s*performanceBlocks\[name\] = tabSections\.performance\[i\];/);
  });

  it('switching section returns Performance to its list', () => {
    expect(shell).toMatch(/const setProfileTab = useCallback\([\s\S]{0,200}setPerformanceView\(null\);/);
  });
});

describe('Performance list shows only what is real', () => {
  it('has the status line, the privacy note and the rows', () => {
    expect(home).toContain('homeStatusLine(');
    expect(home).toContain('Private. No counts, no streaks.');
    for (const title of ['What AFORCE remembers', 'How AFORCE works', 'Modes and checks']) {
      expect(home).toContain(`title="${title}"`);
    }
  });

  it('draws no Moments gallery and claims no lessons or learning', () => {
    expect(home).not.toMatch(/Your Moments|Moment Card|lesson|Learning o[nf]|30 seconds/);
  });
});
