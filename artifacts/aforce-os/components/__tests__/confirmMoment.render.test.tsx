// @vitest-environment happy-dom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const harness = vi.hoisted(() => ({ add: vi.fn(), current: true, replace: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: harness.replace }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@/services/momentsStore', () => ({ addMoment: harness.add, hydrateMoments: vi.fn(), useMomentsStore: () => ({ hydrated: true }) }));
vi.mock('@/services/scopedWriteQueue', () => ({ captureScope: () => ({ generation: 1 }), isScopeCurrent: () => harness.current }));
vi.mock('@/services/userScope', () => ({ getScopeState: () => ({ status: 'AUTHENTICATED', userId: 'test-member' }) }));
vi.mock('@/components/ui', () => ({
  AFPrimaryButton: ({ label, onPress, disabled }: any) => <button disabled={disabled} onClick={onPress}>{label}</button>,
  AFSecondaryButton: ({ label, onPress }: any) => <button onClick={onPress}>{label}</button>,
}));
import { ConfirmMomentScreen } from '../oneBreath/ConfirmMomentScreen';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
function button(label: string) { return Array.from(host.querySelectorAll('[role="button"],button')).find((e) => e.textContent === label) as HTMLElement; }
function field(label: string, value: string) {
  const el = host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
function click(label: string) { act(() => button(label).click()); }
beforeEach(() => {
  harness.add.mockReset(); harness.current = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<ConfirmMomentScreen />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
function review() { field('Describe your moment', 'Dinner with team'); click('Review my moment'); }
describe('Moment draft → review → explicit confirmation', () => {
  it('allows editing/cancel without any canonical write, blocks incomplete forms, then commits once', () => {
    review(); expect(harness.add).not.toHaveBeenCalled();
    click('Confirm plan'); expect(harness.add).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Choose a date');
    field('Moment name', 'Team dinner'); field('Date · YYYY-MM-DD', '2027-01-08'); field('Time · HH:mm', '19:30');
    click('Confirm plan'); expect(harness.add).toHaveBeenCalledTimes(1);
    expect(harness.add.mock.calls[0]![0]).toMatchObject({ source: 'manual', title: 'Team dinner', type: 'personal' });
    expect(host.textContent).toContain('In your plan.');
  });
  it('returns to the draft without saving and refuses a confirmation after account changes', () => {
    review(); click('Back to draft'); expect(harness.add).not.toHaveBeenCalled();
    click('Review my moment'); harness.current = false; click('Confirm plan');
    expect(host.textContent).toContain('Your account changed'); expect(harness.add).not.toHaveBeenCalled();
  });
});
