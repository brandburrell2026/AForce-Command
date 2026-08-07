// @vitest-environment happy-dom
/**
 * RingStatusCard — NON-SHIPPING render harness (VS 3.0 P2 migration).
 *
 * The tile was ported off legacy Colors.* / `accent + '40'` opacity concat /
 * a raw #C8C8D0 glyph literal / fontWeight onto the af.* system. This harness
 * pins that the migration left the data readout intact — title, connection
 * state, the biometrics line, and battery — for both connected and searching
 * states. useRingStream / expo-haptics / expo-router / Icon are stubbed so the
 * tile mounts without the suite's documented expo-modules-core `__DEV__` load
 * failure and without a live ring service.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { ringStreamMock } = vi.hoisted(() => ({ ringStreamMock: vi.fn() }));
vi.mock('../../services/ringService', () => ({ useRingStream: ringStreamMock }));
vi.mock('../Icon', () => ({ Icon: () => null }));
vi.mock('expo-haptics', () => ({ selectionAsync: vi.fn(() => Promise.resolve()) }));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));

import { RingStatusCard } from '../RingStatusCard';

const STATE = (over: Record<string, unknown> = {}) => ({
  connected: true,
  batteryPct: 82,
  sessionActive: false,
  biometrics: { heartRateBpm: 72, skinTempC: 36.4, gsrActive: false },
  ...over,
});

let host: HTMLElement;
let root: Root;

function render() {
  root = createRoot(host);
  flushSync(() => root.render(React.createElement(RingStatusCard)));
}
const text = () => host.textContent ?? '';

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  ringStreamMock.mockReset();
});
afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('RingStatusCard — VS 3.0 P2 token migration', () => {
  it('connected: renders the title, "Connected", the biometrics line, and battery', () => {
    ringStreamMock.mockReturnValue(STATE());
    render();
    const t = text();
    expect(t).toContain('AForce Ring');
    expect(t).toContain('Connected');
    expect(t).toContain('72 bpm');
    expect(t).toContain('36.4°C');
    expect(t).toContain('GSR idle');
    expect(t).toContain('82%');
  });

  it('searching: connection copy flips when the ring is not connected', () => {
    ringStreamMock.mockReturnValue(STATE({ connected: false }));
    render();
    const t = text();
    expect(t).toContain('Searching');
    expect(t).not.toContain('Connected');
  });
});
