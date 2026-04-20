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
Production-ready React Native / Expo mobile app.

**Tech Stack:**
- Expo SDK 54 / React Native 0.81
- React Native Reanimated (animations)
- React Native Gesture Handler
- Expo Router (file-based navigation)
- React Context + useReducer (state management — no backend)
- Inter font (via @expo-google-fonts/inter)
- AsyncStorage (local persistence)
- No backend — local mock data only (V1)

**Architecture:**
```
artifacts/aforce-os/
├── app/
│   ├── _layout.tsx          # Root layout (SafeArea, Fonts, Providers)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar (3 tabs: Autopilot, Protocol, Profile)
│       ├── index.tsx        # Autopilot screen (main)
│       ├── protocol.tsx     # Protocol/history screen
│       └── profile.tsx      # Profile screen
├── components/
│   ├── StatusPulseOrb.tsx   # Animated signature orb
│   ├── LiveStatusStrip.tsx  # Top biometric strip
│   ├── WhyThisScore.tsx     # Score reasons
│   ├── RiskTimerDisplay.tsx # Countdown timer
│   ├── SystemCommandCard.tsx# Primary command
│   ├── WaterCycleBar.tsx    # 8-cell progress bar
│   ├── PhantomSignal.tsx    # Mock contextual data
│   ├── CycleSuccessOverlay.tsx # Post-cycle success animation
│   └── GradientBackground.tsx  # Premium dark background
├── store/
│   └── useAppStore.tsx      # App state (Context + useReducer)
├── utils/
│   └── scoringEngine.ts     # Score calculation (0-100)
├── theme/
│   ├── colors.ts            # Full color system (states: PEAK/BALANCED/RECOVERING/DEPLETED)
│   ├── typography.ts        # Type scale
│   └── spacing.ts           # Spacing/radii/shadows
├── types/
│   └── index.ts             # All TypeScript types
└── data/
    └── mockData.ts          # Mock user state, history, phantom signal
```

**Performance States:**
- PEAK (90-100): Neon lime (#AAFF00)
- BALANCED (75-89): Teal (#00D4B8)
- RECOVERING (60-74): Amber (#FFB800)
- DEPLETED (0-59): Red (#FF3B5C)

**Core Loop:** Score → Reason → Risk Timer → Command → Complete Cycle → Success → Reset → Repeat

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
