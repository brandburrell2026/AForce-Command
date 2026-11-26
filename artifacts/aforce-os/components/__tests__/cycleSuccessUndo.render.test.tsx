// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Animation and the decorative ring do not own saving or Undo.
vi.mock('react-native-reanimated', async () => {
  const { View } = await import('react-native');
  return {
    default: { View }, useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: () => ({}), useAnimatedReaction: () => {},
    withTiming: (value: number) => value, withSpring: (value: number) => value,
    withDelay: (_ms: number, value: number) => value, runOnJS: (fn: unknown) => fn,
    Easing: { bezier: () => {}, out: () => {}, cubic: () => {} },
  };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: () => 'Next check' }) }));
vi.mock('@/services/haptics', () => ({ hapticNotify: vi.fn() }));
vi.mock('../Icon', () => ({ Icon: () => null }));
vi.mock('../home/cinematic/HomeHydroRing', () => ({ HomeHydroRing: () => null }));
import { CycleSuccessOverlay } from '../CycleSuccessOverlay';
import { UndoStrip } from '../oneBreath/kit/UndoStrip';
import type { CycleResult } from '@/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const result = { scoreBefore: 40, scoreAfter: 44, state: 'BALANCED', gainDisplay: '+4', recordedLabel: '4 oz Water', identityMessage: 'Recorded.', nextCheckMinutes: 30 } as CycleResult;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const button = (label: string) => host.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;

describe('water confirmation does not cover the only Undo control', () => {
  it('keeps the existing Undo action inside the visible logged confirmation', () => {
    const undo = vi.fn(); const dismiss = vi.fn();
    act(() => root.render(<CycleSuccessOverlay result={result} onDismiss={dismiss}><UndoStrip reverses="4 oz water" lasts="6 seconds" onUndo={undo} /></CycleSuccessOverlay>));
    expect(host.textContent).toContain('RECORDED · 4 oz Water');
    const modal = host.querySelector('[data-testid="cycle-success-card"]');
    expect(modal?.contains(button('Undo: 4 oz water'))).toBe(true);
    act(() => button('Undo: 4 oz water')!.click());
    expect(undo).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
  });
  it('withdraws Undo when its owner stops supplying the live action', () => {
    const undo = vi.fn();
    act(() => root.render(<CycleSuccessOverlay result={result} onDismiss={() => {}}><UndoStrip reverses="4 oz water" onUndo={undo} /></CycleSuccessOverlay>));
    act(() => root.render(<CycleSuccessOverlay result={result} onDismiss={() => {}} />));
    expect(button('Undo: 4 oz water')).toBeNull();
    expect(button('Done')).not.toBeNull();
    expect(undo).not.toHaveBeenCalled();
  });
  it('preserves Done without introducing Undo on other logging surfaces', () => {
    const dismiss = vi.fn();
    act(() => root.render(<CycleSuccessOverlay result={result} onDismiss={dismiss} />));
    expect(host.querySelector('[aria-label^="Undo:"]')).toBeNull();
    act(() => button('Done')!.click());
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
  it('wires only the live drink Undo through its owner and includes queued outcomes', () => {
    const src = readFileSync(join(__dirname, '../oneBreath/OneBreathConversationScreen.tsx'), 'utf8');
    expect(src).toContain('queued: snapshot.queued');
    expect(src).toContain('const drinkUndo = snapshot.session.loggedUndo');
    expect(src).toMatch(/<CycleSuccessOverlay[^>]*>[\s\S]*?<UndoStrip[\s\S]*?app\.dismissSuccess\(\);[\s\S]*?controller\.send\(\{ kind: "tap", control: "undo" \}\);[\s\S]*?<\/CycleSuccessOverlay>/);
  });
});
