// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const shot = vi.hoisted(() => ({ capture: vi.fn(async () => 'file:///tmp/arrival.png') }));
vi.mock('react-native-view-shot', () => {
  const R = require('react');
  return {
    default: R.forwardRef(({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      R.useImperativeHandle(ref, () => ({ capture: shot.capture }));
      return R.createElement(R.Fragment, null, children);
    }),
  };
});
vi.mock('@/services/shareService', () => ({ openShareSheet: vi.fn(async () => true) }));

import { ArrivalShareSheet } from '../travel/ArrivalShareCard';
import { arrivalSharePayload } from '@/utils/travel/arrivalShare';

const payload = arrivalSharePayload({ cityName: 'Tokyo', atmosphere: { kind: 'type_only', name: 'Tokyo', daypart: 'night' } })!;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  shot.capture.mockClear();
  shot.capture.mockImplementation(async () => 'file:///tmp/arrival.png');
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const text = () => document.body.textContent ?? '';
const button = (label: string) =>
  Array.from(document.body.querySelectorAll('[role="button"]')).find((b) => b.textContent === label) as HTMLElement | undefined;

it('previews the card with only the sanctioned content and the privacy lists', async () => {
  const share = vi.fn(async () => true);
  await act(async () => root.render(<ArrivalShareSheet payload={payload} visible onClose={vi.fn()} share={share} />));
  expect(document.body.querySelector('[data-testid="arrival-share-card"]')).toBeTruthy();
  expect(text()).toContain('WELCOME TO');
  expect(text()).toContain('Tokyo');
  expect(text()).toContain('New city. Same standard.');
  expect(text()).toContain('NEVER ON IT');
  expect(text()).toContain('Dates or times');
  expect(text()).toContain('City colour');
  expect(share).not.toHaveBeenCalled();
});

it('shares the captured image only when Share is tapped, then closes', async () => {
  const share = vi.fn(async () => true);
  const onClose = vi.fn();
  await act(async () => root.render(<ArrivalShareSheet payload={payload} visible onClose={onClose} share={share} />));
  await act(async () => button('Share')!.click());
  expect(shot.capture).toHaveBeenCalledTimes(1);
  expect(share).toHaveBeenCalledWith({
    format: 'story',
    message: 'Welcome to Tokyo. New city. Same standard.',
    imageUri: 'file:///tmp/arrival.png',
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('falls back to the same words as text when capture fails; cancel keeps the sheet open', async () => {
  shot.capture.mockImplementation(async () => { throw new Error('no view'); });
  const share = vi.fn(async () => false);
  const onClose = vi.fn();
  await act(async () => root.render(<ArrivalShareSheet payload={payload} visible onClose={onClose} share={share} />));
  await act(async () => button('Share')!.click());
  expect(share).toHaveBeenCalledWith({ format: 'story', message: 'Welcome to Tokyo. New city. Same standard.', imageUri: undefined });
  expect(onClose).not.toHaveBeenCalled();
});

it('Not now closes without sharing', async () => {
  const share = vi.fn(async () => true);
  const onClose = vi.fn();
  await act(async () => root.render(<ArrivalShareSheet payload={payload} visible onClose={onClose} share={share} />));
  await act(async () => button('Not now')!.click());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(share).not.toHaveBeenCalled();
});
