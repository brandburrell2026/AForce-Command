# Screen-audit capture tooling

Reproducible harness that generated `exports/p0-gallery/` and
`exports/full-route-audit/`. It is **read-only** with respect to the app: it drives
a headless Google Chrome over the DevTools Protocol against the running Expo **web
demo** server and screenshots real screens. It never edits app code and never
bypasses auth / entitlement / feature-flag / safety gates — `EXPO_PUBLIC_DEMO_MODE`
is the app's own sanctioned demo seam (it only lifts the Clerk sign-in wall); every
other gate renders its real state.

## How it works

1. `cdp.mjs` — minimal CDP client (launch Chrome, connect, `evaluate`, screenshot).
2. `boot.mjs` — boots the app past the cold-launch cinematic → welcome → onboarding
   overlays, then walks the React fiber tree to grab the app's own
   `NavigationContainer` ref (`window.__afRootRef` / `window.__afGo`). This is the
   only reliable way to reach routes: in DEMO_MODE `SplashGate` force-routes every
   cold load to `/onboarding`, so full-page URL deep-linking can't land on a target.
3. `phaseA.mjs` — opens the dev/demo-only `/gallery` route and captures the 13
   deterministic P0 states at the Standard 390×844 viewport.
4. `phaseB.mjs` — navigates every user-facing route fresh, screenshots + classifies
   (recovering with a reload+reboot whenever a route trips the root ErrorBoundary).
5. `finalizeA.mjs` / `finalizeB.mjs` — build the manifests, `index.html`, and
   `contact-sheet.png` (via `sharp`).

## Run

```sh
# 1. start the web demo server (see .claude/launch.json → aforce-os-web-demo):
#    cd artifacts/aforce-os && EXPO_PUBLIC_DEMO_MODE=true CI=1 \
#      node node_modules/expo/bin/cli start --web --port 8090
# 2. then, from the repo root:
node exports/_audit-tooling/phaseA.mjs && node exports/_audit-tooling/finalizeA.mjs
node exports/_audit-tooling/phaseB.mjs && node exports/_audit-tooling/finalizeB.mjs
```

Requires Google Chrome, Node with a global `WebSocket`, and the repo's `ws` + `sharp`.
Paths are absolute to this repo checkout. Captured on the web target — device-only
surfaces (camera/sensors) and the two web-only crashes (`/profile`, `/leaderboard`)
are recorded honestly, not hidden.
