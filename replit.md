# Overview

AForce OS is a real-time human performance operating system, delivered as a React Native / Expo mobile application with an Express 5 and PostgreSQL API server. Its core purpose is to provide hydration intelligence and AI-driven insights to enhance athletic performance and overall wellness. Key features include personalized hydration tracking, AI coaching, social engagement through "Circles" and "Territory" features, and integrated e-commerce capabilities via Stripe for purchases and subscriptions. The system is designed for high scalability to support a user base of over 50 million.

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
- **App icon / splash / adaptive icon:** WHOOP-cinematic branded set in `assets/images/` (`icon.png`, `splash.png`, `adaptive-icon.png`, `favicon.png`) — pure black background with WHOOP lime `#B6FF00` mark.
- **Build commands** (run from `artifacts/aforce-os/` after `pnpm eas:login` + `pnpm eas:configure`):
  - iOS production: `pnpm eas:build:ios`
  - Android production: `pnpm eas:build:android`
  - Both: `pnpm eas:build:all`
  - Internal preview (no store submission): `pnpm eas:build:preview`
- **Submit commands:**
  - iOS App Store: `pnpm eas:submit:ios`
  - Google Play (internal track): `pnpm eas:submit:android`
- **One-time setup needed before first submit:**
  - In `eas.json` `submit.production.ios`: replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` and `REPLACE_WITH_APPLE_TEAM_ID` with the values from App Store Connect.
  - For Android: place a Google Play service account JSON at `artifacts/aforce-os/google-service-account.json` (path already in `eas.json`); never commit it.

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
- **API Server:** Designed for scalability for 50M+ users, includes Stripe integration, auth-gated routes, and social graph routes.
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