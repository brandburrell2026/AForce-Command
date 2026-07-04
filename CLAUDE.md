# AForce OS — Project Rules for Claude Code

This is a **pre-launch production repository** for AForce Hydration, Inc. It is not a prototype. Treat all code, data, and configuration as production-grade. Read these rules at the start of every session and follow them without exception.

## Governance — read before building

The AForce OS governing documents live in `governance/` (mirrored in `artifacts/aforce-os/governance/`). Read them before building features:

- **`AForce-Constitution.md`** — locked v1.0 principles (body first, product last; observation never diagnosis; trust over attention). Frozen — no new principles without Julius + Brandon approval and beta evidence.
- **`Claude-Code-Build-Rules.md`** — the build contract: one numbered section at a time, tested; `/governance` first; thresholds in `config/hydroStateModel.ts`; no new nav or rebuilds.
- **`Architecture-Appendix.md`** (Sections 1–64 with Status tags) and **`Phase-Roadmap.md`** (Phases 0–4) — what is Build Now vs. later phases.
- Compliance is governed by `docs/COMPLIANCE_FRAMEWORK.md` (app copy in `artifacts/aforce-os/legal/`).

## Working agreement

- **Never push or commit directly to `main`.** Work only on the current feature branch.
- **Explain your plan before making changes.** Wait for confirmation before large or structural edits (e.g., refactors, new shared files).
- Commit in small, logical units with clear messages. Do not bundle unrelated changes.
- If a task appears to require touching anything in **Off-Limits** below, **stop and flag it** for the founder to decide. Do not proceed.

## Off-limits — do not modify without explicit approval

- **Scoring engine:** `scoringEngine.ts` and `statusColor.ts` are the source of truth. Do not change scoring math, band definitions, or status-color mapping.
- **Domain config:** `EXPO_PUBLIC_DOMAIN`, the api-server URL, and anything tied to the published `replit.app` domain. The mobile build depends on these being exact.
- **Deployment / publishing:** deployment type, publishing config, unpublish/republish. The founder handles these separately.
- **Secrets:** never print, log, copy, export, or commit any secret value (Stripe, Clerk, database, API keys). Confirming a variable *exists* is fine; revealing or moving its value is not.
- **Database data:** no destructive operations; never copy dev data into production.

## Brand system v2.1.0 (canonical — conform to this, do not invent)

Colors:

| Token            | Value     | Usage                         |
|------------------|-----------|-------------------------------|
| Cinematic Black  | `#0D0D0D` | Primary background            |
| Signal Red       | `#C1281B` | Accent / brand mark           |
| Bone             | `#F5F0E8` | Light surface / text on black |
| Soursop Green    | `#1FA35A` | Status / positive states      |
| Berry Blue       | `#1E5BFF` | Secondary accent              |

Typography:

- **Archivo Black** — display
- **IBM Plex Mono** — data / numerics
- **Inter** — body

Brand mark: the **N–N monogram** — left N forward, right N mirrored via `scaleX(-1)`, separated by a Signal Red divider. Appears on app icon, splash, and in-app hero.

When enforcing brand colors, if a change appears to require editing `statusColor.ts`, that file is off-limits — flag it instead of editing.

## Stack reference

- Frontend: Expo / React Native (EAS for iOS builds)
- Backend: Node.js on Replit
- Data & services: Drizzle ORM (Postgres), Clerk (auth), Stripe (payments), ElevenLabs (voice), OpenWeather
- Monorepo managed with pnpm workspaces
