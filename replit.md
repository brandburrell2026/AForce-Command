# Overview

This project develops AForce OS, a production-ready React Native / Expo mobile application and an API server using Express 5 and PostgreSQL. AForce OS is a real-time human performance operating system focused on hydration intelligence and AI-driven decision-making. Its purpose is to provide personalized insights and community engagement for athletic performance and wellness.

Key capabilities include:
- **Hydration Tracking & AI Coaching:** Mobile application features for product scanning, hydration analysis, AI coaching, and product comparisons.
- **Social & Competitive Features:** "Circles" for private accountability networks and "Territory" for live competition mapping.
- **E-commerce & Subscription Management:** Integration with Stripe for cart checkout and subscription management.
- **Scalable Architecture:** Designed to support 50M+ users with considerations for multi-region deployments, sharded databases, and real-time event processing.

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo:** pnpm workspaces
- **Backend:** Node.js (v24), Express 5, PostgreSQL, Drizzle ORM, Zod for validation.
- **Mobile:** React Native / Expo SDK 54, React Context + `useReducer` for state, Expo Router 6 for navigation, React Native Reanimated for animations, `i18next` for internationalization.
- **API Tools:** Orval for OpenAPI codegen.

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette includes lime, teal, amber, red, Clutch teal, and Guardian purple.
- **Design Language:** Focuses on "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND," using a "Phantom-card" aesthetic for action rows.
- **Visuals:** Stylized maps for "Territory" and smooth animations using Reanimated.

## Technical Implementations & Feature Specifications

### Persistence & Real-Time Backend
- User state, intake logs, and answers are persisted in PostgreSQL via Drizzle.
- REST API endpoints (`/api/aforce`) broadcast mutations to WebSocket clients.
- A shared HTTP/WebSocket server (`ws` package) handles real-time communication.
- OpenWeather API is proxied with in-memory caching.
- Server acts as the source of truth for all data, excluding `appleHealth`.

### Per-Event Hydration Scoring
- Defines point values, absorption caps, and release curves for hydration events.
- Uses `SELECT ... FOR UPDATE` for concurrent intake operations.

### Mobile Application (`artifacts/aforce-os`)
- **AForce HydroScan:** Product recognition and comparison.
- **AForce Circles:** Private accountability networks.
- **AForce Territory:** Live competition mapping and scoring.
- **AForce Voice Engine:** Mode-aware coaching with text-to-speech, configurable by the user.
- **Heat Guard Escalation:** Triggers warnings and UI overlays based on performance state.
- **Subscription System (real Stripe at launch):** Manages six plan tiers with feature gating. Paid consumer upgrades (`recovery_plus`, `athlete`, `system`, `elite`) route through real Stripe Checkout via `POST /api/checkout/session` + server-verified `GET /api/checkout/session/:id` before reflecting the plan; on success the screen calls `refreshEntitlement()` so `/api/entitlement` (set by the Stripe webhook) is the source of truth, not optimistic local state. `ManageSubscriptionScreen` exposes a single "MANAGE BILLING" button that opens the Stripe Customer Portal via `POST /api/stripe/portal-session` (handles cancel / pause / resume / payment-method update / invoice download in Stripe's hosted UI), then refetches entitlement on return; `no_stripe_customer` (404) is surfaced as "No billing account yet — choose a plan to set up billing first." Non-Stripe plans (Core entry tier, Team, Performance Systems) are sales-led at launch and show a "Talk to our team" alert with the sales email instead of mock-switching state. `services/subscriptionService.ts` has been stripped to a `defaultSubscription()` cold-start seed only — every previous mock CRUD function (`switchPlan/cancel/pause/resume/skipNextDelivery`) was removed because it would write fake state that the real entitlement poll would have to overwrite.
- **Product Comparison Engine:** Real-time, brand-neutral product ranking.
- **Core Loop:** Score evaluation, AI commands, intake logging, and engine refresh.
- **Social Mode:** BAC estimator, impairment assessment, and recovery protocols.
- **Hydration Journal:** Longitudinal score history, daily timeline, and PDF export.
- **Sweat Calculator:** ACSM-grade sweat-rate calculation with multiple input modes.
- **Phantom Band Integration (gated for launch):** BLE service for automatic sip logging from a hardware device. Hidden behind the `phantom_wearable_enabled` feature flag (default off) so the v1 launch ships without it; the route guards (`app/phantom.tsx`) `<Redirect>` to `/` when the flag is off, and `components/home/SignalsZone.tsx` only renders the Phantom signal/card when `useFlagsSlice().showHardwareSignals` is true. Toggleable from the profile FlagRow for demos.
- **AForce Ring Integration (gated for launch):** Wearable ring companion with two surfaces — **Calm Coach** (`/ring`) idle home and **Sport Mode** (`/ring/session`) auto-triggered live HUD with sport pill, chronometer, 4-tile biometric grid, live deficit card, and "next sip" countdown. Backed by a singleton 1Hz mock biometric stream (`services/ringService.ts` + `useRingStream()` hook). Hidden behind the same `phantom_wearable_enabled` feature flag for v1 launch — `app/ring.tsx`, `app/ring/session.tsx` redirect to `/` when off, and the `RingStatusCard` on the home signals zone is conditionally rendered.
- **Sensor Import:** Parses external sensor data (hDrop, Nix, Gatorade Gx) and integrates it into logs and snapshots.
- **Achievements:** Catalog of 12 badges unlocked based on user activity, stored in an append-only table.
- **Science & Methodology:** In-app documentation of all formulas, calculations, and references, with PDF export.
- **Cruise Mode:** Premium **guest-only** add-on for hydration intelligence at sea. Crew / staff get personalized hydration support through Social Mode rather than Cruise Mode — only guest demo profiles (Pool-day, Excursion) appear in the on-screen profile picker, and both the Crew Performance Mode section and the operator-facing Fleet Dashboard (per-ship department compliance across Royal Caribbean / Carnival / Virgin / Disney) have been removed so Cruise Mode is purely a guest experience. Ship Environment pulls live conditions from OpenWeather via `GET /api/cruise/environment?port=<id>` (api-server route `routes/cruise.ts`, 10-min in-memory cache, deterministic Caribbean fallback when upstream is unavailable).

### Investor Pitch Deck (`artifacts/aforce-pitch`)
- A 27-slide React presentation (`/aforce-pitch/slide{1..27}`) outlining the project's vision, problem statement, solution (AForce OS), go-to-market strategy, and recurring revenue model.
- Focuses on AForce product line (hydration flavors) and the OS app.
- Includes key business metrics and funding ask.
- **Performance Positioning Brief alignment (Apr 30 2026, prepared by Kristel van Kleef & Peter Ingwersen):** Slides 2–5 are the narrative spine and now match the brief verbatim where the brief is precise. Slide 2 (Founder Proof) carries the NBA / Wall Street / Entrepreneurship trio — "no off nights · no missed moments · no second chances" — and closes on "consistency, not perfection." Slide 3 (Mission) anchors the Brand Truth tile to the exact line: *"Performance is non-negotiable. Not your best ever. Not your best in perfect conditions. Your best, reliably, consistently, every single day."* Slide 4 (Problem / The Disruption) keeps the Red Bull "loud by design" framing and surfaces the verbatim AForce counter: *"It removes noise. It removes friction. It creates clarity. It prepares you for performance."* Slide 5 (Insight / The New Territory) carries the cadence *"Not one big moment. Not occasional peaks. Every day. Every moment. Every decision."*

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** Outlines target topology for 50M+ users, including multi-region deployments, sharded databases, Redis, Kafka, and AI provider failover.
- **Stripe Integration:** Handles one-time checkouts and subscription flows with server-side pricing, shipping, tax, and validation.
- **Auth-gated routes:** All mutating `/api/aforce/*` routes require authentication via `@clerk/express`, with a fallback to `DEFAULT_USER_ID` in non-production environments.
- **Social graph routes (graduated May 1 2026):** Three formerly in-memory mock services on the Expo client (`battleService`, `circleService`, `privacyService`) are now backed by real Drizzle-persisted endpoints, all per-user via `requireAuth`:
  - `GET/POST /api/battles`, `POST /api/battles/:id/support` — territory rivalries (table `aforce_battles`).
  - `GET /api/circle[?group=]`, `GET /api/circle/pending`, `GET /api/circle/feed[?group=]`, `POST /api/circle/users/:memberUserId/{status,group}`, `DELETE /api/circle/users/:memberUserId`, `GET /api/circle/challenges`, `POST /api/circle/challenges/:id/accept`, `GET /api/circle/notifications`, `POST /api/circle/notifications/:id/read` — circle membership, statuses, challenges, notifications (tables `aforce_circle_users`, `aforce_circle_statuses`, `aforce_circle_challenges`, `aforce_circle_notifications`).
  - `GET /api/privacy`, `PUT /api/privacy/scope`, `PUT /api/privacy/field` — share scope + per-field toggles (table `aforce_privacy`).
  - First GET per user auto-seeds the demo set (mirroring the previous mock fixtures) so the UI has data immediately. Client services keep their original synchronous read surface + `useSyncExternalStore` subscribe pattern by hydrating an in-memory cache from the seed and reconciling with the server on first read; mutations are optimistic with background reconcile.

### Store + Subscription System
- Defines SKU pricing, subscription discounts, and bundle offerings.
- `productPricingService.ts` centralizes pricing logic.
- Implements five consumer subscription tiers (`core`, `recovery_plus`, `athlete`, `system`, `elite`).
- Paywalls restrict access to premium features for non-subscribers.
- `StoreScreen` provides a UI for product selection and subscription management.

## Architecture Diagram (AForce OS)
- **`app/`**: Root layouts, screens, tab bar, gated routes.
- **`components/`**: Reusable UI elements.
- **`services/`**: Business logic (product recognition, hydration scanning, subscriptions).
- **`store/`**: Application state management.
- **`utils/`**: Utility functions (e.g., `scoringEngine.ts`).
- **`featureFlags/`**: Feature toggles.
- **`theme/`**: Brand colors.
- **`types/`**: Global type definitions.
- **`data/`**: Mock data, product definitions, voice/sharing templates.

# External Dependencies

- **Stripe:** Payment processing.
- **Expo SDK:** React Native development framework.
- **Expo WebBrowser:** For opening web links (e.g., Stripe Checkout).
- **Expo Speech:** Text-to-speech functionality.
- **@expo-google-fonts/inter:** Custom font.
- **React Native Reanimated:** Declarative animations.
- **React Native Gesture Handler:** Gesture recognition.
- **PostgreSQL:** Primary database.
- **Orval:** OpenAPI codegen.
- **Zod:** Schema validation.
- **pnpm workspaces:** Monorepo management.
- **esbuild:** Bundling.
- **Stripe-replit-sync:** Mirrors Stripe webhook events to PostgreSQL.