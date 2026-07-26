# CONTINUITY.md

**Purpose:** the single resume point. No session starts over — every session resumes from this
file + repository evidence. Per the Final Consolidated Implementation Lock §2.

**Last updated:** 2026-07-26 · **Mode:** `/CONTINUITY` + `/AUDIT` (PASS 1 & 2) + `/RECONCILE` +
`/PLAN` + `/BUILD` (safe set) complete on branch `feat/lock-reconciliation`. Gated items remain held.

---

## 1. Branch & commit

| | |
|---|---|
| Branch | `feat/lock-reconciliation` (cut from `fix/smartmodes-water-first`) |
| Lock build commits | `4000791f` Circle label · `60720b6f` Founding 250 (non-frozen) · `c7723f66` Score Protection shadow guard |
| Still uncommitted | prior in-flight working tree (D-08 impl, §39 design, intelligence contracts, demo-build config) + this session's governance docs — **not** part of the 3 Lock commits above. |
| Not pushed | all local; nothing pushed to remote. Never `main`. |

## 2. Last successful migration

**None executed this session.** Schema deployment is **OPEN (R-21)**:
- D-08 `aforce_score_snapshots.hydrostate_model_version` — **in source, not deployed**.
- Stage-2 graph tables (`aforce_graph_nodes`, `aforce_graph_edges`) — **in source, not deployed**.
- Convention: `drizzle-kit push` (no committed migration files, no down-migrations).
- A dev `DATABASE_URL` was later provided; the push was **authorized but never executed** (build/CLI blockers). **Verify DB state before any push.**

## 3. Completed work this session (governance/design — see decision records)

| Item | Status |
|---|---|
| Phases 1–3.7 intelligence governance | Recorded in `governance/` (SPECIFICATION-AUTHORITY, registers, DR-001…DR-009) |
| D-08 HydroState model version (`hydrostate-v0`) | **Implemented in source** (`config/hydroStateModel.ts`, `lib/db/src/scoreSnapshotRepo.ts`, routes migrated). **Not deployed.** |
| §39 Prediction Engine | **Design authorized, implementation GATED** (DR-007/DR-008) — legal + scientific review + schema deploy + success contracts all open |
| Stage-1/2/3 intelligence contracts (event / graph / §42 gate) | **In source, headless, no runtime caller** — Partially Built |
| Demo build config | `demoMode.ts` env-driven; `eas.json` `demo` profile; `app.json` `runtimeVersion → "1.0.0"` |

## 4. Active feature flags

~217 flags in `featureFlags/flags.ts`. **All new `spec_*`, `clutch_*`, `guardian_*`, `cruise_*`,
and `demo_mode_enabled` default `false`.** No public exposure enabled.

## 5. Conflicts — founder-ruled 2026-07-26 (see Reconciliation Register §21)

- **RC-L1 / RC-L4** 5th tab = **Circle**. PASS-2: **label-only** change — route stays `competition.tsx`; set `tabs.competition` ("Community") → **"Circle"** in all locales. **PENDING BUILD**.
- **RC-L3** Can size = **keep 12 oz** → **no change, resolved.**
- **RC-L7** = **Founder 250**. **Docs-only** (no app copy); Constitution/Phase-Roadmap edits need Julius+Brandon. **PENDING BUILD**.
- **RC-L2 / RC-L5 / RC-L8a / RC-L9** — RESOLVED confirmatory (both bands intentional; config versioned; ledger tables append-only; intelligence contracts correctly logged as headless/Partially Built).
- **RC-L8b — OPEN, flagged for `/PLAN` (N-5 / R-29):** Score Protection is **documented-only, not enforced server-side** — the snapshot write trusts client-supplied scores and reads no confirmation gate (`journal.ts:39`, `intake.ts:132`). Real integrity gap; fix = new server write-gate, **needs founder approval**. Does not touch off-limits scoring math.

## 6. Tests (baseline — `governance/TEST-BASELINE.md`)

- Full suite: **46 failed files / 18 failed tests** — all environmental (RN Flow-parse under Vite SSR; `DATABASE_URL` for api-server). **Not regressions.**
- Pure-runner (real logic): green. This session added: D-08 (23), intelligence contracts (34), graph (54), §42 gate (62) — all passing.
- **Criterion for a NEW failure:** anything outside the two known signatures, or the pure-runner set dropping. See baseline doc §5.

## 7. Open operational items (non-governance)

| Item | State |
|---|---|
| iPhone TestFlight crash (build 41) | expo-updates error-recovery crash on launch; still crashes offline → in the build. Deferred by founder. Next: fresh build to test `runtimeVersion` fix. |
| Android demo APK | Build path set (`demo` profile); not confirmed installed. |
| DB deployment (R-21) | Authorized, not executed. |

## 8. EXACT NEXT SAFE ACTION

Safe set is built and committed (see §1). **Remaining held/gated work — needs founder action:**
1. **BUILD-2b — Founding 250 in frozen docs** (`AForce-Constitution.md:73,91`, `Phase-Roadmap.md:17`).
   Blocked on **Julius + Brandon** sign-off. Until then the phase rename is incomplete.
2. **BUILD-3B — Score Protection enforce mode.** Blocked on (a) **R-21** DB deploy for nullable
   provenance columns, and (b) client attaching provenance to `POST /journal/snapshot`. Do NOT flip
   `SCORE_PROTECTION_MODE=enforce` in prod until the **5-item Phase 3B pre-flight** in Reconciliation
   Register §21 is done: (1) confirm prod `NODE_ENV=production` or invert the default, (2) add
   `(userId, loggedAt)` index for evidence lookups, (3) enforce-path integration tests, (4) make the
   enforce path fail-closed (not silently fail-open), (5) wire `sensors.ts`. Source: PR #377 review.
3. **Observe 3A shadow logs** once deployed — confirm real client traffic before enforcing.
4. **In-screen "Circle" rebrand** (optional) — list `community.*` headings for a go/no-go.

Governing order (Lock §3): `/CONTINUITY → /AUDIT → /RECONCILE → /PLAN → /BUILD`. **Safe set done;
next actionable step is a founder decision on 2b / 3B, or merging `feat/lock-reconciliation`.**

## 9. AUDIT coverage (honest — PASS 1 & 2 complete)

| Verified against code | Not yet deep-audited (future, non-blocking) |
|---|---|
| Navigation / tabs + label wiring | §10 consumption state machine end-to-end |
| Both band systems (4-band + 5-band) | §26 provider capability↔actual-access matrix |
| Can-size language | §30 entitlement single-source-of-price |
| Integrations present | Security / privacy / a11y / perf suites |
| Flag count | |
| Schema table count | |
| Append-only ledger tables (RC-L8a) | |
| Score Protection write path (RC-L8b) | |
| Intelligence-contract runtime wiring (RC-L9) | |

**PASS 1 & 2 done; not exhaustive.** Screens, mocks, and comments do not count as working
features (Lock §2).
