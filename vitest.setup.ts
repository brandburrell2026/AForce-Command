/**
 * Wave-4 Part 3 — baseline burn-down: the standing 45-file / 18-test
 * failure baseline reduced to exactly TWO missing-environment causes,
 * both fixed here instead of being tolerated:
 *
 * 1. `__DEV__` (React Native's compile-time global) was undefined in
 *    node, crashing 12 client suites at import. Defined as FALSE — the
 *    production posture — via an assignable global so individual tests
 *    can still override it. Audit before defining: zero
 *    `typeof __DEV__ === 'undefined' ||` patterns exist in source, and
 *    all 8 `typeof __DEV__ !== 'undefined' && __DEV__` guards evaluate
 *    identically for undefined and false.
 *
 * 2. `DATABASE_URL` was unset, crashing 33 api-server suites at import
 *    (@workspace/db throws at module load). A pg.Pool does not connect
 *    until first query, so an unreachable placeholder unblocks imports;
 *    suites that genuinely need a live database belong in the
 *    integration lane (vitest.integration.config.ts), not here. Set
 *    only when absent so an explicitly-provided environment still wins.
 */
declare global {
  // eslint-disable-next-line no-var
  var __DEV__: boolean | undefined;
}

if (typeof globalThis.__DEV__ === 'undefined') {
  globalThis.__DEV__ = false;
}

if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] =
    'postgres://unit-test:unit-test@127.0.0.1:1/unit_test_placeholder_never_connects';
}

/**
 * 3. expo-modules-core reads `globalThis.expo.{EventEmitter,NativeModule,
 *    SharedObject,SharedRef}` at module scope (pulled in via
 *    expo-localization → i18nService). Provide the documented node shim so
 *    the 11 suites behind that chain run their REAL assertions.
 */
type AnyGlobal = typeof globalThis & { expo?: unknown };
if (!(globalThis as AnyGlobal).expo) {
  class NoopEventEmitter {
    addListener() {
      return { remove() {} };
    }
    removeAllListeners() {}
    removeSubscription() {}
    emit() {}
  }
  (globalThis as AnyGlobal).expo = {
    EventEmitter: NoopEventEmitter,
    NativeModule: class {},
    SharedObject: class {},
    SharedRef: class {},
  };
}

export {};
