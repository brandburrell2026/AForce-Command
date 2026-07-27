# CONTINUITY.md

**Purpose:** the single resume point. No session starts over — every session resumes from this
file + repository evidence. Per the Final Consolidated Implementation Lock §2.

**Last updated:** 2026-07-26 (PASS-3 complete) · **Mode:** Lock sequence `/CONTINUITY → /AUDIT (PASS
1+2) → /RECONCILE → /PLAN → /BUILD (safe set)` complete and merged; plus same-day commerce
verification, a production-pipeline incident (found + fixed), and config restoration. Later Lock
modes (`/REDTEAM /SECURITY /PRIVACY /GLOBAL /ACCESSIBILITY /PERFORMANCE /TEST /SHIPGATE`) have
**not** run.

---

## 1. Branch & commit

| | |
|---|---|
| Branch | `main` (current, in sync with origin) — plus `preview-e2e` (kept: re-testable Vercel preview alias) |
| Merged today | #377 Lock reconciliation · #378→#381 hero swap + founder-ordered restore · #379 standalone-Command cleanup · #380 Command billing IDs + auto-renew disclosure · #382 Railway build fix · #383 demo-build config restore |
| Branch hygiene | 128 → 2 local branches; all others merged or archived on origin |

## 2. Migrations & schema state

- **PRODUCTION DB (Railway): `aforce_score_snapshots.hydrostate_model_version` ADDED 2026-07-26**
  (founder-run `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, per the D-08 runbook). D-08 stamping code
  deployed same day → new snapshots stamp `hydrostate-v0`. Final end-to-end proof = first organic
  row showing the stamp (SELECT in §7).
- **Dev DB deploy (R-21 dev side):** still unexecuted (no `DATABASE_URL`).
- ⚠️ **Stage-2 graph tables (`aforce_graph_nodes`/`aforce_graph_edges`) are NO LONGER IN SOURCE** —
  they were uncommitted schema edits destroyed by the 2026-07-26 `reset --hard` incident (see §6).
  Recoverable from `governance/STAGE-2-GRAPH-SCHEMA-DEPLOYMENT-RUNBOOK.md`. Same for the
  `sensors.ts` D-08 repo migration (main's `sensors.ts` still direct-inserts; compiles fine).

## 3. Completed this cycle (all merged to main, statuses truthful)

| Item | Status |
|---|---|
| Circle tab label, 11 locales (RC-L1) | Public Live (label); Circle content vision Partially Built |
| Founding 250 — non-frozen docs (RC-L7) | Done; frozen docs HELD for Julius + Brandon (BUILD-2b) |
| Score Protection shadow guard (RC-L8b 3A) | Partially Built — journal path only, shadow, off-in-prod by default |
| D-08 model-version stamping | **Public Live** (code on Railway + prod column) |
| Standalone Command shop cleanup | Public Live (revenue-guardian approved) |
| Command billing IDs + #osRenew disclosure | Public Live in code; **checkout gated** (see §5) |
| **Command cart E2E** | **VERIFIED 2026-07-26** — gates 1 (404) / 2 (503) / 3 (real cartCreate) all passed; both plans confirmed applied at $20.00/mo and $200.00/yr; checkout host allowed. Closes PR #380 review condition B |
| Demo-build config (runtimeVersion 1.0.0, `demo` EAS profile, env-driven DEMO_MODE) | Restored on main; next iOS build will test the TestFlight crash fix |
| Hero | Founder-ordered restore of the cinematic video — live on drinkaforce.com |

## 4. Active feature flags

~217 in `featureFlags/flags.ts`; all `spec_*`/`clutch_*`/`guardian_*`/`cruise_*` false.
`SCORE_PROTECTION_MODE` env: unset (= shadow in dev, **off in prod** until 3B pre-flight).
`SHOP_PREVIEW_ENABLED`: **Preview-scope only** (founder's standing rule) — production checkout
deliberately cannot transact until cutover.

## 5. Open decisions & conflicts

- **Cutover blocker — displayed ≠ charged (Ritual plan 2501607542):** founder ruled 2026-07-26
  "keep this pricing for now" → plan charges FULL $59.99/$29.99 while the shop displays
  $53.99/$26.99 "Save 10%". Harmless while checkout is gated; **must resolve before
  `SHOP_PREVIEW_ENABLED` reaches Production** — either add the 10% recurring policy or change the
  shop copy. (Today's 10%-policy attempt never appeared on the storefront.)
- **RC-L3 addendum:** ruling = keep 12 oz, but the hero can *artwork* (video-era and the retired
  static image) reads **11 FL OZ (325 ml)** — final approved label needed to close.
- **BUILD-2b:** Founding 250 in `AForce-Constitution.md` + `Phase-Roadmap.md` — Julius + Brandon.
- **BUILD-3B:** Score Protection enforce — 5-item pre-flight in Register §21; do not enforce in
  prod until done.
- Counsel nod on Command renew/cancel copy (recommended before heavy promotion).

## 6. Incident record (2026-07-26) — resolved, lessons memorialized

PR #377 shipped `journal.ts` importing never-committed files (typecheck ran against a dirty tree)
→ every Railway deploy 11:26–13:0x failed (prod served last good build; no outage). Compounding: a
`reset --hard origin/main` during the #377 retarget destroyed all uncommitted tracked changes
(D-08 lib/schema edits, demo-build config). Fixed by #382 (missing deps, verified with zero
untracked files in affected packages) + #383 (config restore). Remaining loss: §2's graph tables +
sensors migration. Guardrails recorded in project memory.

## 7. Tests & verification

- Baseline unchanged (`governance/TEST-BASELINE.md`): RN Flow-parse + DATABASE_URL failures are
  environmental, not regressions.
- Touched-path suites green at merge: scoreWriteGuard 12 · scoreSnapshotRepo 19 · version parity 4
  · journal schema 6 · conversational/voice (Section 64) 38.
- D-08 organic-row check (founder, any time):
  `SELECT id, score, hydrostate_model_version, captured_at FROM aforce_score_snapshots ORDER BY captured_at DESC LIMIT 5;`
  → new rows should read `hydrostate-v0`.

## 8. EXACT NEXT SAFE ACTION

**PASS-3 BUILD SLICES 1–4a COMPLETE (2026-07-26, PRs #387–#390 merged).** Slice 1 provider honesty (RC-L13) · Slice 2 profile hydration+encrypted cache behind profile_server_hydration_enabled=OFF (RC-L11) · Slice 3 intake corrections+online dedupe+honesty columns, schema source-only (RC-L12) · Slice 4a Command $20/mo unification, internal id stays athlete (RC-L14/D-1).

SLICE 4a+4b REVIEWED (revenue-guardian, 2026-07-26): FIX-FIRST defect (cadence-unaware price lookup → cross-cadence mischarge) FIXED in PR #393 (lookup pinned to exact amount+interval, fail-safe fallback; annual parity assertion added). GATE CLEARED (founder Stripe audit 2026-07-26) → cadence picker SHIPPED (PR #398): explicit $20/mo vs $200/yr choice, no silent cadence, web fallback. PASS-3 slices 1,2,3,4a,4b ALL COMPLETE. Slice 4c (Shopify webhook→entitlement bridge) is the sole remaining build item — gated on founder registering the Shopify subscription webhook + secret into Railway env, then full revenue-guardian gate.

INCIDENT RECOVERY COMPLETE (PRs #395, #396): graph tables restored; Stage 1-3 intelligence layer (15 files, 150 tests) LANDED from untracked; DR-005/DR-003 constants reconstructed and behaviorally verified. App typecheck fully clean. All reset-hard losses repaid. Remaining solo-executable work: none — every open item is founder-gated (Stripe audit, Shopify webhook config, device reinstall gate, schema deploys R-21, RC-L10, BUILD-2b, 11oz).

NEXT SAFE ACTIONS: (1) slice-2 release gate — physical-device reinstall test, then flip the flag; (2) deploy slice-3 intake columns (runbook pattern: dev then prod ALTER); (3) slice 4b $200/yr annual Stripe option; (4) slice 4c D-2 Shopify-webhook entitlement bridge — needs founder Shopify webhook config + revenue-guardian gate; (5) Stage-2 graph-tables restore from runbook; (6) Undo UI + intake_corrections_enabled flag. Founder standing items: RC-L10 pricing display, BUILD-2b sign-off, 11 oz label ruling.

## 9. AUDIT coverage (honest)

| Verified against code/live systems | Not yet audited |
|---|---|
| Navigation + labels · band systems · flags · schema | §33 security program · §34 a11y/perf suites |
| Append-only ledgers · score-write path (→3A) | §36 full test matrix · §38 deliverables 3–15 |
| Intelligence contracts (headless, honest) | Lock §§11–25, 27–29 (engines/content sections) |
| Commerce cart pipeline (live E2E, both plans) | |
| **§7 profile survival (PASS-3 → RC-L11)** | |
| **§10 consumption machine (PASS-3 → RC-L12)** | |
| **§26 provider capability↔access (PASS-3 → RC-L13)** | |
| **§30 entitlement/pricing (PASS-3 → RC-L14/L15)** | |

Screens, mocks, and comments do not count as working features (Lock §2).
