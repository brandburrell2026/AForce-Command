# Overview

This project is a pnpm workspace monorepo using TypeScript, dedicated to developing AForce OS, a production-ready React Native / Expo mobile application, and an API server with Express 5 and PostgreSQL. AForce OS is a real-time human performance operating system focused on hydration intelligence and AI-driven decision-making.

Key capabilities include:
- **Hydration Tracking & AI Coaching:** Mobile application for product scanning, hydration analysis, AI coaching, and product comparisons.
- **Social & Competitive Features:** "Circles" for private accountability networks and "Territory" for live competition mapping.
- **E-commerce & Subscription Management:** Integration with Stripe for cart checkout and subscription management.
- **Scalable Architecture:** Designed to support 50M+ users, considering multi-region deployments, sharded databases, and real-time event processing.

The project's vision is to deliver a comprehensive platform for athletic performance and wellness, leveraging advanced technology for personalized insights and community engagement.

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **TypeScript:** v5.9
- **Mobile App:** React Native / Expo SDK 54
- **API Framework:** Express 5
- **Database:** PostgreSQL + Drizzle ORM
- **Validation:** Zod
- **API Codegen:** Orval (from OpenAPI spec)
- **State Management (Mobile):** React Context + `useReducer` with `useSyncExternalStore`
- **Navigation (Mobile):** Expo Router 6 (file-based navigation)
- **Animations (Mobile):** React Native Reanimated, React Native Gesture Handler
- **i18n (Mobile):** `i18next` + `react-i18next` + `expo-localization` (six MVP locales).

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette uses lime, teal, amber, and red for performance states, with Clutch teal and Guardian purple for specific features.
- **Design Language:** Emphasizes "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND."
- **Action Row:** Icon-only square tiles with a "Phantom-card" aesthetic.
- **Stylized Maps:** TerritoryMap renders aggregated locations while maintaining privacy.
- **Animations:** Uses Reanimated for smooth score count-ups and dynamic Pulse animations.

## Technical Implementations & Feature Specifications

### Persistence & Real-Time Backend
- **Postgres-backed user state:** Persists `userState`, intake logs, and confirmation answers via Drizzle.
- **REST API:** Endpoints under `/api/aforce`. All mutations broadcast to WebSocket clients.
- **WebSocket hub:** `ws` package sharing the HTTP server with Express, with heartbeat and exponential backoff.
- **Server-side OpenWeather:** Proxies OpenWeather with a 10-minute in-memory cache.
- **Client overlay model:** Server is the source of truth for all data except `appleHealth`.

### Per-Event Hydration Scoring
- **Spec:** Defines point values for water and AForce flavors, absorption caps, and release curves.
- **Implementation:** Pure logic in `hydrationScoreService.ts` to compute event impact. Intake events stored in JSONB.
- **Concurrency:** Uses `SELECT ... FOR UPDATE` row locks for concurrent intake operations.

### Mobile Application (`artifacts/aforce-os`)
- **AForce HydroScan:** Premium scan-to-decide UX for product recognition and comparison.
- **AForce Circles:** Premium private accountability network.
- **AForce Territory:** Live competition map with regions and stats, including a scoring engine.
- **AForce Voice Engine:** Mode-aware coach voice with templates; voice output is disabled by default.
- **Heat Guard Escalation:** Triggers warnings, haptics, and UI overlays on performance state changes.
- **Social Sharing:** Premium, non-feed sharing using voice-correct templates.
- **Subscription System:** Manages 6 plan tiers with feature inheritance and gating.
- **Product Comparison Engine:** Real-time, brand-neutral product ranking.
- **AI Coaching Videos:** Cinematic Reanimated video player.
- **Community Competition:** Applies a formula to individuals, cities, states, and teams.
- **Core Loop:** Score -> Why This Score -> AI Command -> Quick Intake -> Cycle Success -> Engine refresh.
- **Social Mode (alcohol mitigation):** Features BAC estimator, impairment assessment, safety guidance, and Recovery Mode with pre-sleep protocol and morning estimates.
- **Hydration Journal (`/journal` tab):** Longitudinal score history with chart, daily timeline, and PDF export. Snapshots are written client-side and retrieved via server endpoints.
- **Sweat Calculator (`/sweat`) — Sweat Intelligence v2:** ACSM-grade sweat-rate calculator with three input modes (Quick / Precision / Estimate). Outputs sweat rate, hydration deficit %, sweat-sodium loss, sodium gap, and autopilot recheck cadence.

### Investor Pitch Deck (`artifacts/aforce-pitch`)
- **Format:** 22 React slides served at `/aforce-pitch/slide{1..22}`.
- **Narrative:** Built around the AForce product line (3 alkaline hydration flavors in cans and stick mixes) and the AForce OS mobile app.
- **Key Business Metrics:** Hardcoded revenue projections, LTV:CAC, gross margin, funding ask, and use of funds split.
- **Brand palette (deck-only):** Dark base with red, blue, and yellow flavor accents.

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** Documents target topology for 50M+ users including multi-region active/active reads, sharded Postgres, Redis, Kafka, and AI provider failover.
- **Stripe Integration:** Handles one-time cart checkouts and subscription flows, including server-side re-pricing, shipping, tax, and robust validation.

### Store + Subscription System
- **SKU pricing:** Defines pricing for sticks, RTD, and canisters, including subscription discounts.
- **Bundles:** Per-format flavor-agnostic bundles with authoritative pricing at checkout.
- **`productPricingService.ts`:** Centralizes Subscribe-and-Save math, bundle savings, and recommended SKU lookups.
- **Consumer subscription tiers:** Five tiers: `core`, `recovery_plus`, `athlete`, `system`, and `elite`.
- **Recovery+ paywall:** `RecoveryModePaywall.tsx` replaces `RecoveryModeCard` for non-subscribers.
- **StoreScreen UI:** Dark-luxury card layout with badge chips, product-intelligence rows, one-time/subscribe toggle, and bundle quantity selector.

## Architecture Diagram (AForce OS)
- `app/`: Root layouts, screen definitions, tab bar, gated demo routes.
- `components/`: Reusable UI components.
- `services/`: Business logic, product recognition, hydration scanning, subscription management.
- `store/`: Application state management.
- `utils/`: Utilities like `scoringEngine.ts`.
- `featureFlags/`: Feature toggles.
- `theme/`: Brand colors.
- `types/`: Global type definitions.
- `data/`: Mock data, product definitions, voice, and sharing templates.

# External Dependencies

- **Stripe:** Payment processing for cart checkout and subscriptions.
- **Expo SDK:** Core framework for React Native application development.
- **Expo WebBrowser:** Used for opening Stripe Checkout sessions.
- **Expo Speech:** For native text-to-speech capabilities.
- **@expo-google-fonts/inter:** For custom font rendering.
- **React Native Reanimated:** For declarative animations.
- **React Native Gesture Handler:** For gesture recognition.
- **PostgreSQL:** Primary database, managed with Drizzle ORM.
- **Orval:** For OpenAPI spec-based API client and Zod schema generation.
- **Zod:** Schema validation library.
- **pnpm workspaces:** Monorepo management.
- **esbuild:** For bundling Node.js and client-side code.
- **Stripe-replit-sync:** Mirrors Stripe webhook events into a `stripe.*` Postgres schema.