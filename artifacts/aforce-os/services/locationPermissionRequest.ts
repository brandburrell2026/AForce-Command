/**
 * THE ONE DOOR — the single place in AForce that may raise the OS location
 * dialog for environmental evidence, and only from a deliberate member tap.
 *
 * ── WHY THIS IS ITS OWN MODULE ─────────────────────────────────────────────
 *
 * `store/__tests__/noPermissionRequestOnProviderMount.test.ts` walks the
 * static import graph out of `AppProvider` and fails if ANY first-party module
 * in that closure so much as contains a `request*PermissionsAsync` call. Its
 * docblock is explicit that moving the call one module away does not escape
 * it — because the provider imports that module too.
 *
 * `locationIntelligenceService` IS in that closure (the provider owns
 * acquisition), so the request cannot live there. Putting it here, where only
 * the Environmental screen imports it, makes the guarantee STRUCTURAL rather
 * than annotated: the provider genuinely cannot reach a permission prompt, and
 * the guard keeps proving it without an exception carved out.
 *
 * ── AND IT IS NOT AN ACQUISITION OWNER ─────────────────────────────────────
 *
 * It fetches nothing and owns no cadence. `useEnvironmentalAcquisition` remains
 * the only thing that acquires; this asks one question, once, and then lets the
 * existing producer refresh itself.
 */
import { getLocationSnapshot } from './locationIntelligenceService';

export type LocationRequestOutcome = 'granted' | 'denied' | 'unavailable';

/**
 * Ask the member for location, once, because they asked us to.
 *
 * Acquisition deliberately only ever CHECKS permission, so no mount, timer or
 * background tick can surprise anyone with a dialog. That correctness left a
 * member who had never been asked with nowhere to go — the Environmental
 * surface told them evidence was missing and offered no way to supply it.
 * This is the way out, and it opens only when a member pushes it.
 */
export async function requestLocationAccess(): Promise<LocationRequestOutcome> {
  let Location: typeof import('expo-location');
  try {
    Location = await import('expo-location');
  } catch {
    return 'unavailable';
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'denied';
  } catch {
    return 'unavailable';
  }
  // A fresh grant makes the cached "we could not see" snapshot obsolete
  // immediately; force past the TTL so the member's next frame reflects the
  // decision they just made rather than the refusal they just reversed.
  try {
    await getLocationSnapshot(true);
  } catch {
    // Best-effort. The grant still happened, and the evidence layer will
    // report whatever it can see on the next tick.
  }
  return 'granted';
}
