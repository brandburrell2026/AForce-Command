# AForce OS — Mobile App (standalone)

This repository contains **only the AForce OS mobile app** and the two internal
libraries it needs. It is fully self-contained and does **not** include the
investor deck, marketing site, or API server source. The app talks to the AForce
API over the network (see `EXPO_PUBLIC_API_BASE` below).

## What's in here

```
.
├── artifacts/
│   └── aforce-os/            # the Expo / React Native app (all UI + logic)
└── lib/
    ├── api-client-react/     # generated API client + React Query hooks
    └── demand-engine/        # shared hydration-demand logic
```

This is a small pnpm workspace. The two `lib/*` packages are consumed by the app
through `@workspace/*` imports — keep them in place.

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io) 9+ (`npm i -g pnpm`)
- For device/simulator builds: Xcode (iOS) and/or Android Studio, plus the
  [Expo](https://docs.expo.dev) tooling (installed automatically via the app deps)

## First run

```bash
pnpm install

# configure environment
cp artifacts/aforce-os/.env.example artifacts/aforce-os/.env
# then edit artifacts/aforce-os/.env with your Clerk key + API host

# start the Expo dev server
cd artifacts/aforce-os
npx expo start
```

Press `i` for the iOS simulator, `a` for Android, or scan the QR code with the
Expo Go app on a physical device.

## Required environment variables

Set these in `artifacts/aforce-os/.env` (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth (from the Clerk dashboard) |
| `EXPO_PUBLIC_CLERK_PROXY_URL` | Optional Clerk proxy; leave blank if unused |
| `EXPO_PUBLIC_API_BASE` | Base URL of the deployed AForce API server |
| `EXPO_PUBLIC_DOMAIN` | API host (same host as above, without scheme) |

Secrets are **never** committed — `.env` and service-account files are gitignored.

## Type checking

```bash
pnpm run typecheck
```

## Production / store builds (EAS)

The Expo Application Services config lives in `artifacts/aforce-os/eas.json`.
From `artifacts/aforce-os/`:

```bash
pnpm eas:login
pnpm eas:build:ios       # or eas:build:android / eas:build:all
```

## Keeping in sync with the main project

The app and the two libraries are the source of truth in the main AForce
monorepo. Changes made here should be coordinated back so the two stay aligned.
