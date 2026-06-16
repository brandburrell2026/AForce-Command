# Overview

AForce OS is a real-time human performance operating system, delivered as a React Native / Expo mobile application with an Express 5 and PostgreSQL API server. Its core purpose is to provide hydration intelligence and AI-driven insights to enhance athletic performance and overall wellness. Key features include personalized hydration tracking, AI coaching, social engagement through "Circles" and "Territory" features, and integrated e-commerce capabilities via Stripe for purchases and subscriptions. The system is designed for horizontal scaling.

# FINAL BUILD LOCK (locked; do not redesign)

Approved for implementation. No redesign, no rebuilding, no moving navigation, no adding tabs, no dashboard expansion. Build once. Expose over time.

## AUTHORIZED OVERRIDE — Home + Navigation redesign (owner-approved)

The owner explicitly authorized a full redesign of the **Home screen and tab navigation**, overriding the "do not redesign / do not move navigation / no dashboard expansion" clauses above *for these two surfaces only*. The rest of the lock (Water-First, Score Protection, Language lock, Product Positioning) remains in force and the redesign was built to comply with it.

- **Accent:** added `accent.brand` `#FF3B30` (+ `brandGlow` / `brandDim` / `brandSubtle`) used sparsely (thin lines, eyebrows, progress fills). `tabBar.active` flipped to brand red. `accent.primary` and all WHOOP recovery/state colors are untouched, so DEPLETED red still reads.
- **Navigation 7 → 5 visible tabs:** Home · Hydration (was Journal, relabeled + droplet icon) · Protocols · Community · Profile. `scan` / `social` / `social-legacy` / `sleep` are hidden (`href:null` in ClassicTabLayout, omitted from NativeTabLayout triggers) — engines stay, surfaces hidden, consistent with "Build 100% · Show 10%".
- **Home expansion:** the score orb is retained as the **Readiness Score** hero (thin `READINESS SCORE` eyebrow; engine machinery unchanged). Below it, the Hydration Status card now occupies the **Water Cycle** slot. (Owner trim, June 2026: the Daily Ritual rail, Today's Protocol, Streak, Athlete Mode progress, and Membership cards were removed from the Home surface. A later owner change, June 2026: the WATER CYCLE 8-cell telemetry bar was removed from Home and the Hydration Status card was moved into its place. All removed components — the five cards, the `WaterCycleBar` (still imported by the dormant `SignalsZone`), and the `utils/homeDashboard` derivations — remain in the codebase, simply no longer rendered on Home, so the trim is reversible.)
- **Score-Protection preserved:** every Home surface is a read-only projection of already-completed behaviour via the pure `utils/homeDashboard.ts` helpers (unit-tested); nothing awards or inflates score. (Owner trim, June 2026: the Ritual/protocol rails and the "SOON" Points/Challenges/Referrals preview tiles were removed from the Home surface along with the cards noted above. The retained Hydration Status ring stays a read-only projection of logged intake; the trimmed derivations remain in the codebase so the trim is reversible.)

## Cold-Launch Opening Sequence (owner-approved)

A full-screen 4-stage cinematic (`components/opening/OpeningSequence.tsx`) plays once **per cold launch** as an overlay — mounted in `app/_layout.tsx` (AppShell), mirroring the InvestorDemo overlay pattern, so it touches **no routing** (no redirect-loop risk) and then fades out to reveal whatever the app routed to underneath.

- **Stages:** (1) white water-drop symbol w/ breathing fade → (2) AFORCE wordmark + brand-red hairline + "Performance Is Non-Negotiable" → (3) PAUSE/HYDRATE/LOCK IN/PERFORM ritual stagger → (4) "TODAY'S READINESS" + count-up to the live score + a **band-aware** caption via `readinessLabel(performanceState.level)` (a DEPLETED user reads "REHYDRATE NOW", never "READY TO PERFORM").
- **Motion:** slow Apple-Vision-Pro pacing, crossfading absolute-fill layers, no bounce. Tap-anywhere-to-skip; fully reduced-motion aware (`AccessibilityInfo`).
- **Score-Protection:** display-only projection of `engine.score` (DEFAULT_SCORE=92 fallback before state loads); never awards, mutates, or fabricates score.
- **First-run untouched:** onboarding stays intact — new users get opening → onboarding. (The separate welcome lobby was removed; the cold-launch cinematic is now solely the OpeningSequence overlay.)
- **Plays per JS launch:** `OpeningMount` holds `useState(true)` initialised once when AppShell mounts; `onFinish` is a stable `useCallback` and `OpeningSequence` keeps it in a ref so the engine-score refresh (on mount + ~30s) never tears down the timeline mid-play.

## Water-First Command System
Recommendation order is **Water → Command → Optional support → Score Update**. Products never come before water. Default recommendation copy must begin with `HYDRATE NOW` / `Start with water`; optional hydration support may be suggested only after hydration needs are evaluated. Behavior first, product second.

## Score Protection Rule
Only completed actions modify score. Recommendations, scans (HydroScan stays advisory), and product selection never increase score. Scores only change from completed behavior.

## Language / Localization Lock
Launch languages: English, Spanish, French, German, Portuguese, Italian. No country-specific prioritization. Architecture stays modular so future languages can be added without rebuild. Hidden locales remain resource-only behind flags; they are not in the LanguageSelector.

## Engine / UI Governance
Architecture may expand. Navigation may not. The engine becomes smarter; screens remain simpler. Feature flags control exposure. Internal preview stays available. Public unlocks ship phase-by-phase.

## Product Positioning Rule
Decision order: Context → Recovery → Behavior → Learning → Optional support. Products support behavior; products do not drive behavior. Never force product recommendations.

## MVP Surfaces (do not remove)
Orb · Timeline · HydroScan · Coach · Journal · Recovery · Feature Flags · Internal Preview. Principle: Build 100% · Show 10% · Unlock over time. One Engine. Multiple Experiences.

Mantra: **Pause → Hydrate → Lock In → Perform**.

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo:** pnpm workspaces.
- **Backend:** Node.js (v24), Express 5, PostgreSQL, Drizzle ORM, Zod.
- **Mobile:** React Native / Expo SDK 54 with Expo Router 6, React Native Reanimated 3, `i18next`, `@tanstack/react-query`.
- **State Management (mobile):** React Context + `useReducer` (slice-based store).
- **API Tools:** Orval for OpenAPI codegen, generating React Query hooks.

## UI/UX Decisions
- **Color Scheme:** WHOOP-Cinematic edition — pure black `#000000` canvas, WHOOP lime `#B6FF00` hero accent, near-invisible borders, WHOOP recovery colors (green/yellow/red). Design tokens exported via `design/aforce-tokens.json` (Tokens Studio format) and human-readable `design/aforce-design-tokens.md`.
- **Design Language:** WHOOP-cinematic dark aesthetic. Content floats on pure black. Data-forward: big numbers, small tracked labels. Soft radial glows, never hard box shadows. Generous spacing throughout.
- **Visuals:** Stylized maps for "Territory" and smooth animations with Reanimated.

## Authentication & Identity
- **Provider:** Clerk (`@clerk/expo` for mobile, `@clerk/express` for server).
- **Sign-in:** Custom email/password and Google SSO.
- **Integration:** Token bridging between Clerk and the OpenAPI client.
- **Auth-gated routes:** Implemented on both mobile and server-side.

## Subscription & Entitlement
- **Source of Truth:** Stripe, with webhook events mirrored to PostgreSQL via `stripe-replit-sync`.
- **Client-side:** `useEntitlement.ts` hook for paywall gating based on plan tier.
- **Security:** Server-side computation for pricing, shipping, and tax; webhook signature verification.

## Publishing & Distribution
- **Build service:** Expo Application Services (EAS Build) — configured in `artifacts/aforce-os/eas.json` with `development`, `preview`, and `production` profiles.
- **Bundle IDs:** iOS `com.aforce.os`, Android `com.aforce.os` (set in `app.json`).
- **App icon / splash / adaptive icon:** branded set in `assets/images/` (`icon.png`, `splash.png`, `adaptive-icon.png`, `favicon.png`). `icon.png` / `adaptive-icon.png` / `favicon.png` use a metallic silver water-drop mark on a pure black background; `splash.png` remains the WHOOP-cinematic splash.
- **Build commands** (run from `artifacts/aforce-os/` after `pnpm eas:login` + `pnpm eas:configure`):
  - iOS production: `pnpm eas:build:ios`
  - Android production: `pnpm eas:build:android`
  - Both: `pnpm eas:build:all`
  - Internal preview (no store submission): `pnpm eas:build:preview`
- **Submit commands:**
  - iOS App Store: `pnpm eas:submit:ios`
  - Google Play (internal track): `pnpm eas:submit:android`
- **One-time setup needed before first submit:**
  - **iOS** — instead of hand-editing `eas.json`, run the helper from repo root:
    ```
    EAS_ASC_APP_ID=1234567890 \
    EAS_APPLE_TEAM_ID=ABCDE12345 \
    pnpm --filter @workspace/scripts run eas-configure-submit
    ```
    The script validates formats (ASC ID = numeric, Team ID = 10 uppercase alphanumeric), is idempotent, and refuses placeholders. Find your two IDs at: App Store Connect → My Apps → AForce OS → App Information (ASC App ID) and developer.apple.com → Membership (Team ID).
  - **Android** — place a Google Play service account JSON at `artifacts/aforce-os/google-service-account.json` (path already in `eas.json`); never commit it.

## Release-Readiness Status (verified)
- **Stripe webhook** — wired end-to-end via the Replit Stripe connector. The webhook secret is pulled from `settings.webhook_secret` on the connector (NOT from a `STRIPE_WEBHOOK_SECRET` env var). Verified by server boot log: `initStripe: managed webhook ensured` + `initStripe: syncBackfill complete`. No env var to set.
- **EAS config** — `eas.json` profiles (development/preview/production) and submit blocks are complete; only the two iOS submit IDs need filling via the helper script above. Bundle IDs (`com.aforce.os`), permissions, splash, and icon are all set in `app.json`.
- **App Store / Play Store screenshots** — Apple and Google only accept screenshots captured from a real device or simulator running a built binary. Replit's web preview of the Expo app cannot produce submission-grade assets. Capture path:
  1. `pnpm --filter @workspace/aforce-os run eas:build:dev` to produce an iOS Simulator build.
  2. Boot the build in Xcode Simulator on the required device families (6.7" iPhone, 6.5" iPhone, 13" iPad).
  3. Capture with `xcrun simctl io booted screenshot <name>.png`.
  4. For Android, run `eas:build:preview` to get an APK, install on a Pixel emulator, capture via Android Studio.

## Server Hardening
- **Routing:** Express 5 with Zod input/output validation based on OpenAPI spec.
- **Concurrency:** `SELECT ... FOR UPDATE` for serializing concurrent user actions.
- **Rate Limiting & Cache:** OpenWeather API proxied with in-memory TTL cache; rate limits on public and authenticated endpoints.
- **Logging:** Structured logging for request handlers and non-request code.
- **Real-time:** REST mutations are broadcast over a shared HTTP/WebSocket server.

## Technical Implementations & Feature Specifications
- **Persistence & Real-Time Backend:** PostgreSQL via Drizzle ORM; REST API broadcasts mutations to WebSocket clients.
- **Per-Event Hydration Scoring:** Defined point values, absorption caps, and release curves.
- **AForce Protocol Screen:** Synchronous derivation of protocol stage based on user state.
- **Water Cycle / "Become AForce":** Modals for tracking water and hydration stick intake, with flavor inference.
- **Social Mode:** Alcohol intake impacts hydration scores and decay rates.
- **Multi-Provider Health Signals:** Integration with various health platforms (e.g., Apple Health, Oura) using a "freshest-wins" logic.
- **Hydration Depletion Math:** Pure, dependency-free helper for score-points-per-minute decay based on physiological standards.
- **AI Coach Voice Engine:** Utilizes ElevenLabs for voice output, providing verdict-aware comparisons after HydroScans and guiding users through performance events. Features include status color systems, video overlay voices, and a "Cinematic v2" refinement with a playback lifecycle state machine.
- **Investor Demo:** A scripted 60-second full-screen overlay showcasing the Voice Engine's states and capabilities for investors.
- **API Server:** Designed for horizontal scaling, includes Stripe integration, auth-gated routes, and social graph routes.
- **Store + Subscription System:** Defines SKU pricing, discounts, bundles, and five consumer subscription tiers with feature gating.

## Architecture Diagram
- **`app/`**: Root layouts, screens, tab bar, gated routes.
- **`components/`**: Reusable UI elements.
- **`services/`**: Business logic.
- **`store/`**: Slice-based reducer state.
- **`utils/`**: Pure helpers.
- **`featureFlags/`**: Feature toggles.
- **`theme/`**: WHOOP-Cinematic color system, typography, spacing, radii, shadows, status color engine.
- **`design/`**: Figma design tokens (`aforce-tokens.json`) and human-readable spec (`aforce-design-tokens.md`). Download endpoint: `GET /api/design-tokens`. Design guide: `GET /api/design-guide`.
- **`types/`**: Global type definitions.
- **`data/`**: Mock data, product definitions, templates.

# External Dependencies

- **Stripe:** Payment processing, subscriptions.
- **stripe-replit-sync:** Stripe webhook mirroring to PostgreSQL.
- **Clerk:** Authentication service.
- **Expo SDK 54:** React Native development framework.
- **Expo WebBrowser / AuthSession:** OAuth, in-app browser.
- **Expo Speech:** Text-to-speech fallback.
- **@expo-google-fonts/inter:** Custom font.
- **React Native Reanimated:** Declarative animations.
- **React Native Gesture Handler:** Gesture recognition.
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Schema and query layer.
- **Orval:** OpenAPI codegen.
- **Zod:** Schema validation.
- **pnpm workspaces:** Monorepo management.
- **esbuild:** Bundling.
- **OpenWeather API:** Environmental data.
- **ElevenLabs:** Text-to-speech service.
- **i18next:** Localization.