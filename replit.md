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
- **AForce Voice Engine:** Mode-aware coach voice with templates. Voice output (`textToSpeech.ts` → expo-speech) is **on by default** and toggled via the "Voice Coach" switch in Profile (persisted to AsyncStorage). Each new AI command auto-speaks once (debounced via `lastSpoken` window) using the persona's locale + tone profile from `voicePersonaService`.
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
- **Hardware — Phantom Band auto-log (`/phantom`):** `bleService.ts` exposes a `BleAdapter` factory: `createBleAdapter()` returns the real `react-native-ble-plx` adapter when the native module is available (loaded via indirect `eval('require')` so Metro/web fall through), otherwise the simulator. Phantom GATT service: battery characteristic (read), sip-event characteristic (notify; payload = oz × 10 little-endian uint16 + flavor byte). Sip notifications fan out via `phantomBandService.on('sip')` → `useAppStore` silently calls `logIntake(fluidType, { silent: true, ozOverride })`. The simulator auto-fires a 4–10 oz sip every 90s while paired; PhantomBandScreen exposes a "Simulate Sip" dev button.
- **Sensor Import (`/sensors`):** `sensorImportService.ts` parses hDrop / Nix / Gatorade Gx CSV (or JSON) with `timestamp,sweat_loss_ml,sodium_mg,potassium_mg`. `POST /api/aforce/sensors/import` writes one `aforce_intake_logs` row + one `aforce_score_snapshots` row per sample tagged `reason='sensor:<source>'` (30 mL ≈ 1 oz water-equivalent), bumps `lastIntakeTime`, and unlocks the **Sensor Sync** badge.
- **Achievements (`/achievements`):** 12-badge catalog (`achievementsCatalog.ts`): First Sip, 3/7/30-day Streak, Sodium Master (4 days end-of-day deficit ≤ 5%), Heat Survivor, Recovery Rookie, Social Sentinel, AForce Convert (10 AForce units in a day), Hydration Engineer (30 snapshots), PDF Pioneer, Sensor Sync. Storage: `aforce_achievements (id, user_id, code, unlocked_at)` — append-only. `GET /api/aforce/achievements` recomputes progress from snapshots + intake_logs and persists newly-satisfied unlocks on read; `POST /api/aforce/achievements/unlock` is idempotent.
- **Science & Methodology (`/science`):** In-app page documenting every formula in the engine — ACSM sweat rate, Baker 2017 sodium bands, Rothfusz Heat Index, Widmark BAC, Apple Health HRV/RHR/sleep adjustment, soursop/flavor bonuses, scoring decay model. Each section follows **What we compute → Formula → Reference → Limitations**. "Export Methodology PDF" button (expo-print) unlocks the **PDF Pioneer** badge. Companion file: `docs/validation-methodology.md`.
- **Cruise Mode (`/cruise`) — Premium enterprise add-on:** Hydration intelligence for life at sea, designed for cruise lines (Royal Caribbean, Carnival, Norwegian, Disney, Virgin, luxury) and for crew + guests. Single scrollable screen with: live hydration score (orb + status + AForce Rx), ship environment (temp/humidity/sun/heat-index/deck/sea-vs-port-day), Crew Performance Mode (role/shift/steps/sweat-risk/break) OR Guest Wellness Mode (guest-type/pool/alcohol/excursion/sleep), composite Alcohol+Sun risk layer, port-day checklist, anonymized crew aggregate dashboard (5 depts × compliance bars + peak shift window), wellness badges (Deck Day, Excursion Recovery, Shift Warrior, Wellness Streak), QR-scan reorder pitch, cross-feature nav strip (Score / Sweat / Heat / Achievements), and 3-block business positioning (operators / guests / crew). Engine: `services/cruiseModeService.ts` — pure `evaluateCruise(session)` calculator (Rothfusz heat-index + workload/sun/alcohol/sleep loads → score, status `OPTIMIZED|MONITOR|DEHYDRATION_RISK|RECOVERY_NEEDED`, risk `LOW|MODERATE|HIGH|RECOVERY_CRITICAL`, recommendation, recheck cadence) plus 3 demo profiles (F&B crew, pool guest, excursion guest), `CREW_AGGREGATE_DEMO`, `PORT_DAY_CHECKLIST`, `CRUISE_BADGES`. Premium-gated via `cruise_mode_enabled` flag (FeatureGate; default off, on in `DEMO_ALL_ON_FLAGS`); link from Profile → PROTOCOL TOOLS card. Custom deep-navy + electric-aqua palette overlays the base GradientBackground.

### Investor Pitch Deck (`artifacts/aforce-pitch`)
- **Format:** 27 React slides served at `/aforce-pitch/slide{1..27}` (manifest at `src/data/slides-manifest.json`). Each slide hardcodes its own "NN — Title" eyebrow and "N / 27" page indicator; renumbering requires touching every slide file.
- **Narrative spine (Pitch Deck v2 — investor-grade restructure):**
  - **Slide 1 — Cover:** "Performance is non-negotiable." · "Pause. Hydrate. Lock in. Perform." · "This is beyond a hydration brand. This is a performance standard."
  - **Slide 2 — Founder Proof (NEW):** "Built under pressure. Before the product existed." NBA environments + Wall Street execution arenas. "We didn't build a drink. We built the system we needed." Footer: "Two founders. No off switch. · Brandon Burrell · Julius Burrell."
  - **Slide 3 — Mission:** Three Beliefs (Brand Truth / Human Insight / Category Claim) plus the Daily Ritual ribbon (Morning · Midday · Pre-performance · Recovery) and an advisor pull-quote attributed to Kristel van Kleef & Peter Ingwersen.
  - **Slide 4 — Problem (The Disruption):** Reframes the energy category as "loud by design" with a direct Red Bull contrast and the New Territory line: focus, control, consistency.
  - **Slide 5 — Insight (The Performance Moment):** "The edge is not louder — it is quieter." Kobe / Beyoncé metaphor, AForce ritual, Loud→Quiet shift.
  - **Slide 9 — AForce OS (SIMPLIFIED):** "The intelligence layer." Three-step framework (Score → Command → Improve) replaces the prior Four Stages. Bottom strip: "No wearable required. Starts simple. Gets smarter over time."
  - **Slide 19 — Go-To-Market:** Headline "Build. Scale. Lead." Top-right pull-quote (NEW): "We don't sell hydration. We install a daily performance system." Six phases + "Hardware scales. Software compounds. The OS creates retention."
  - **Slide 24 — Recurring Engine (NEW):** "Every user becomes a system." Three layers (Product / Subscription·OS / Data Loop). Pull-strip: "Performance creates habit · Habit creates subscription · Subscription creates enterprise value." Metrics: $52 AOV / 5–7× / $5·$15 / 90%+.
  - **Slide 27 — The Ask:** Closing reprises "Performance is non-negotiable. AForce makes sure you're always on." with a strategic-advisors credit box and the final insight "The edge is not louder. It is quieter."
- **Built around the AForce product line** (3 alkaline hydration flavors in cans and stick mixes) and the AForce OS mobile app.
- **Key Business Metrics:** Hardcoded revenue projections, LTV:CAC, gross margin, funding ask, and use of funds split.
- **Brand palette (deck-only):** Dark base with red, blue, and yellow flavor accents.

### API Server (`artifacts/api-server`)
- **Scaling Blueprint:** Documents target topology for 50M+ users including multi-region active/active reads, sharded Postgres, Redis, Kafka, and AI provider failover.
- **Stripe Integration:** Handles one-time cart checkouts and subscription flows, including server-side re-pricing, shipping, tax, and robust validation.
- **Auth-gated routes (`requireAuth` middleware):** All `/api/aforce/*` mutating routes — `POST /sensors/import`, `POST /achievements/unlock`, `GET /achievements`, `POST /intake`, `POST /confirmation`, `POST /journal/snapshot`, `GET /state`, plus `GET /entitlement` and `POST /checkout/session`. Auth resolves via `@clerk/express` `getAuth()`; in non-production builds without `CLERK_SECRET_KEY` the middleware falls back to `DEFAULT_USER_ID` so the demo flow keeps working. In production, missing `CLERK_SECRET_KEY` returns `503 auth_unavailable` (fail-closed).
- **Environment variables:** Server reads `DATABASE_URL`, `OPENWEATHER_API_KEY`, `SESSION_SECRET`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NODE_ENV`, `PORT`. Mobile app reads (via Metro / `EXPO_PUBLIC_*` prefix): `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (Clerk web/mobile sign-in), `EXPO_PUBLIC_DOMAIN` (proxy host for API requests), `EXPO_PUBLIC_REPL_ID` (deep-link scheme); plus the Expo packager-only vars `EXPO_PACKAGER_PROXY_URL` and `REACT_NATIVE_PACKAGER_HOSTNAME`.

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