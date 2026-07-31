# Claude Code Session Brief — AForce OS, Part A (Sections 18–20)

You are implementing **Part A of the AForce OS V1 architecture**: the Adaptive Profile Engine. The full spec is at `docs/AFORCE_OS_ARCHITECTURE_V1.md` — read it before writing code. This brief is the operating contract for THIS session.

## Scope (this session only)
- **Section 18** — Adaptive Profile Engine™ / Profile Versioning™ (data model + versioning + recalibration trigger)
- **Section 19** — Performance Profile™ onboarding fields
- **Section 20** — Body Recalibration Engine™

Nothing else. Do not start Part B (HydroState signals), HydroScan, sharing, or any later section.

## Hard constraints — do not violate
1. **Branch only.** Work on `feat/adaptive-profile-engine`. Never commit to `main`. Never push to `main`.
2. **Off-limits files — never edit:** `scoringEngine.ts`, `statusColor.ts`, any secrets/env files, any DB data/migrations that mutate existing rows. If a change seems to require touching these, STOP and explain why instead.
3. **One section at a time.** Fully implement + test Section 18, confirm with me, THEN move to 19, then 20. Do not batch all three.
4. **All thresholds/formulas live in `config/hydroStateModel.ts`.** No hardcoded numbers in engine logic. If the file doesn't have a needed value, add it there and reference it.
5. **Historical data is append-only.** Profile versions and baselines are NEVER overwritten or deleted. Recalibration creates new records and affects FUTURE recommendations only. Existing HydroState/Performance Memory records keep their original `profileVersionId`/`baselineVersionId`.
6. **Camera / Section 25 is OUT OF SCOPE and stays feature-flagged OFF.** Do not scaffold, import, or reference camera capture. Skin Performance Intelligence is not part of Part A.
7. **No new navigation tabs.** Profile Update lives inside the existing Profile/Account area.
8. **Never compare users to other users or population averages.** Frame all recalibration as performance optimization, not correction.

## What "done" looks like for each section

### Section 18 — Adaptive Profile Engine™
- Data model: `UserProfile`, `ProfileVersion`, `BaselineVersion`, `ProfileChangeLog` (extend existing tables if present; do not destructively migrate).
- A major-variable change (weight, height, age bracket, sex, activity level, training level, performance goal, home climate, significant sleep-schedule change, sweat classification, connected wearables) creates a NEW `ProfileVersion`. Minor preference edits do NOT.
- Every new HydroState and Performance Memory record stamps the active `profileVersionId` and `baselineVersionId`.
- Recalibration: archive previous baseline, begin new baseline, temporarily lower confidence, raise it as observations accumulate.
- Evidence Engine emits a human-readable explanation string for every recalibration (use the spec's example phrasing as the template).
- Confirmation copy shown on save (per spec).

### Section 19 — Performance Profile™
- Onboarding/profile fields added: Training Level (Beginner/Active/Advanced/Elite), Primary Goal (the 7 listed), Current Weight, Goal Weight, Height, Age, Typical Workout Duration, Typical Sweat Level, Occupation.
- These feed Personal Baseline™. No new nav.

### Section 20 — Body Recalibration Engine™
- On physical change, recalculate (future only): daily hydration target, electrolyte recommendation, recovery timing, recheck intervals, environmental modifiers.
- Historical records unchanged. All math reads from `config/hydroStateModel.ts`.

## Workflow for this session
1. Read `docs/AFORCE_OS_ARCHITECTURE_V1.md` (at least Part A + Core Principles).
2. Create branch `feat/adaptive-profile-engine`.
3. Propose the Section 18 data model + file plan as a DIFF for my review BEFORE writing it broadly.
4. I review the diff → you implement → run tests → show me results.
5. On my confirmation, proceed to 19, then 20.
6. Do not refactor completed/working architecture unless a later section strictly requires it (and flag it if so).

## When unsure
Stop and ask. A blocked question is cheaper than an off-spec implementation or a touched off-limits file. Do not "fix" things outside scope. Do not enable anything camera-related.

Performance Is Non-Negotiable.

## Greenfield note (confirmed before session)
- There is NO existing `config/` directory and NO `config/hydroStateModel.ts`. Section 18 creates `config/hydroStateModel.ts` fresh as the single home for all thresholds/formulas. Do not search for a pre-existing one.
- There is NO existing profile table/model. Section 18 creates `UserProfile`, `ProfileVersion`, `BaselineVersion`, `ProfileChangeLog` new. Additive only — does not migrate or alter existing tables.
