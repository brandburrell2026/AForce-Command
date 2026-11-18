import { countsAsWater } from './drinkRoute';

/**
 * Which line Smart Capture shows under a suggested drink (RA-N6).
 *
 * It must say what the approved model does (`hydrostate-v2.0`, decision C1):
 * plain water counts 1:1, every other drink is saved without changing
 * HydroState. The answer comes from `drinkRoute`, the same function the log
 * uses, never from the catalog's old `hydrationCoefficient`.
 */
export function smartCaptureCorrectionMetaKey(categoryId: string, drinkName?: string): string {
  return countsAsWater(categoryId, drinkName)
    ? 'hydroScan2.smartCapture.correction_meta_counted'
    : 'hydroScan2.smartCapture.correction_meta_recorded';
}
