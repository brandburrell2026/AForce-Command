---
name: Expo Router app/ routing gotcha + false "crash" reports
description: Why non-route helper files in app/ spam a "missing default export" error, and how the "artifact crashed" reports were proven to be non-crashes.
---

# Expo Router treats every file under `app/` as a route

In `aforce-os`, ANY file under `app/` is registered as a route EXCEPT `_layout`
files and `+`-prefixed special files (`+html`, `+not-found`, `+native-intent`).
An underscore prefix does NOT exclude a file — e.g. `app/(hidden)/cruise/_shared.tsx`
was still picked up as a route and logged, on EVERY boot:
`Route "./(hidden)/cruise/_shared.tsx" is missing the required default export.`

**Rule:** keep shared non-route helpers/components OUT of `app/` (e.g. under
`components/`), and import them via the `@/` alias. Do not colocate non-route
modules inside `app/` expecting an underscore to hide them.

# The recurring "AForce OS artifact crashed with a runtime error" was NOT a crash

Diagnosis playbook that proved it (repeat if it recurs):
- Temporarily added `window.addEventListener('error'|'unhandledrejection')` in
  `app/_layout.tsx` routing into `console.warn` (the Replit log capture only
  records `console.log`/`warn`, NOT `console.error` / uncaught errors). A full
  fresh boot produced ZERO markers → no uncaught JS error / rejection.
- `api-server` showed a live client booting fully and firing post-mount effects
  (`/aforce/state` poll every 30s, `/journal/snapshot` POST, `/weather` GET).
  Those only run inside `AppProvider` after the full mount past Clerk → app healthy.
- **White screenshots are a headless-capture artifact, not a real white screen.**
  `app/+html.tsx` forces `html,body,#root { background-color:#000 }` BEFORE the JS
  bundle evaluates, so a real browser can never show pure white. `ErrorBoundary`
  wraps `AppProvider`, so a caught render error would stop the poll — it didn't.

**Why:** the only real recurring console anomaly was the expo-router
missing-default-export error above; everything else was normal warnings
(`shadow*`/`textShadow*`/`pointerEvents` deprecations, competition-route warning).
The most likely "crash" trigger was either that error-level log or the blank
headless-preview heuristic. Fix the routing gotcha first; do not blind-edit a
healthy app chasing a phantom crash.
