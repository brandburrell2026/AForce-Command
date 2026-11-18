// @vitest-environment happy-dom
/**
 * The N–И mark is drawn one way, everywhere (Master Brief 2026-11-05 §2):
 * Inter 300, the second N mirrored (never the Cyrillic letter typed as text),
 * a bar 0.4em × 0.056em, Signal Red on black, warm white inside an orb.
 *
 * Before 2026-11-18 the tab bar typed "N–И" in Inter 700 and the One Breath
 * screen typed it in Inter 800.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AFMark, AF_MARK_BAR_HEIGHT_EM, AF_MARK_BAR_WIDTH_EM, AF_MARK_FONT } from '../AFMark';
import { PreparationMark } from '../../oneBreath/PreparationMark';
import { af } from '@/theme';

let host: HTMLElement;
let root: Root | null = null;

function mount(node: React.ReactElement) {
  root = createRoot(host);
  flushSync(() => root!.render(node));
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  if (root) flushSync(() => root!.unmount());
  root = null;
  host.remove();
});

/** The three channels of a colour, whatever notation the renderer reports. */
const channels = (value: string): number[] =>
  value.startsWith('#')
    ? [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))
    : (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

describe('AFMark construction', () => {
  it('is two Latin N letters, never a typed И', () => {
    mount(<AFMark />);
    expect(host.textContent).toBe('NN');
    expect(host.textContent).not.toContain('И');
  });

  it('the constants are the brief\'s', () => {
    expect(AF_MARK_FONT).toBe('Inter_300Light');
    expect(AF_MARK_BAR_WIDTH_EM).toBe(0.4);
    expect(AF_MARK_BAR_HEIGHT_EM).toBe(0.056);
  });

  it('both letters are Inter 300 at the given size', () => {
    mount(<AFMark size={50} />);
    const letters = Array.from(host.querySelectorAll('*')).filter((el) => el.children.length === 0 && el.textContent === 'N') as HTMLElement[];
    expect(letters).toHaveLength(2);
    for (const el of letters) {
      expect(getComputedStyle(el).fontFamily).toContain('Inter_300Light');
      expect(getComputedStyle(el).fontSize).toBe('50px');
    }
  });

  it('the second letter is mirrored by a wrapping view, not by the text', () => {
    mount(<AFMark />);
    const mirrored = Array.from(host.querySelectorAll('*')).filter((el) => /scaleX\(-1\)/.test((el as HTMLElement).style.transform || getComputedStyle(el as HTMLElement).transform || ''));
    expect(mirrored).toHaveLength(1);
    expect(mirrored[0]!.textContent).toBe('N');
    expect(mirrored[0]!.children.length).toBe(1);
  });

  it('the bar is 0.4em wide and 0.056em tall', () => {
    mount(<AFMark size={100} />);
    const bar = Array.from(host.querySelectorAll('*')).find((el) => getComputedStyle(el as HTMLElement).width === '40px') as HTMLElement | undefined;
    expect(bar).toBeDefined();
    expect(parseFloat(getComputedStyle(bar!).height)).toBeCloseTo(5.6, 1);
  });
});

describe('AFMark colour and accessibility', () => {
  it('is Signal Red by default and takes warm white for use inside an orb', () => {
    expect(af.red.toUpperCase()).toBe('#E51E2A');
    mount(<AFMark size={100} />);
    const bar = Array.from(host.querySelectorAll('*')).find((el) => getComputedStyle(el as HTMLElement).width === '40px') as HTMLElement;
    expect(channels(getComputedStyle(bar).backgroundColor)).toEqual(channels('#E51E2A'));
    flushSync(() => root!.unmount());
    mount(<AFMark size={100} color={af.textPrimary} />);
    const white = Array.from(host.querySelectorAll('*')).find((el) => getComputedStyle(el as HTMLElement).width === '40px') as HTMLElement;
    expect(channels(getComputedStyle(white).backgroundColor)).toEqual(channels('#F7F4EF'));
  });

  it('is named "AFORCE" for a screen reader, and silent when decorative', () => {
    mount(<AFMark />);
    expect(host.querySelector('[aria-label="AFORCE"]')).not.toBeNull();
    flushSync(() => root!.unmount());
    mount(<AFMark decorative />);
    expect(host.querySelector('[aria-label="AFORCE"]')).toBeNull();
  });

  it('the older name is the same component', () => {
    expect(PreparationMark).toBe(AFMark);
  });
});

describe('no screen types the mark as a string', () => {
  const appRoot = path.resolve(__dirname, '..', '..', '..');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.name === 'node_modules' || e.name === '__tests__') return [];
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : /\.tsx$/.test(e.name) ? [p] : [];
    });

  it('no JSX text node or string literal renders "N–И"', () => {
    const offenders: string[] = [];
    for (const file of [...walk(path.join(appRoot, 'app')), ...walk(path.join(appRoot, 'components')), ...walk(path.join(appRoot, 'screens'))]) {
      const code = fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\*\*?|\*|\/\/)/.test(line) && !/trademarks? of/i.test(line))
        .join('\n');
      if (/>\s*N[–—-]И\s*</.test(code) || /['"`]N[–—-]И['"`]/.test(code)) offenders.push(path.relative(appRoot, file));
    }
    expect(offenders).toEqual([]);
  });

  it('the tab bar and the One Breath screen use the component', () => {
    expect(fs.readFileSync(path.join(appRoot, 'app/(tabs)/_layout.tsx'), 'utf8')).toContain('<AFMark');
    const ob = fs.readFileSync(path.join(appRoot, 'components/oneBreath/OneBreathScreen.tsx'), 'utf8');
    expect((ob.match(/<AFMark/g) ?? []).length).toBe(2);
  });
});
