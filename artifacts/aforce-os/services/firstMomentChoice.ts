/**
 * Where the member's "What's coming up first?" answer is kept: on this
 * device, under their own account scope (scopedStorage). It is a display
 * preference for one Home card, never sent anywhere.
 */
import { scopedStorage } from './scopedStorage';
import { parseFirstMomentChoice, type FirstMomentChoice } from '@/utils/firstMoment';

export const FIRST_MOMENT_CHOICE_KEY = '@aforce/firstMomentChoice';

export async function readFirstMomentChoice(): Promise<FirstMomentChoice | null> {
  try {
    return parseFirstMomentChoice(await scopedStorage.getItem(FIRST_MOMENT_CHOICE_KEY));
  } catch {
    return null;
  }
}

/** Null clears it ("Decide later"). Best-effort: a failed write costs only the card's wording. */
export async function writeFirstMomentChoice(choice: FirstMomentChoice | null): Promise<void> {
  try {
    if (choice) await scopedStorage.setItem(FIRST_MOMENT_CHOICE_KEY, choice);
    else await scopedStorage.removeItem(FIRST_MOMENT_CHOICE_KEY);
  } catch {
    // best-effort
  }
}
