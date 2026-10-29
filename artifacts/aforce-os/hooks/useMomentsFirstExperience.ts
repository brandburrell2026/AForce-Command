import { useFeatureFlags } from '@/store/useAppStore';

/** Founder-approved combined direction, limited to the existing internal build. */
export function useMomentsFirstExperience(): boolean {
  const flags = useFeatureFlags();
  return process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true' && flags.moments_enabled;
}
