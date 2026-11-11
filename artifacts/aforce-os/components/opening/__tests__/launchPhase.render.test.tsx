// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useLaunchPhase } from '@/hooks/useLaunchPhase';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement('div');
let root: ReturnType<typeof createRoot>;
let launch: ReturnType<typeof useLaunchPhase>;
function Harness({ skip = false }: { skip?: boolean }) {
  launch = useLaunchPhase(skip);
  return <div>{launch.phase}</div>;
}
afterEach(() => { act(() => root.unmount()); host.replaceChildren(); });
describe('cold-launch overlay lifecycle', () => {
  it('keeps the normal opening and welcome, then ignores late completion after entry or Lock In', () => {
    root = createRoot(host); act(() => root.render(<Harness />));
    expect(host.textContent).toBe('opening');
    act(() => launch.handleOpeningDone()); expect(host.textContent).toBe('welcome');
    act(() => launch.handleEntered()); expect(host.textContent).toBe('done');
    act(() => launch.handleOpeningDone()); expect(host.textContent).toBe('done');
    act(() => root.render(<Harness />)); expect(host.textContent).toBe('done');
  });
  it('does not resurrect the welcome when Quiet or capture bypasses the opening', () => {
    root = createRoot(host); act(() => root.render(<Harness />));
    act(() => launch.handleEntered());
    act(() => launch.handleOpeningDone()); expect(host.textContent).toBe('done');
    act(() => root.unmount()); root = createRoot(host);
    act(() => root.render(<Harness skip />));
    act(() => launch.handleOpeningDone()); expect(host.textContent).toBe('done');
  });
});
