---
name: aforce-os white-screen from stale Metro cache
description: Expo web boots to a blank white screen / "runtime crash" after a multi-file refactor — usually a stale Metro incremental cache, not a code bug.
---

# aforce-os: white screen / crash-before-Clerk after a big refactor

Symptom: app loads to a blank white screen. Browser console stops right after the
`shadow*/textShadow*` deprecation warnings and **never logs "Clerk has been loaded"** —
i.e. it dies during early render/module-eval, *above* the in-app `ErrorBoundary`
(which lives inside `ClerkLoaded` → `AppShell`), so no error fallback shows.

**Root cause (observed):** after a large mid-session refactor where many modules were
created/edited while Metro kept running, the served bundle was a **stale incremental
cache** with an inconsistent module graph. A normal workflow restart did NOT fix it —
the restart log still showed an incremental `Bundled ... (1 module)` rather than a full
rebuild, so it kept serving the broken graph.

**Fix:** clear caches and force a full rebuild, then restart the expo workflow:
`rm -rf artifacts/aforce-os/.expo artifacts/aforce-os/node_modules/.cache /tmp/metro-* /tmp/haste-*`
Healthy after fix: log shows a **full** rebuild (`Bundled ~10s ... 3700+ modules`), and the
console resumes the complete boot sequence (Clerk loaded → `[Layout children]` competition
route warning → `pointerEvents`), with the api-server receiving the post-boot effect calls
(`POST /aforce/journal/snapshot`, `GET /aforce/weather`).

**Why this matters:** don't go code-spelunking for a TDZ/circular-import bug first when the
exact same committed code rendered fine earlier in the session — a stale Metro cache produces
identical "crash before Clerk / white screen" symptoms with zero code changes.

**How to confirm it's a capture artifact vs real:** the Expo RN-web preview often screenshots
as a blank white frame in headless capture even when healthy. Trust the **browser console boot
sequence + api-server post-boot effect calls** over the screenshot image to decide if the app
actually mounted.

## A newly-added `@workspace/*` lib won't resolve in Metro (negative-resolution cache)

Symptom: after adding a brand-new workspace lib and importing it from the Expo app,
Metro errors `Unable to resolve "@workspace/<new-lib>" from ...` — even though the
pnpm symlink under `artifacts/aforce-os/node_modules/@workspace/<new-lib>` is valid,
the lib's `package.json` `exports` mirror an already-working lib (e.g. api-client-react),
`node -e realpathSync(...)` resolves the symlink, and `tsc` typechecks fine (tsc uses
tsconfig paths; Metro uses node resolution).

**Root cause:** Metro caches the *negative* resolution (module-not-found) from before the
symlink existed, and a plain workflow restart reuses that cache. tsc passing masks it
because the two resolvers are independent.

**Fix:** clear the Metro cache, then restart expo — same drill as the white-screen case:
`rm -rf artifacts/aforce-os/node_modules/.cache /tmp/metro-* /tmp/haste-*`. Healthy after
fix: a **full** rebuild log (`Web Bundled ~10s ... 3700+ modules`) with zero
`Unable to resolve` lines. Don't go editing the new lib's package.json / metro.config —
if an existing sibling lib resolves with the identical setup, it's the cache, not config.

**Log-reading trap:** the `/tmp/logs/...expo....log` snapshot files written by the log
tool are point-in-time and reused across restarts — reading them directly with tail/rg can
show **stale** errors. Re-run the refresh-logs tool to get the live state before concluding
a fix didn't work.
