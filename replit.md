# Overview

This project is a pnpm workspace monorepo using TypeScript, dedicated to developing AForce OS, a production-ready React Native / Expo mobile application. AForce OS functions as a real-time human performance operating system, integrating hydration intelligence and AI-driven decision-making. The project also includes an API server developed with Express 5 and PostgreSQL.

Key capabilities include:
- **Hydration Tracking & AI Coaching:** Mobile application for product scanning, hydration analysis, AI coaching, and product comparisons.
- **Social & Competitive Features:** "Circles" for private accountability networks and "Territory" for live competition mapping.
- **E-commerce & Subscription Management:** Integration with Stripe for cart checkout and subscription management.
- **Scalable Architecture:** Designed for high scalability to support 50M+ users, with considerations for multi-region deployments, sharded databases, and real-time event processing.

The project's vision is to deliver a comprehensive platform for athletic performance and wellness, leveraging advanced technology for personalized insights and community engagement.

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo Tool:** pnpm workspaces
- **Node.js:** v24
- **Package Manager:** pnpm
- **TypeScript:** v5.9
- **Mobile App:** React Native / Expo SDK 54 / React Native 0.81
- **API Framework:** Express 5
- **Database:** PostgreSQL + Drizzle ORM
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild (CJS bundle)
- **State Management (Mobile):** React Context + `useReducer` with `useSyncExternalStore`
- **Navigation (Mobile):** Expo Router 6 (file-based navigation)
- **Animations (Mobile):** React Native Reanimated, React Native Gesture Handler
- **Fonts (Mobile):** Inter font (`@expo-google-fonts/inter`)
- **i18n (Mobile):** `i18next` + `react-i18next` + `expo-localization` (six MVP locales).

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette uses lime (PEAK), teal (BALANCED), amber (RECOVERING), and red (DEPLETED) for performance states. Clutch teal and Guardian purple for specific features.
- **Design Language:** Emphasizes "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND."
- **Action Row:** Uses icon-only square tiles with a "Phantom-card" aesthetic for consistent layout.
- **Stylized Maps:** TerritoryMap renders aggregated locations with "NO PRECISE LOCATION" to maintain privacy.
- **Animations:** Uses Reanimated for smooth score count-ups and dynamic Pulse animations.

## Technical Implementations & Feature Specifications

### Persistence & Real-Time Backend
- **Postgres-backed user state:** Persists `userState`, intake logs, and confirmation answers via Drizzle.
- **REST API:** Endpoints under `/api/aforce` for state, intake, signals, weather, etc. All mutations broadcast to WebSocket clients.
- **WebSocket hub:** `ws` package sharing the HTTP server with Express, with 30s heartbeat and exponential backoff for mobile clients.
- **Server-side OpenWeather:** Proxies OpenWeather with a 10-minute in-memory cache; API key never reaches the client.
- **Client overlay model:** Server is source of truth for all data except `appleHealth` (HealthKit on-device only).

### Per-Event Hydration Scoring
- **Spec:** Defines point values for water and AForce flavors, absorption caps (1.5 units in 20 min), and release curves (water 60% immediate/40% over 12.5 min; AForce 70% immediate/30% over 25 min).
- **Implementation:** Pure logic in `hydrationScoreService.ts` to compute event impact and trim old events. Intake events stored in JSONB.
- **Concurrency:** Uses `SELECT ... FOR UPDATE` row locks for concurrent intake operations.

### Mobile Application (`artifacts/aforce-os`)
- **AForce HydroScan:** Premium scan-to-decide UX for product recognition and comparison.
- **AForce Circles:** Premium private accountability network with shared status and challenges.
- **AForce Territory:** Live competition map with regions and stats, scoring engine weights performance, protocol, streak, recovery, and momentum.
- **AForce Voice Engine:** Mode-aware coach voice with templates and tone enforcement. Voice input path is fully wired, voice output (TTS playback) is intentionally disabled by default.
- **Heat Guard Escalation:** Triggers voice warnings, haptics, and UI overlays on performance state changes.
- **Social Sharing:** Premium, non-feed sharing of performance moments using voice-correct templates.
- **Subscription System:** Manages 6 plan tiers with feature inheritance and gating.
- **Product Comparison Engine:** Real-time, brand-neutral product ranking.
- **AI Coaching Videos:** Cinematic Reanimated video player with scenes matched to user state.
- **Community Competition:** Applies a formula to individuals, cities, states, and teams.
- **Core Loop:** Score -> Why This Score -> AI Command -> Quick Intake -> Cycle Success -> Engine refresh.
- **Social Mode (alcohol mitigation):** Features BAC estimator (Widmark approximation), 5-level impairment assessment (LOW to CRITICAL), legal/transportation safety guidance, and Recovery Mode with pre-sleep protocol and morning estimates. Coach escalation for high-risk states. Disclaimer copy is locked and global-safe.

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** Documents target topology for 50M+ users including edge/CDN, multi-region active/active reads, sharded Postgres, Redis, Kafka, and AI provider failover.
- **Stripe Integration:** Handles one-time cart checkouts and subscription flows. Includes server-side re-pricing, shipping and tax as separate line items, robust validation, open-redirect guard, and server-side checkout finalization.

### Store + Subscription System
- **SKU pricing:** Defines pricing for sticks, RTD, and canisters, including subscription discounts.
- **Bundles:** Per-format flavor-agnostic bundles with authoritative pricing at checkout.
- **`productPricingService.ts`:** Centralizes Subscribe-and-Save math, bundle savings, and recommended SKU lookups.
- **Consumer subscription tiers:** Five tiers: `core`, `recovery_plus`, `athlete`, `system` (Performance Bundle), and `elite`.
- **Recovery+ paywall:** `RecoveryModePaywall.tsx` replaces `RecoveryModeCard` for non-subscribers, opening Stripe Checkout for `recovery_plus` plan.
- **StoreScreen UI:** Dark-luxury card layout with badge chips, product-intelligence rows, one-time/subscribe toggle, and bundle quantity selector.

## Architecture Diagram (AForce OS)
- `app/`: Root layouts, screen definitions, tab bar, gated demo routes.
- `components/`: Reusable UI components (e.g., `StatusPulseOrb`, `AICommandCard`).
- `services/`: Business logic, including `mockApi.ts`, product recognition, hydration scanning, subscription management.
- `store/`: Application state management using `useAppStore`.
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