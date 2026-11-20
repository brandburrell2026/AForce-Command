// @vitest-environment happy-dom
/**
 * One Breath kit — the shared pieces from the approved prototype that the app
 * did not have yet: source chips, the operations log, the Undo strip and the
 * result card (One Breath Final Build Spec, "Components").
 *
 * These are presentational: they draw what they are given. The tests pin the
 * truthfulness rules a drawing can enforce (states in words, not colour only;
 * Undo names what it reverses; "estimated" is said) and that the kit holds no
 * colour or behaviour of its own.
 */
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/components/Icon', () => ({ Icon: () => null }));
import { OperationsLog, ResultCard, SourceChips, UndoStrip, logLineLabel, resultCardLabel, sourceChipLabel, undoLabel } from '../oneBreath/kit';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const render = (node: React.ReactNode) => act(() => root.render(node));
const button = (label: string) => host.querySelector(`[aria-label="${label}"]`) as HTMLElement;

beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('SourceChips', () => {
  it('names each source and how fresh it is', () => {
    render(<SourceChips chips={[{ label: 'Health', state: 'connected' }, { label: 'Calendar', state: 'connected' }]} synced="2m" />);
    expect(host.textContent).toContain('Health');
    expect(host.textContent).toContain('Calendar');
    expect(host.textContent).toContain('Synced 2m');
  });

  it('a missing source is said in words, never left to a dot colour', () => {
    render(<SourceChips chips={[{ label: 'Health', state: 'not_authorized' }, { label: 'Calendar', state: 'unavailable' }]} />);
    expect(host.textContent).toContain('Health · not authorized');
    expect(host.textContent).toContain('Calendar · unavailable');
    expect(sourceChipLabel({ label: 'Calendar', state: 'unavailable' })).toBe('Calendar, unavailable');
  });

  it('draws nothing when no source was used', () => {
    render(<SourceChips chips={[]} synced="2m" />);
    expect(host.textContent).toBe('');
  });
});

describe('OperationsLog', () => {
  const lines = [
    { n: 5, label: 'Sent', note: 'By you', text: 'Delivered to Annette.', tone: 'accent' as const },
    { n: 6, label: 'Done', text: 'Nothing else is pending.', detail: 'Quiet until 6:00 PM.', tone: 'done' as const },
  ];

  it('shows numbered lines in order with their words', () => {
    render(<OperationsLog lines={lines} />);
    const text = host.textContent ?? '';
    expect(text).toContain('05 · Sent');
    expect(text).toContain('06 · Done');
    expect(text.indexOf('Delivered to Annette.')).toBeLessThan(text.indexOf('Nothing else is pending.'));
    expect(logLineLabel(lines[1])).toBe('Step 6. Done. Nothing else is pending.. Quiet until 6:00 PM.');
  });

  it('a line can carry its own choices, and pressing one calls back once', () => {
    const retry = vi.fn();
    render(<OperationsLog lines={[{ n: 5, label: 'Not sent yet', text: 'The connection dropped. Nothing was delivered.', actions: [{ label: 'Retry', onPress: retry, primary: true }, { label: 'Not now', onPress: () => {} }] }]} />);
    act(() => button('Retry').click());
    expect(retry).toHaveBeenCalledTimes(1);
    expect(button('Not now')).toBeTruthy();
  });
});

describe('UndoStrip', () => {
  it('says exactly what Undo reverses and for how long', () => {
    const undo = vi.fn();
    render(<UndoStrip reverses="Logged 12 oz coffee" lasts="6 seconds" onUndo={undo} />);
    expect(host.textContent).toContain('Logged 12 oz coffee · 6 seconds');
    expect(undoLabel('Logged 12 oz coffee')).toBe('Undo: Logged 12 oz coffee');
    act(() => button('Undo: Logged 12 oz coffee').click());
    expect(undo).toHaveBeenCalledTimes(1);
  });
});

describe('ResultCard', () => {
  it('shows the value it is given and says when it is an estimate', () => {
    render(<ResultCard value={44} word="Behind" estimated position={0.44} footnote="Coffee logged · partial credit pending" />);
    expect(host.textContent).toContain('44');
    expect(host.textContent).toContain('Behind');
    expect(host.textContent).toContain('Estimated');
    expect(resultCardLabel({ value: 44, word: 'Behind', estimated: true })).toBe('HydroState 44. Behind. estimated');
  });

  it('does not say "estimated" for a measured value', () => {
    render(<ResultCard value={81} word="Balanced" estimated={false} position={0.81} />);
    expect(host.textContent).not.toContain('Estimated');
  });
});

describe('the kit holds no colour, score or behaviour of its own', () => {
  const DIR = join(__dirname, '..', 'oneBreath', 'kit');
  const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f));
  const code = files.map((f) => readFileSync(join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).join('\n');

  it('uses the shared tokens only: no hex, no rgba', () => {
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(code).not.toMatch(/rgba?\(/);
  });

  it('reads no engine, store, status colour or network', () => {
    expect(code).not.toMatch(/statusColor|scoringEngine|hydroStateModel|momentsStore|AsyncStorage|fetch\(|@\/services\//);
  });

  it('every button is at least 44pt tall', () => {
    // Buttons only: the text box is 40pt inside a 54pt bar and grows with text size.
    const buttons = code.split('\n').filter((l) => !/^\s*input:/.test(l)).join('\n');
    expect(buttons.match(/minHeight: (\d+)/g)?.every((m) => Number(m.split(' ')[1]) >= 44)).toBe(true);
    // The bar's 40pt round buttons reach 44pt through their touch area.
    expect(code.match(/hitSlop=\{2\}/g)).toHaveLength(2);
  });
});
