/**
 * Devices section of Profile, laid out as the approved prototype: a short
 * list that reports each source, and "Manage devices and apps" for the full
 * cards. The rule this file protects: the list may never disagree with the
 * cards, and no device control may become unreachable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const home = strip(read('DevicesHome.tsx'));
const shell = strip(read('ProfileScreenV2.tsx'));
const pane = strip(read('panes/DevicesPane.tsx'));
const kinds = strip(readFileSync(join(__dirname, '..', '..', '..', 'utils', 'health', 'providerRowStatus.ts'), 'utf8'));

describe('one status resolver for the list and the cards', () => {
  it('the cards and the list both go through deviceStatusResolver', () => {
    expect(pane).toContain('export function deviceStatusResolver(ctx: ProfilePaneCtx)');
    expect(pane.match(/const statusFor = deviceStatusResolver\(ctx\);/g)).toHaveLength(2);
    expect(pane).toContain('const { row, demoLinked, linked, isGarmin, isWhoop, garminDemo } = statusFor(p);');
    // The honest resolver is called in exactly one place.
    expect(pane.match(/deriveProviderRowStatus\(\{/g)).toHaveLength(1);
  });

  it('the list picks its pill from the same kind the cards announce', () => {
    expect(pane).toContain('const kind = providerRowA11yKind({ demoLinked, live: row.live, status: row.status });');
    expect(pane).toContain('const { pill, word } = DEVICE_SUMMARY_BY_KIND[kind];');
  });

  it('every row kind has wording, and only a live connection says On', () => {
    const start = kinds.indexOf('export type ProviderRowA11yKind =');
    const all = [...kinds.slice(start, kinds.indexOf(';', start)).matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(all.length).toBeGreaterThan(0);
    const table = pane.slice(pane.indexOf('export const DEVICE_SUMMARY_BY_KIND'), pane.indexOf('};', pane.indexOf('export const DEVICE_SUMMARY_BY_KIND')));
    for (const kind of all) expect(table).toMatch(new RegExp(`\\b${kind}: \\{ pill:`));
    expect([...table.matchAll(/(\w+): \{ pill: 'On'/g)].map((m) => m[1])).toEqual(['live']);
    expect(table).toContain("demo: { pill: 'Demo', word: 'Sample data' }");
  });
});

describe('Devices wiring in Profile', () => {
  it('opens on the list and waits for the connection checks', () => {
    expect(shell).toContain('rows={whoopStatusChecked && garminStatusChecked ? deviceSummaries(paneCtx) : null}');
    expect(home).toContain('Checking your connections…');
  });

  it('Manage shows every device block that existed before, with a way back', () => {
    expect(shell).toMatch(/\{devicesManaging \? \([\s\S]*?<DevicesManageHeader onBack=\{\(\) => setDevicesManaging\(false\)\} \/>[\s\S]*?activeSections\.map/);
    expect(pane).toContain('return [connectedDataBlock, hardwareCard];');
    expect(home.match(/onPress=\{onManage\}/g)).toHaveLength(2);
  });

  it('switching section returns Devices to its list', () => {
    expect(shell).toMatch(/const setProfileTab = useCallback\(\(tab: ProfileTabId\) => \{\s*setAccountView\(null\);\s*setDevicesManaging\(false\);/);
  });
});

describe('the list only reports', () => {
  it('holds no connect, disconnect or refresh control', () => {
    expect(home).not.toMatch(/toggleProvider|handleWhoopToggle|handleGarminToggle|refreshAppleSnapshot|Switch\b/);
  });

  it('does not claim a last-updated time it does not have', () => {
    expect(home).toContain('Each source shows what it reads.');
    expect(home).not.toMatch(/last updated|when it last/i);
  });
});
