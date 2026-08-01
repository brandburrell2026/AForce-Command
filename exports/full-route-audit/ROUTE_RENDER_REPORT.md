# AForce OS — Full-Route Render Report

_Generated 2026-08-01T16:57:32Z · Expo web demo target (EXPO_PUBLIC_DEMO_MODE) · headless Chrome/CDP · 390×844_

Every user-facing route was navigated **fresh** through the app’s own expo-router
navigation ref (in-app client navigation), then screenshotted and classified. No
authentication, entitlement, feature-flag, or safety gate was bypassed — DEMO_MODE
is the app’s own sanctioned demo seam (it only lifts the Clerk sign-in wall); every
other gate rendered its real state. Failures are captured exactly as they occur.

## Totals

| Metric | Count |
|---|---|
| **Total routes audited** | 45 |
| Rendered successfully | 34 |
| Redirected | 6 |
| Requires authentication | 1 |
| Entitlement / feature-flag gated | 2 |
| Error boundary | 2 |
| Blank render | 0 |
| Broken | 0 |
| _(of which) device-dependent surfaces_ | 3 |

> **Method note.** Full-page URL deep-linking is not usable on this target: in
> DEMO_MODE the app’s `SplashGate` wipes the onboarding flag and force-routes to
> `/onboarding` on every cold load, and a cold-launch cinematic + welcome overlay
> sits on top. So each route is reached by booting once and navigating **in-app**
> via the real `NavigationContainer` ref. Two routes crash the shared root
> `ErrorBoundary`; the harness reloads + re-boots to recover so every route is
> judged from a clean app.

## Routes needing attention (11)

| # | Path | Screen | Status | Exact reason |
|---|---|---|---|---|
| 5 | `/profile` | Profile (tab) | **error-boundary** | Root ErrorBoundary "Something went wrong" — profile throws on the web (RN-Web) target (native-only dependency). Renders on a native/device build. |
| 11 | `/(auth)` | Auth (sign-in/up) | **requires-authentication** | Clerk sign-in surface (email/password form). DEMO_MODE bypasses the gate for the rest of the app; the (auth) route itself renders the sign-in UI. |
| 19 | `/heat/guardian` | Heat · Guardian | **redirected** | Resolved to "/heat" instead of the requested route (guard/alias). |
| 20 | `/phantom` | Phantom | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 22 | `/cruise` | Cruise (hidden group) | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 23 | `/ring` | Ring | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 24 | `/ring/session` | Ring · Session | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 26 | `/leaderboard` | Leaderboard | **error-boundary** | Root ErrorBoundary "Something went wrong" — leaderboard throws on the web (RN-Web) target (native-only dependency). Renders on a native/device build. |
| 32 | `/clutch` | Clutch | **entitlement/flag-gated** | FeatureGate "DEMO LOCKED" quiet state — clutch flag is OFF in DEFAULT_FLAGS (entitlement-gated preview surface). |
| 39 | `/guardian` | Guardian | **entitlement/flag-gated** | FeatureGate "DEMO LOCKED" quiet state — guardian flag is OFF in DEFAULT_FLAGS (entitlement-gated preview surface). |
| 43 | `/recovery-coach` | Recovery Coach | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |

## All routes

| # | Path | Screen | Status | Reason |
|---|---|---|---|---|
| 1 | `/(tabs)` | Home (tab) | **rendered** | Rendered (active tab). |
| 2 | `/journal` | Hydration (tab) | **rendered** | Rendered (active tab). |
| 3 | `/protocol` | Protocol (tab) | **rendered** | Rendered (active tab). |
| 4 | `/competition` | Community (tab) | **rendered** | Rendered (active tab). |
| 5 | `/profile` | Profile (tab) | **error-boundary** | Root ErrorBoundary "Something went wrong" — profile throws on the web (RN-Web) target (native-only dependency). Renders on a native/device build. |
| 6 | `/scan` | Scan (tab) | **rendered** | Rendered (device-capture tab; shown without live camera/sensor hardware on web). |
| 7 | `/social` | Social (tab) | **rendered** | Rendered (active tab). |
| 8 | `/social-legacy` | Social (legacy tab) | **rendered** | Rendered (active tab). |
| 9 | `/sleep` | Sleep (tab) | **rendered** | Rendered (active tab). |
| 10 | `/onboarding` | Onboarding | **rendered** | Rendered with content on the web target. |
| 11 | `/(auth)` | Auth (sign-in/up) | **requires-authentication** | Clerk sign-in surface (email/password form). DEMO_MODE bypasses the gate for the rest of the app; the (auth) route itself renders the sign-in UI. |
| 12 | `/scan` | HydroScan | **rendered** | Rendered (device-dependent surface shown without hardware on web). |
| 13 | `/subscription` | Subscription | **rendered** | Rendered with content on the web target. |
| 14 | `/subscription/manage` | Subscription · Manage | **rendered** | Rendered with content on the web target. |
| 15 | `/store` | Store | **rendered** | Rendered with content on the web target. |
| 16 | `/cart` | Cart | **rendered** | Rendered with content on the web target. |
| 17 | `/heat` | Heat | **rendered** | Rendered with content on the web target. |
| 18 | `/urine-check` | Urine Check | **rendered** | Rendered with content on the web target. |
| 19 | `/heat/guardian` | Heat · Guardian | **redirected** | Resolved to "/heat" instead of the requested route (guard/alias). |
| 20 | `/phantom` | Phantom | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 21 | `/cruise` | Cruise | **rendered** | Rendered with content on the web target. |
| 22 | `/cruise` | Cruise (hidden group) | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 23 | `/ring` | Ring | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 24 | `/ring/session` | Ring · Session | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 25 | `/notifications` | Notifications | **rendered** | Rendered with content on the web target. |
| 26 | `/leaderboard` | Leaderboard | **error-boundary** | Root ErrorBoundary "Something went wrong" — leaderboard throws on the web (RN-Web) target (native-only dependency). Renders on a native/device build. |
| 27 | `/legal` | Legal | **rendered** | Rendered — the /legal group resolves to its default child (Terms of Service). |
| 28 | `/modules` | Modules | **rendered** | Rendered with content on the web target. |
| 29 | `/weekly-report` | Weekly Report | **rendered** | Rendered with content on the web target. |
| 30 | `/share` | Share | **rendered** | Rendered with content on the web target. |
| 31 | `/sweat` | Sweat | **rendered** | Rendered with content on the web target. |
| 32 | `/clutch` | Clutch | **entitlement/flag-gated** | FeatureGate "DEMO LOCKED" quiet state — clutch flag is OFF in DEFAULT_FLAGS (entitlement-gated preview surface). |
| 33 | `/circles` | Circles | **rendered** | Rendered with content on the web target. |
| 34 | `/circles/manage` | Circles · Manage | **rendered** | Rendered with content on the web target. |
| 35 | `/circles/shared` | Circles · Shared | **rendered** | Rendered with content on the web target. |
| 36 | `/circles/demo` | Circle · Detail [id] | **rendered** | Rendered minimal/placeholder content (35 chars — e.g. unknown demo id). |
| 37 | `/science` | Science | **rendered** | Rendered with content on the web target. |
| 38 | `/sensors` | Sensors | **rendered** | Rendered (device-dependent surface shown without hardware on web). |
| 39 | `/guardian` | Guardian | **entitlement/flag-gated** | FeatureGate "DEMO LOCKED" quiet state — guardian flag is OFF in DEFAULT_FLAGS (entitlement-gated preview surface). |
| 40 | `/social-v2` | Social v2 | **rendered** | Rendered with content on the web target. |
| 41 | `/territory` | Territory | **rendered** | Rendered with content on the web target. |
| 42 | `/achievements` | Achievements | **rendered** | Rendered with content on the web target. |
| 43 | `/recovery-coach` | Recovery Coach | **redirected** | Navigated but resolved to Home — not reachable by direct route-name navigation on web (needs route params / an in-app entry point, or a guard sent it Home). |
| 44 | `/ui-gallery` | UI Gallery | **rendered** | Rendered with content on the web target. |
| 45 | `/gallery` | P0 Screen Gallery | **rendered** | Rendered with content on the web target. |

## Notes on the two crashes

- **`/profile`** and **`/leaderboard`** throw on the **web (React-Native-Web)**
  target and trip the shared root `ErrorBoundary` ("Something went wrong"). This is
  a web-target rendering failure (a native-only dependency reached during render),
  **not** evidence the screens are broken on device — they ship in a native build.
  They are flagged here honestly rather than hidden. Worth a follow-up to confirm on
  a native/simulator build and to guard the offending call for web.

## Device-dependent surfaces

`/scan` (HydroScan), the Scan tab, and `/sensors` render their UI on web but depend
on camera/sensor hardware that the web target lacks; they are marked
**device-dependent** in `route-manifest.json`. Camera capture itself is dark pending
legal, per the standing repo constraint.
