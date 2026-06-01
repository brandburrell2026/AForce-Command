import { describe, expect, it } from 'vitest';

import { firstRunRoute } from '../firstRunRoute';

describe('firstRunRoute', () => {
  it('routes a brand-new user to the welcome lobby', () => {
    expect(
      firstRunRoute({ seenWelcome: false, completedOnboarding: false }),
    ).toBe('/welcome');
  });

  it('resumes onboarding after an interrupted first run', () => {
    // Cold start mid-onboarding: welcome was seen but the wizard never
    // finished. This is the regression the two-key split fixes.
    expect(
      firstRunRoute({ seenWelcome: true, completedOnboarding: false }),
    ).toBe('/onboarding');
  });

  it('leaves a fully-onboarded user in the normal app flow', () => {
    expect(
      firstRunRoute({ seenWelcome: true, completedOnboarding: true }),
    ).toBeNull();
  });

  it('never lands in normal flow until onboarding is completed', () => {
    expect(
      firstRunRoute({ seenWelcome: false, completedOnboarding: true }),
    ).toBe('/welcome');
  });

  it('always replays the welcome in demo mode', () => {
    expect(
      firstRunRoute({ seenWelcome: true, completedOnboarding: true, demoMode: true }),
    ).toBe('/welcome');
  });
});
