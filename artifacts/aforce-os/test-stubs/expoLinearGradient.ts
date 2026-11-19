/**
 * Test-only stand-in for expo-linear-gradient, whose build is a native
 * rendering surface that node cannot parse. Wired in vitest.config.ts; never
 * part of the app bundle. A suite's own vi.mock still wins.
 */
export const LinearGradient = () => null;
