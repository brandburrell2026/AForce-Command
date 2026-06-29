// polyfills.js
// --- Hermes Object.fromEntries crash fix (React Native 0.81.5 / New Architecture) ---
// Symptom: app crashes on launch with EXC_BAD_ACCESS (SIGSEGV) inside
//          hermes::vm::objectFromEntries on the first JS event-loop tick.
// Cause:   A native Object.fromEntries call (from a dependency, executed at
//          module-load/startup) hits a Hermes iterator segfault on this RN build.
// Fix:     Replace the native implementation with a safe JS one, loaded before
//          any other code runs. Routes every fromEntries call (yours or a
//          dependency's) through the safe path. No native code or deps touched.
//
// IMPORTANT: This file must be imported on the VERY FIRST LINE of the app's
// root entry (app/_layout.tsx), before any other import.

(function () {
  function safeFromEntries(entries) {
    var obj = {};
    if (entries === null || entries === undefined) {
      throw new TypeError('Object.fromEntries requires an iterable argument');
    }
    // Fast path: plain array of [key, value] pairs (the common case)
    if (Array.isArray(entries)) {
      for (var i = 0; i < entries.length; i++) {
        var pair = entries[i];
        if (pair !== null && pair !== undefined) {
          obj[pair[0]] = pair[1];
        }
      }
      return obj;
    }
    // Generic iterable: Map, Set-of-pairs, generators, etc.
    var iterFn = entries[Symbol.iterator];
    if (typeof iterFn === 'function') {
      var iterator = iterFn.call(entries);
      var step = iterator.next();
      while (!step.done) {
        var p = step.value;
        if (p !== null && p !== undefined) {
          obj[p[0]] = p[1];
        }
        step = iterator.next();
      }
      return obj;
    }
    // Fallback: treat as a plain object with enumerable own props
    for (var k in entries) {
      if (Object.prototype.hasOwnProperty.call(entries, k)) {
        obj[k] = entries[k];
      }
    }
    return obj;
  }

  Object.defineProperty(Object, 'fromEntries', {
    value: safeFromEntries,
    writable: true,
    configurable: true,
    enumerable: false,
  });
})();
