import { describe, expect, it } from 'vitest';
import { welcomeGate } from '@/utils/launch/welcomeGate';

const base = { signedIn: false, quiet: false, momentsHydrated: true } as const;

describe('welcomeGate: the welcome screen is for signed-out people only', () => {
  it('shows the welcome screen to a signed-out person during and after the opening', () => {
    expect(welcomeGate({ ...base, phase: 'opening' })).toEqual({ show: true, finish: false });
    expect(welcomeGate({ ...base, phase: 'welcome' })).toEqual({ show: true, finish: false });
  });

  it('never shows it to a signed-in member', () => {
    expect(welcomeGate({ ...base, signedIn: true, phase: 'opening' }).show).toBe(false);
    expect(welcomeGate({ ...base, signedIn: true, phase: 'welcome' }).show).toBe(false);
  });

  it('lets a signed-in member in as soon as the opening has finished, not before', () => {
    expect(welcomeGate({ ...base, signedIn: true, phase: 'opening' }).finish).toBe(false);
    expect(welcomeGate({ ...base, signedIn: true, phase: 'welcome' }).finish).toBe(true);
  });

  it('keeps Quiet as it was: no welcome screen, closed once Moments have loaded', () => {
    expect(welcomeGate({ ...base, quiet: true, momentsHydrated: false, phase: 'opening' })).toEqual({ show: false, finish: false });
    expect(welcomeGate({ ...base, quiet: true, phase: 'opening' })).toEqual({ show: false, finish: true });
    expect(welcomeGate({ ...base, quiet: true, signedIn: true, phase: 'opening' })).toEqual({ show: false, finish: true });
  });

  it('does nothing once the front door is closed', () => {
    expect(welcomeGate({ ...base, phase: 'done' })).toEqual({ show: false, finish: false });
    expect(welcomeGate({ ...base, signedIn: true, phase: 'done' })).toEqual({ show: false, finish: false });
  });
});
