# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### AForce OS (Mobile App — `artifacts/aforce-os`)
Production-ready React Native / Expo mobile app — real-time human performance OS (hydration intelligence + AI decisioning). See `artifacts/aforce-os/README.md` for the full spec.

**Recent additions (Phase 4 — Hydration Scan + Subscription System):**
- **Hydration Scan** (`/scan`): premium scan-to-decide UX. `services/productRecognitionService.ts` maps barcodes/QR/manual queries → `CompareProduct` (BARCODE_INDEX includes AForce + Gatorade/Liquid IV/Pedialyte/LMNT/Prime). `services/hydrationScanService.ts` composes recognize → comparison-engine fit score → AI command + AForce equivalent recommendation. Screen has animated viewfinder ring, mock scan tray (preview-mode), QR shortcut, manual search fallback. Logs scanned AForce items via `logIntake`.
- **Subscription System** (`/subscription`, `/subscription/manage`): 6 plan tiers with feature inheritance — Core $5 → Athlete Mode $15 → Bundle $50 (FLAGSHIP w/ monthly product shipment) · Core Team $25–$300 · Clutch $800–$5K · Guardian $5K–$8K. Plans live in `data/subscriptionPlans.ts` (`PLAN_BY_ID`, `getEffectiveFeatures`, `getEffectiveFlags` walk the inheritance chain). Mock billing in `services/subscriptionService.ts` (switchPlan/cancel/pause/resume/skipNextDelivery). `featureFlags/subscriptionGate.ts` provides `gate(sub, featureId)` → `GateCheck` for `UpgradePrompt` modal. Manage screen shows billing, product shipment cycle, unlocked features, and pause/skip/cancel controls.
- `useAppStore` adds `state.subscription: UserSubscription` (initial via `defaultSubscription()`) and `setSubscription(sub)`. Profile screen renders dynamic plan name + status badge with Manage / Upgrade buttons.
- Home action row: SCAN / COMPARE / COMPETE.

**Recent additions (3-phase build):**
- **AI Coaching Videos** (Phase 1): cinematic Reanimated video player at `components/AIVideoPlayer.tsx` with 6 scenes matched to user state via `services/videoEngine.ts`. Compact + full-screen modal, command overlay.
- **Product Comparison Engine** (Phase 2): real-time, brand-neutral product ranking. `services/comparisonEngine.ts` (empty-catalog safe, NaN-clamped), `data/productDatabase.ts` (7 products), screen at `/compare` with axis breakdown, "Why AForce Wins" / "Full Comparison" toggle. Symmetric phrasing — never marketing.
- **Community Competition** (Phase 3): hydration as sport. Spec formula (perf 0.35 + compliance 0.25 + consistency 0.20 + recovery 0.20) applied uniformly to individuals, cities, states, and teams via `services/competitionEngine.ts`. Screen at `/competition` with City/State/Team/Individual scope tabs (flag-gated), highlighted YOU row, +12 spots delta pill, city-wins celebration ribbon. 4 new feature flags (`city_/state_/team_competition_enabled`, `global_leaderboard_enabled`).
- Home action row exposes both new screens via COMPARE + COMPETE buttons; COMPARE button auto-promotes when state is DEPLETED.

**Phase 1 (this build) delivers:**
- 4 tabs: Home (Hydration Control Center), Check (Performance Signals), Protocol (AForce Protocol), Profile (Settings + Demo Access).
- Stack routes for Phase 2 (`/clutch` — Command the Team) and Phase 3 (`/guardian` — Protect the Roster), gated behind feature flags toggled in Profile → DEMO ACCESS.
- Mocked `/v1` REST contract in `services/mockApi.ts` (8 endpoints, 60–220ms simulated latency). The store NEVER calls the scoring engine directly — engine output flows only from the service layer.
- Backend-driven Pulse animation contract (`PulseConfig`) — color, speed, wave behavior, glow, burst-on-intake.
- AI Commands enforced as WHAT + WHEN + OUTCOME (1–2 sentences, no soft language).
- 4 product types (sticks/jars/cans/bag) with brand imagery for tap-to-log Quick Intake.

**Tech Stack:**
- Expo SDK 54 / React Native 0.81
- React Native Reanimated (animations — useAnimatedReaction + runOnJS for score count-up)
- React Native Gesture Handler
- Expo Router 6 (file-based navigation)
- React Context + useReducer (state management — no backend)
- Inter font (via @expo-google-fonts/inter)
- No backend — service layer is mocked but contract-aligned to a real `/v1` API

**Architecture:**
```
artifacts/aforce-os/
├── app/
│   ├── _layout.tsx          # Root layout (SafeArea, Fonts, Providers)
│   ├── clutch.tsx           # Phase 2 demo (gated)
│   ├── guardian.tsx         # Phase 3 demo (gated)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar (4 tabs: Home, Check, Protocol, Profile)
│       ├── index.tsx        # Home — Hydration Control Center
│       ├── check.tsx        # Check — Performance Signals
│       ├── protocol.tsx     # AForce Protocol + Command History
│       └── profile.tsx      # Profile + Demo Access (feature flags)
├── components/
│   ├── StatusPulseOrb.tsx   # Pulse — driven entirely by PulseConfig
│   ├── AnimatedScore.tsx    # Score count-up (Reanimated)
│   ├── AICommandCard.tsx    # WHAT + WHEN + OUTCOME
│   ├── QuickIntakeBar.tsx   # 4 product types tap-to-log
│   ├── FeatureGate.tsx      # Locked-state wrapper for Phase 2/3
│   └── (LiveStatusStrip / WhyThisScore / RiskTimerDisplay / WaterCycleBar / PhantomSignal / CycleSuccessOverlay / GradientBackground / ErrorBoundary)
├── services/
│   └── mockApi.ts           # 8 mocked /v1 endpoints — sole source of engine output
├── store/
│   └── useAppStore.tsx      # Context + useReducer; routes through service layer
├── utils/
│   └── scoringEngine.ts     # Score formula + AI command + Phase 2/3 mocks
├── featureFlags/
│   └── flags.ts             # DEFAULT + DEMO_ALL_ON
├── theme/colors.ts          # Brand palette (lime/teal/amber/red, Clutch teal, Guardian purple)
├── types/index.ts           # PulseConfig / FluidType / FeatureFlags / GuardianRiskState
└── data/
    ├── mockData.ts          # User state, history, signal scales, roster
    └── products.ts          # 4 product types + bundled images
```

**Performance States:**
- PEAK (90–100): Lime #B4FF50
- BALANCED (75–89): Teal #00E5C8
- RECOVERING (60–74): Amber #FFA01E
- DEPLETED (0–59): Red #FF2D55

**Brand language enforced:** "Performance Signals" / "Hydration Signal Check" / "Energy State" / "Confirm Status" / "AFORCE COMMAND" / "HYDRATION CONTROL CENTER".

**Core Loop:** Score → Why This Score → AI Command → Quick Intake → Cycle Success → Engine refresh from /v1.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
