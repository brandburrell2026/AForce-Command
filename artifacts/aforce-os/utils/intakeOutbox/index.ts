/**
 * Offline intake outbox — public surface.
 *
 * Pure core (this barrel) is RN-free and unit-tested. The AsyncStorage
 * persistence service lives in `services/intakeOutbox.ts` and the live wiring
 * in the store; both build on these helpers so the invariants stay in lockstep.
 */
export * from './types';
export * from './outbox';
