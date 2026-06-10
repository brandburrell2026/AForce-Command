import { describe, expect, it } from 'vitest';

import { firstRunRoute } from '../firstRunRoute';

describe('firstRunRoute', () => {
  it('routes a user who has not completed onboarding to the wizard', () => {
    expect(firstRunRoute({ completedOnboarding: false })).toBe('/onboarding');
  });

  it('leaves a fully-onboarded user in the normal app flow', () => {
    expect(firstRunRoute({ completedOnboarding: true })).toBeNull();
  });

  it('always replays onboarding in demo mode', () => {
    expect(
      firstRunRoute({ completedOnboarding: true, demoMode: true }),
    ).toBe('/onboarding');
  });
});
