---
name: Fast Refresh "Invalid hook call" false alarm
description: Why an "Invalid hook call" error appears in the Expo web console after editing hooks, and why it's usually not a real bug.
---

When you add or remove a React hook (e.g. a `useMemo`/`useState`/`useEffect`) in
an Expo / React Native Web component and Metro **Fast Refresh** hot-reloads the
change, the browser console can throw:

`Invalid hook call. Hooks can only be called inside of the body of a function
component...` — and React's error boundary often attributes it to a *child*
component (e.g. `The above error occurred in the <ScoreDrivenBody> component`),
not the component you actually edited.

**Why:** changing a component's hook count/order breaks Fast Refresh's ability to
reconcile the previous render's hook state with the new one. It throws on the
next incremental render. It is a hot-reload reconciliation artifact, **not** a
Rules-of-Hooks violation in your code.

**How to apply:** before chasing it as a real bug, do a full workflow restart
(`restart_workflow "artifacts/aforce-os: expo"`) for a clean bundle, then
re-check the browser console. If typecheck passes and the error disappears after
a clean restart, it was the Fast Refresh artifact. Only debug a genuine hooks
violation if it survives a clean restart. Related: stale-Metro-cache white-screen
gotcha (aforce-metro-stale-cache.md).
