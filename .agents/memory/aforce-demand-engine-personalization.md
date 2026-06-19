---
name: AForce hydration personalization home
description: Where profile/lifestyle personalization must live in AForce OS so it never violates Score-Protection.
---

# Where hydration personalization belongs

**Rule:** Profile/lifestyle personalization (caffeine, occupation, frequent-traveler, body model) belongs in the **hydration DEMAND engine** (target-side: pure, additive, capped) plus **non-scoring personalization chips**. It must NEVER feed the live score path.

**Why:**
- The live score is a **per-event points engine** (`computeEventImpact` in `services/hydrationScoreService.ts`, consumed by `services/realApi.ts` + `utils/scoring/breakdown.ts`). Only *completed behavior* moves it (Score-Protection lock).
- BOTH `utils/hydrationScore.ts::calculateDailyWaterTarget`/`getHydrationScore` AND the demand engine (`lib/demand-engine`, re-exported via `services/hydrationDemandEngine.ts`) are **DORMANT** — no non-test callers; the demand engine is flag-gated (`spec_demand_engine`, OFF in prod). This dormancy is not obvious from a quick read; it took tracing callers to confirm. Don't assume `calculateDailyWaterTarget` is the live target just because the name fits.
- Static self-reported fields (a profile setting) are not behavior, so they can only raise *demand/target*, never score.

**How to apply:** When asked to "personalize hydration" against profile fields, wire into the demand-engine target (additive adder, capped — e.g. lifestyle adder capped at 18 oz) and `utils/personalizationSignals.ts` chips (explicit values only, pushed last so physiological signals keep the top-3). Do NOT touch `hydrationScoreService`, `realApi`, `utils/scoring/breakdown.ts`, or `calculateDailyWaterTarget`. Keep the demand engine release-gated until product enables it. Optional profile fields must stay optional end-to-end (don't gate onboarding "Continue" on them).
