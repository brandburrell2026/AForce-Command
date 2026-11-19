import { useMomentsFirstExperience } from './useMomentsFirstExperience';
import { preparationPreviewEnabled } from '@/services/preparationAccess';

/**
 * True only where One Breath really ends in a plan the member can seal — the
 * same two gates `app/one-breath.tsx` checks. The first-run question and the
 * Home card both promise that plan, so neither shows without it.
 */
export function useFirstMomentAvailable(): boolean {
  const momentsFirst = useMomentsFirstExperience();
  return momentsFirst && preparationPreviewEnabled();
}
