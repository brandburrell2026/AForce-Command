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
- **Subscription System:** Manages six plan tiers with feature gating.
- **Product Comparison Engine:** Real-time, brand-neutral product ranking.
- **Core Loop:** Score evaluation, AI commands, intake logging, and engine refresh.
- **Social Mode:** BAC estimator, impairment assessment, and recovery protocols.
- **Hydration Journal:** Longitudinal score history, daily timeline, and PDF export.
- **Sweat Calculator:** ACSM-grade sweat-rate calculation with multiple input modes.
- **Phantom Band Integration:** BLE service for automatic sip logging from a hardware device.
- **Sensor Import:** Parses external sensor data (hDrop, Nix, Gatorade Gx) and integrates it into logs and snapshots.
- **Achievements:** Catalog of 12 badges unlocked based on user activity, stored in an append-only table.
- **Science & Methodology:** In-app documentation of all formulas, calculations, and references, with PDF export.
- **Cruise Mode:** Premium enterprise add-on for hydration intelligence at sea, providing live scores, environmental data, and tailored recommendations for crew and guests. Ship Environment now pulls live conditions from OpenWeather via `GET /api/cruise/environment?port=<id>` (api-server route `routes/cruise.ts`, 10-min in-memory cache, deterministic Caribbean fallback when upstream is unavailable). Operator section is now a fleet-level dashboard (`FLEET_DEMO` in `services/cruiseModeService.ts`) with KPI strip, ship switcher across Royal Caribbean / Carnival / Virgin / Disney, and per-ship department compliance.

### Investor Pitch Deck (`artifacts/aforce-pitch`)
- A 27-slide React presentation (`/aforce-pitch/slide{1..27}`) outlining the project's vision, problem statement, solution (AForce OS), go-to-market strategy, and recurring revenue model.
- Focuses on AForce product line (hydration flavors) and the OS app.
- Includes key business metrics and funding ask.

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** Outlines target topology for 50M+ users, including multi-region deployments, sharded databases, Redis, Kafka, and AI provider failover.
- **Stripe Integration:** Handles one-time checkouts and subscription flows with server-side pricing, shipping, tax, and validation.
- **Auth-gated routes:** All mutating `/api/aforce/*` routes require authentication via `@clerk/express`, with a fallback to `DEFAULT_USER_ID` in non-production environments.

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