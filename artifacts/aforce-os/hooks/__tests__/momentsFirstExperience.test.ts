import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ moments_enabled: true }));
vi.mock('@/store/useAppStore', () => ({ useFeatureFlags: () => state }));
import { useMomentsFirstExperience } from '../useMomentsFirstExperience';
afterEach(() => { vi.unstubAllEnvs(); state.moments_enabled = true; });
describe('combined app direction stays internal and respects Moments visibility', () => {
  it('preserves public Home and navigation even when Moments is on', () => {
    vi.stubEnv('EXPO_PUBLIC_INTERNAL_TESTFLIGHT', undefined);
    expect(useMomentsFirstExperience()).toBe(false);
  });
  it('enables only when both the internal build and Moments are on', () => {
    vi.stubEnv('EXPO_PUBLIC_INTERNAL_TESTFLIGHT', 'true');
    expect(useMomentsFirstExperience()).toBe(true);
    state.moments_enabled = false;
    expect(useMomentsFirstExperience()).toBe(false);
  });
});
