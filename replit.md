# Overview

AForce OS is a production-ready React Native / Expo mobile application complemented by an Express 5 and PostgreSQL API server. It functions as a real-time human performance operating system, specializing in hydration intelligence and AI-driven decision-making. The project aims to deliver personalized insights and foster community engagement for enhancing athletic performance and overall wellness.

Key capabilities include:
- **Hydration Tracking & AI Coaching:** Mobile features for product scanning, hydration analysis, AI coaching, and product comparisons.
- **Social & Competitive Features:** "Circles" for private accountability and "Territory" for live competition mapping.
- **E-commerce & Subscription Management:** Integration with Stripe for purchases and subscription handling.
- **Scalable Architecture:** Designed to support a large user base (50M+) with considerations for multi-region deployments, sharded databases, and real-time event processing.

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo:** pnpm workspaces
- **Backend:** Node.js (v24), Express 5, PostgreSQL, Drizzle ORM, Zod.
- **Mobile:** React Native / Expo SDK 54, React Context + `useReducer`, Expo Router 6, React Native Reanimated, `i18next`.
- **API Tools:** Orval for OpenAPI codegen.

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette includes lime, teal, amber, red, Clutch teal, and Guardian purple.
- **Design Language:** Emphasizes "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND," utilizing a "Phantom-card" aesthetic.
- **Visuals:** Stylized maps for "Territory" and smooth animations with Reanimated.

## Technical Implementations & Feature Specifications

### Persistence & Real-Time Backend
- User state, intake logs, and answers are persisted in PostgreSQL via Drizzle.
- REST API endpoints (`/api/aforce`) broadcast mutations to WebSocket clients.
- A shared HTTP/WebSocket server (`ws` package) handles real-time communication.
- OpenWeather API is proxied with in-memory caching.
- The server acts as the source of truth for all data, excluding `appleHealth`.

### Per-Event Hydration Scoring
- Defines point values, absorption caps, and release curves for hydration events.
- Uses `SELECT ... FOR UPDATE` for concurrent intake operations.

### Social Mode → Hydration Score
- Alcohol intake immediately impacts hydration scores and amplifies decay rate.
- A helper `utils/hangoverRisk.ts:socialIntakePoints` calculates negative score delta per active drink, with mitigation for matched water intake.

### Multi-Provider Health Signals → Hydration Score
- Integrates data from Apple Health, Oura Ring, Samsung Health, Google Health Connect, Garmin Connect, WHOOP, and Strava.
- An aggregator `utils/biometricsAggregator.ts` processes data, applying "freshest-wins" logic per metric and determining activity and recovery signals.

### Hydration Depletion Math (`utils/depletionRate.ts`)
- A pure, dependency-free helper modeling score-points-per-minute decay.
- Physiologically grounded against ACSM, IOM, and ISO 7933 standards.
- Formula accounts for weight, activity, heat, humidity, sleep, and social factors.

### Mobile Application (`artifacts/aforce-os`)
- **AForce HydroScan:** Product recognition and comparison.
- **AForce Circles:** Private accountability networks.
- **AForce Territory:** Live competition mapping and scoring.
- **AForce Ring (Calm Coach + Sport Mode):** A companion experience with an idle home screen (`/ring`) and a live sport HUD (`/ring/session`).
- **AForce Voice Engine:** Mode-aware coaching with text-to-speech, configurable by the user via ElevenLabs or device synthesizer fallback.
- **AForce Voice Commands:** Mic-enabled commands (7 categories) classified via regex for actions like logging intake, navigation, smart coaching, product reorder, social features, and performance mode toggles.
- **Heat Guard Escalation:** Triggers warnings and UI overlays based on performance state and environmental conditions.
- **Subscription System:** Manages six plan tiers with feature gating via Stripe.
- **Product Comparison Engine:** Real-time, brand-neutral product ranking.
- **Core Loop:** Score evaluation, AI commands, intake logging, and engine refresh.
- **Social Mode:** BAC estimator, impairment assessment, and recovery protocols.
- **Hydration Journal:** Longitudinal score history, daily timeline, and PDF export.
- **Sweat Calculator:** ACSM-grade sweat-rate calculation with multiple input modes.
- **Phantom Band & AForce Ring Integration:** BLE service for automatic sip logging and wearable companion experience (gated by `phantom_wearable_enabled` feature flag).
- **Sensor Import:** Parses external sensor data (hDrop, Nix, Gatorade Gx).
- **Achievements:** Catalog of 12 badges unlocked based on user activity.
- **Science & Methodology:** In-app documentation of formulas, calculations, and references.
- **Cruise Mode:** Premium guest-only add-on for hydration intelligence at sea, pulling live conditions from OpenWeather.

### Investor Pitch Deck (`artifacts/aforce-pitch`)
- A 27-slide React presentation outlining project vision, problem statement, solution, go-to-market strategy, and recurring revenue model, with updated narrative alignment.

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** Outlines target topology for 50M+ users, including multi-region deployments, sharded databases, Redis, Kafka, and AI provider failover.
- **Stripe Integration:** Handles one-time checkouts and subscription flows with server-side pricing, shipping, tax, and validation.
- **Auth-gated routes:** All mutating `/api/aforce/*` routes require authentication via `@clerk/express`.
- **Social graph routes:** Real Drizzle-persisted endpoints for territory rivalries (`/api/battles`), circle membership and challenges (`/api/circle`), and privacy settings (`/api/privacy`).

### Store + Subscription System
- Defines SKU pricing, subscription discounts, and bundle offerings.
- `productPricingService.ts` centralizes pricing logic.
- Implements five consumer subscription tiers (`core`, `recovery_plus`, `athlete`, `system`, `elite`).
- Paywalls restrict access to premium features for non-subscribers.
- `StoreScreen` provides a UI for product selection and subscription management.

## Architecture Diagram (AForce OS)
- **`app/`**: Root layouts, screens, tab bar, gated routes.
- **`components/`**: Reusable UI elements.
- **`services/`**: Business logic.
- **`store/`**: Application state management.
- **`utils/`**: Utility functions.
- **`featureFlags/`**: Feature toggles.
- **`theme/`**: Brand colors.
- **`types/`**: Global type definitions.
- **`data/`**: Mock data, product definitions, voice/sharing templates.

# External Dependencies

- **Stripe:** Payment processing and subscription management.
- **Expo SDK:** React Native development framework.
- **Expo WebBrowser:** For opening web links.
- **Expo Speech:** Text-to-speech functionality (fallback).
- **@expo-google-fonts/inter:** Custom font.
- **React Native Reanimated:** Declarative animations.
- **React Native Gesture Handler:** Gesture recognition.
- **PostgreSQL:** Primary database.
- **Orval:** OpenAPI codegen.
- **Zod:** Schema validation.
- **pnpm workspaces:** Monorepo management.
- **esbuild:** Bundling.
- **Stripe-replit-sync:** Mirrors Stripe webhook events to PostgreSQL.
- **OpenWeather API:** For environmental data (proxied with caching).
- **ElevenLabs:** Text-to-speech service.
- **Clerk:** Authentication.