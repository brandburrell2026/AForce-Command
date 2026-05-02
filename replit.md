# Overview

AForce OS is a production-ready React Native / Expo mobile application complemented by an Express 5 and PostgreSQL API server. It functions as a real-time human performance operating system, specializing in hydration intelligence and AI-driven decision-making. The project aims to deliver personalized insights and foster community engagement for enhancing athletic performance and overall wellness. Key capabilities include hydration tracking and AI coaching, social and competitive features ("Circles" and "Territory"), and integrated e-commerce with Stripe for purchases and subscriptions. The architecture is designed for scalability to support a large user base (50M+).

# User Preferences

I prefer iterative development, with frequent, small updates. Ask before making major changes.

# System Architecture

## Core Technologies
- **Monorepo:** pnpm workspaces with `tsc --noEmit` and `tsc --build`.
- **Backend:** Node.js (v24), Express 5, PostgreSQL, Drizzle ORM, Zod.
- **Mobile:** React Native / Expo SDK 54 with Expo Router 6, React Native Reanimated 3, `i18next`, `@tanstack/react-query`.
- **State Management (mobile):** React Context + `useReducer` organized as a slice-based store (`store/slices.tsx`).
- **API Tools:** Orval for OpenAPI codegen, generating React Query hooks in `@workspace/api-client-react`.

## UI/UX Decisions (AForce OS)
- **Color Scheme:** Brand palette includes lime, teal, amber, red, Clutch teal, and Guardian purple.
- **Design Language:** "Performance Signals," "Hydration Signal Check," "Energy State," and "AFORCE COMMAND," with a "Phantom-card" aesthetic.
- **Visuals:** Stylized maps for "Territory" and smooth animations with Reanimated.
- **Home Screen Layout:** Composable section components under `components/home/*`.

## Authentication & Identity (Clerk)
- **Provider:** Clerk via `@clerk/expo` for mobile and `@clerk/express` for server-side.
- **Sign-in:** Custom email+password flow and Google SSO via `useSSO()`.
- **Token Bridge:** `components/ClerkAuthBridge.tsx` integrates Clerk's `getToken` with `services/authToken.ts` and the OpenAPI client.
- **Auth-gated routes:** Mobile routes are gated by `app/(tabs)/_layout.tsx`; server-side routes require `@clerk/express` middleware.

## Subscription & Entitlement (Stripe)
- **Source of Truth:** Stripe and `stripe-replit-sync` mirror webhook events into PostgreSQL.
- **Client Hook:** `hooks/useEntitlement.ts` pulls plan tier for paywall gating.
- **Server Hardening:** Pricing, shipping, and tax are computed server-side; webhook events use signature verification.

## Server Hardening (`artifacts/api-server`)
- **Routing:** Express 5 with Zod input/output validation from OpenAPI spec.
- **Concurrency:** `SELECT ... FOR UPDATE` for serializing concurrent posts per user.
- **Rate Limiting & Cache:** OpenWeather is proxied with an in-memory TTL cache; public and auth-gated endpoints have rate limits.
- **Logging:** Route handlers use `req.log`; non-request code uses a singleton logger.
- **Real-time:** REST mutations are broadcast over a shared HTTP/WebSocket server.

## Technical Implementations & Feature Specifications
- **Persistence & Real-Time Backend:** PostgreSQL via Drizzle; REST API broadcasts mutations to WebSocket clients.
- **Per-Event Hydration Scoring:** Defines point values, absorption caps, and release curves.
- **AForce Protocol Screen:** Synchronous derivation of protocol stage based on user state and engine output.
- **Water Cycle / "Become AForce":** Modals for water and hydration stick intake, with flavor inference.
- **Social Mode → Hydration Score:** Alcohol intake impacts hydration scores and decay rate.
- **Multi-Provider Health Signals:** Integrates various health platforms (Apple Health, Oura, etc.) with "freshest-wins" logic.
- **Hydration Depletion Math:** Pure, dependency-free helper modeling score-points-per-minute decay based on physiological standards.
- **Mobile Application (`artifacts/aforce-os`):** Includes HydroScan, Circles, Territory, Ring (Calm Coach + Sport Mode), Voice Engine, Voice Commands, Heat Guard Escalation, Subscription System, Product Comparison, Core Loop, Social Mode, Hydration Journal, Sweat Calculator, Phantom Band integration, Sensor Import, and Achievements.
- **API Server (`artifacts/api-server`):** Scaling blueprint for 50M+ users, Stripe integration, auth-gated routes, and social graph routes.
- **Store + Subscription System:** Defines SKU pricing, discounts, and bundles; five consumer subscription tiers with feature gating.

## Architecture Diagram (AForce OS)
- **`app/`**: Root layouts, screens, tab bar, gated routes.
- **`components/`**: Reusable UI elements, including home sections.
- **`services/`**: Business logic.
- **`store/`**: Slice-based reducer state.
- **`utils/`**: Pure helpers for calculations and data processing.
- **`featureFlags/`**: Feature toggles.
- **`theme/`**: Brand colors.
- **`types/`**: Global type definitions.
- **`data/`**: Mock data, product definitions, templates.

# External Dependencies

- **Stripe:** Payment processing and subscription management.
- **stripe-replit-sync:** Mirrors Stripe webhook events to PostgreSQL.
- **Clerk (`@clerk/expo`, `@clerk/express`):** Authentication.
- **Expo SDK 54:** React Native development framework.
- **Expo WebBrowser / AuthSession:** OAuth and in-app browser.
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