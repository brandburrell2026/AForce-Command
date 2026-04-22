# Overview

This project is a pnpm workspace monorepo utilizing TypeScript, focused on developing AForce OS, a production-ready React Native / Expo mobile application. AForce OS functions as a real-time human performance operating system, incorporating hydration intelligence and AI-driven decision-making. The project also includes an API server developed with Express 5 and PostgreSQL.

Key capabilities include:
- **Hydration Tracking & AI Coaching:** A mobile application that scans products, analyzes hydration levels, provides AI-driven coaching, and offers product comparisons.
- **Social & Competitive Features:** "Circles" for private accountability networks and "Territory" for live competition mapping.
- **E-commerce & Subscription Management:** Integration with Stripe for cart checkout and subscription management.
- **Scalable Architecture:** A blueprint for a highly scalable backend infrastructure designed to support 50M+ users, with considerations for multi-region deployments, sharded databases, and real-time event processing.

The project's vision is to deliver a comprehensive platform for athletic performance and wellness, leveraging advanced technology to provide personalized insights and foster community engagement.

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
- **State Management (Mobile):** React Context + `useReducer` with `useSyncExternalStore` for reactive services.
- **Navigation (Mobile):** Expo Router 6 (file-based navigation)
- **Animations (Mobile):** React Native Reanimated, React Native Gesture Handler
- **Fonts (Mobile):** Inter font (`@expo-google-fonts/inter`)

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette uses lime (#B4FF50 - PEAK), teal (#00E5C8 - BALANCED), amber (#FFA01E - RECOVERING), and red (#FF2D55 - DEPLETED) to represent performance states. Clutch teal and Guardian purple are used for specific features.
- **Design Language:** Emphasizes "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND."
- **Action Row:** Uses icon-only square tiles (`flex:1`, `aspectRatio:1`) with a "Phantom-card" aesthetic for navigation, ensuring consistent layout across devices.
- **Stylized Maps:** TerritoryMap intentionally renders a stylized view with aggregated locations, explicitly stating "NO PRECISE LOCATION" to maintain privacy and design consistency. Precise cartography would be an opt-in additive layer.
- **Animations:** Uses Reanimated for smooth score count-ups and dynamic Pulse animations (color, speed, wave behavior, glow).

## Technical Implementations & Feature Specifications

### Persistence & Real-Time Backend (T6)
- **Postgres-backed user state:** AForce OS now persists `userState`, intake logs, and confirmation answers to Replit Postgres via Drizzle (`lib/db/src/schema/aforce.ts`). V1 is single-user (`userId='default'`); the schema is shaped so multi-user/auth is a drop-in change later.
- **REST API:** `artifacts/api-server/src/routes/aforce.ts` mounts under `/api/aforce` — endpoints: `/state`, `/intake` (atomic increment in a tx), `/signals`, `/urine`, `/energy`, `/checkin`, `/confirm` (tx + ±3 + clutch boost), `/flags`, `/weather?lat&lon`. All mutations broadcast to subscribed WebSocket clients.
- **WebSocket hub:** `ws` package in noServer mode at `/api/aforce/ws?user=default`, sharing one HTTP server (and one PORT) with Express. 30s heartbeat. Mobile client (`services/realApi.ts → subscribeToStateUpdates`) reconnects with exponential backoff.
- **Server-side OpenWeather:** `lib/openWeather.ts` proxies OpenWeather with a 10-minute in-memory cache so the API key never reaches the client. Snapshot is persisted into `aforce_user_state` and consumed by `scoringEngine.ts` (`weatherTempC`/`weatherHumidity` — falls back to the heatLoad approximation when missing). Client refreshes every 15 min using `expo-location` (Denver default).
- **Client overlay model:** Server is source of truth for everything except `appleHealth` (HealthKit on-device only), which the mobile store preserves via a ref-backed overlay across WS pushes.

### Mobile Application (`artifacts/aforce-os`)
- **AForce HydroScan:** Premium scan-to-decide UX for product recognition and comparison. Maps barcodes/QR/manual queries to `CompareProduct` and provides AI commands and recommendations.
- **AForce Circles:** A premium private accountability network with shared status, reactions, challenges, and privacy controls.
- **AForce Territory:** Live competition map with regions, competition stats, and battles. Scoring engine weights performance, protocol, streak, recovery, and momentum.
- **AForce Voice Engine:** Mode-aware coach voice with templates fanning out per `VoiceUrgencyMode` (peak/balanced/recovering/depleted) and tone enforcement (banned phrases, word/sentence ceilings). Utilizes native TTS via `expo-speech`.
- **Heat Guard Escalation:** Triggers voice warnings, haptics, and UI overlays on significant changes in performance state.
- **Social Sharing:** Premium, non-feed sharing of performance moments using voice-correct templates and visual previews.
- **Subscription System:** Manages 6 plan tiers with feature inheritance, including mock billing actions and feature gating.
- **Product Comparison Engine:** Real-time, brand-neutral product ranking with axis breakdowns and "Why AForce Wins" / "Full Comparison" toggles.
- **AI Coaching Videos:** Cinematic Reanimated video player with scenes matched to user state via a video engine.
- **Community Competition:** Applies a formula (performance, compliance, consistency, recovery) to individuals, cities, states, and teams.
- **Core Loop:** Score -> Why This Score -> AI Command -> Quick Intake -> Cycle Success -> Engine refresh.

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** Documents target topology for 50M+ users, including edge/CDN, multi-region active/active reads, sharded Postgres, Redis hot state, Kafka event log, and AI provider failover. Placeholder modules provide working in-memory defaults for `cache`, `events`, `queues`, `middleware`, `observability`, `health`, and `config`.
- **Stripe Integration:**
    - Handles one-time cart checkouts and subscription flows.
    - Server-side re-pricing against `storeCatalog.ts` (authoritative cents) for all items.
    - Adds shipping and tax as separate Stripe line items.
    - Robust validation for SKUs, quantities, and return URLs.
    - Open-redirect guard requiring return URLs to match the inbound request's host for `http(s)` schemes.
    - Server-side checkout finalization by retrieving Stripe session status to verify `payment_status` before confirming orders/subscriptions.
    - `catalogParity.test.ts` ensures client and server SKU catalogs are in sync regarding existence and pricing.

## Architecture Diagram (AForce OS)
The mobile application structure is organized as follows:
- `app/`: Contains root layouts and screen definitions, including a tab bar with Home, Check, Protocol, and Profile, along with gated demo routes.
- `components/`: Reusable UI components such as `StatusPulseOrb`, `AnimatedScore`, `AICommandCard`, and `QuickIntakeBar`.
- `services/`: Encapsulates business logic, including `mockApi.ts` (the sole source of engine output), product recognition, hydration scanning, and subscription management.
- `store/`: Manages application state using `useAppStore` (Context + `useReducer`).
- `utils/`: Contains utilities like `scoringEngine.ts`.
- `featureFlags/`: Manages feature toggles.
- `theme/`: Defines brand colors.
- `types/`: Global type definitions.
- `data/`: Mock data, product definitions, and templates for voice and sharing.

# External Dependencies

- **Stripe:** For payment processing (one-time cart checkout and subscriptions). Credentials are pulled from Replit Connectors API.
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
- **k6:** For load testing (specified in load testing plans, not directly integrated into runtime).
- **Stripe-replit-sync:** (Planned, not yet integrated) For webhook synchronization to Postgres and customer portal management.