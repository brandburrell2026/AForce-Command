# Engineering Architecture

**Status:** Canonical (tier 4) · **Updated:** 2026-07-22

Stack, module layout, and the engineering rules that govern how intelligence code is written.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Client | React Native / Expo (Expo Router), EAS for iOS builds |
| Server | Node.js, Express 5 |
| Database | PostgreSQL via Drizzle ORM |
| Auth | Clerk — email/password + Google SSO; JWT `Authorization: Bearer` (REST), `?token=` (WebSocket) |
| Payments | Stripe via `stripe-replit-sync`; webhook secret from the managed connector, not an env var |
| Real-time | WebSocket on the shared server (`/api/aforce/ws`), periodic heartbeats |
| Environment | OpenWeather, server-proxied, ~10-minute TTL cache |
| Voice | ElevenLabs (`eleven_turbo_v2_5`), static phrases cached; Expo Speech fallback |
| Monorepo | pnpm workspaces |

**Bundle IDs:** iOS `com.aforce.os` · Android `com.aforce.os`.

## 2. Workspace layout

```
artifacts/
  aforce-os/        React Native app  — client, engines, surfaces
  api-server/       Express + Postgres
  aforce-site/      Marketing site
  aforce-command-center/, aforce-pitch/, aforce-os-engine/, …
governance/         SOLE authoritative governance source
docs/               Canonical specifications (tier 4) + legacy (tier 5)
lib/, scripts/
```

## 3. Intelligence module layout

The established pattern — **pure logic in `utils/`, persistence in `services/`**:

```
artifacts/aforce-os/
  utils/intelligence/     pure, RN-free engines (livingPerformanceModel, adaptiveResponseEngine, …)
  utils/confidence/       confidence, freshness, signal quality
  utils/scoring/          score breakdown + resolveState
  utils/scoringEngine.ts  OFF-LIMITS
  theme/statusColor.ts    OFF-LIMITS
  services/               app-layer persistence (AsyncStorage), API clients
  config/hydroStateModel.ts   ALL thresholds
  featureFlags/flags.ts   phased exposure
  types/                  shared types
```

New §38–42 modules follow this exactly. Placement is specified in
`governance/INTELLIGENCE-MIGRATION-PLAN.md`; **none of it is implemented** — Phase 2 was
documentation-only.

## 4. Engineering rules for intelligence code

| # | Rule | Why |
|---|---|---|
| 1 | **Pure and RN-free** (type-only imports) | Runs under the vitest pure runner |
| 2 | **Persistence never in the pure util** | Keeps engines testable and deterministic |
| 3 | **Adapter-wrap, never rebuild** | Three Tier-1 engines already exist and are tested |
| 4 | **All thresholds in `config/hydroStateModel.ts`** | Build Rule 13 |
| 5 | **Score Protection** — no reducer dispatch, no score mutation | Constitutional |
| 6 | **Flag-off short-circuit before any read** | Production byte-identical while dark |
| 7 | **No new tabs, no navigation change** | Build Rule 14 |
| 8 | **One numbered section at a time, tested** | Build Rules 2, 3 |

## 5. Known engineering hazards

Documented failure modes that new code must avoid — each was paid for once already:

| Hazard | Rule |
|---|---|
| **Boot-hydration clobber** | An append must defer its storage write until after boot-hydration has read original storage. Never force `hydrated=true` on append. |
| **Resurrection after clear** | `clear()` must bump a generation counter and null the in-flight hydrate promise, so a late hydrate abandons its merge. |
| **Recorder loops** | An effect that both reads `ledger.events` and appends must guard on **both** a freshest-state existence check and an in-flight latch keyed by the dedupe key. Append always returns a fresh array and notifies even on a content no-op. |
| **Day-index normalization** | Voice check-ins use local-calendar day index; Performance Age snapshots use UTC floor. Preserve round-trip; do not unify. |
| **Adapter compounding** | Adaptive engine-output adapters stretch relative to their input and must always receive a fresh, un-adapted base — never a stored or already-adapted one. Apply once, at the seam. |
| **Confidence contamination** | Adherence/follow-rate is deliberately **not** fed into Command Confidence — wiring it would let follow-rate silently upgrade confidence, a Score-Protection breach. |

## 6. Testing

Vitest, `environment: node`, with an `@/` alias mirroring the app's tsconfig path. Pure-runner
globs cover `utils/`, `services/`, `store/`, `hooks/`, `analytics/`, `featureFlags/`, `data/`,
`theme/`, `components/ui/`, plus `api-server` and `aforce-site`.

Required tests per intelligence system: `governance/INTELLIGENCE-VALIDATION-MATRIX.md`.

## 7. Build and release

- **EAS Build** profiles: `development`, `preview`, `production`.
- Build: `pnpm eas:build:ios` · `:android` · `:all` · `:preview` from `artifacts/aforce-os/`.
- Submit: `pnpm eas:submit:ios` (ASC App ID + Apple Team ID via `eas-configure-submit`) ·
  `pnpm eas:submit:android` (Google Play service-account JSON, never committed).
- Store screenshots must come from a real device or simulator build.
- `EXPO_PUBLIC_DOMAIN`, the api-server URL, and published-domain configuration are **off-limits**
  without explicit approval.

## 8. Governance tooling

`scripts/src/check-governance-drift.mjs` enforces Founder Decision 3: `/governance/` is the sole
authoritative source, `artifacts/aforce-os/governance/` must remain a pointer only, and the one
sanctioned duplicate (`COMPLIANCE_FRAMEWORK.md`) must stay byte-identical.
