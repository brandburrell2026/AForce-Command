---
name: AForce Command Center (founder cockpit)
description: The founder-gated WEB dashboard artifact — isolation, gate, Clerk-version pitfall, Score-Protection projection.
---

# AForce Command Center — founder cockpit (web artifact)

A separate **browser web** artifact (`artifacts/aforce-command-center`, react-vite) for the founders (Julius + Brandon). NOT mobile — the mobile nav lock does not apply to it. Six dashboard tabs (Executive, Product, AI, Marketing, Board, Guardian); only Executive is wired to real data, the rest are honest placeholders pending instrumentation.

## Isolation (lock)
**Why:** internal founder analytics must never ship in the consumer surface.
**How to apply:** the cockpit has its OWN local typed fetch client + react-query hooks (`src/lib/commandCenter.ts` + `queryClient.ts`); it must NOT depend on the shared consumer `@workspace/api-client-react`, and the founder endpoints must NOT enter the consumer OpenAPI spec. The server route is hand-written like other admin routes and validated with LOCAL zod.

## Founder gate
`requireFounder` (api-server middleware) admits **exactly** `super_admin` (NOT `requireRole(...)` — its min-rank semantics would admit plain `admin`) AND, when `FOUNDER_EMAILS` (comma-sep, case-insensitive) is configured, an allow-list match. Empty allow-list ⇒ super_admin alone suffices (locked, never hard-bricked). Pure helpers `parseFounderAllowList` / `isFounderAllowed` are unit-tested. Web auth is **cookie-based** Clerk (`credentials: "include"`) — never Bearer/getToken.

## Clerk version pitfall (cost real time)
**Why:** the `clerk-auth` skill template imports `publishableKeyFromHost` from `@clerk/react/internal` (and `@clerk/shared/keys`), but the repo's catalog-pinned `@clerk/react@6.4.3` / `@clerk/shared@4.8.3` (locked to stay consistent with `@clerk/expo` + React 19.1.0 — never bump react past 19.1.0) do NOT export it; `@clerk/shared` has no `./keys` subpath either.
**How to apply:** for web Clerk in THIS repo, read `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` directly and still pass `proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL}` unconditionally. The host-mapping helper only matters for multi-custom-domain builds; a single-domain founder tool doesn't need it. Do not chase the skill's verbatim import — it targets a newer Clerk.

## Score-Protection projection
Every metric is a real server aggregate or an explicit null → empty/"awaiting instrumentation" state. The pure `buildDailyFive` returns `null` for zero-denominator rates and missing score windows; the UI renders empty states for those nulls. Activations show a real `0` (count aggregate), not a fabricated value. Nothing in the cockpit awards/inflates score.

## Retention Gates (Product tab)
The owner's 5-gate funnel scorecard lives on the **Product** tab. Pure helper `api-server/src/lib/retentionGates.ts` (`buildRetentionGates` → `RetentionGatesSchema`) turns scalar SQL aggregates into the gate DTO; route `GET /admin/command-center/retention-gates` (in `commandCenterAdmin.ts`, `requireFounder`) runs 4 aggregate-only queries over `aforce_analytics_events`; client `aforce-command-center/src/lib/retentionGates.ts` + `pages/ProductDashboard.tsx` render it.
- Gates: G1 App Open→Profile (≥80% rate), G2 Profile→First Command (median ≤60s, duration kind), G3 Day1→Day7 (≥40%), G4 Day7→Day30 (≥25%), G5 QR Scan→Activated (≥50%). Status: `gte` for rate gates, `lte` for the duration gate; exactly-on-target = passing; converted clamped ≤ entered.
- **Honesty/Score-Protection:** a gate with an empty cohort (denominator 0, or duration median null) is `status:"awaiting"` + `measured:null` — NEVER a fabricated 0%.
- **Source-of-truth decision:** all 5 gates read from `aforce_analytics_events` canonical funnel events (`qr_scanned`/`app_opened`/`profile_completed`/`first_command_completed`), NOT user-table proxies (real-but-wrong retention would violate Score-Protection). **Why:** the events table is EMPTY in Phase 1 → every gate honestly reads "awaiting instrumentation" and lights up automatically once the event pipeline lands. **How to apply:** when wiring future cohort metrics here, prefer the empty analytics-events stream over a convenient-but-misleading user-table proxy.
