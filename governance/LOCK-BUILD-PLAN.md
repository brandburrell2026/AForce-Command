# Final Consolidated Implementation Lock — Build Plan

**Status:** APPROVED 2026-07-26 · **safe set (BUILD-1, 2a, 3A) BUILT & committed** on branch
`feat/lock-reconciliation`. **BUILD-2b and 3B remain GATED** (see below).
**Created:** 2026-07-26 · Follows `/CONTINUITY → /AUDIT (PASS 1+2) → /RECONCILE`. Source of truth
for conflicts: [Reconciliation Register §21](SPECIFICATION-RECONCILIATION-REGISTER.md).

**Founder decisions applied:** build safe set now · "Circle" = English brand term (all 11 locales) ·
tab-label-only scope · Phase 1 renames to "Founding 250". **Build results:** `4000791f` (Circle),
`60720b6f` (Founding 250 non-frozen), `c7723f66` (Score Protection shadow guard, 12 tests).

Principles honored: additive · reversible · flag-gated · small logical commits · off-limits
respected (`scoringEngine.ts`, `theme/statusColor.ts`, domain/api URL, deployment, secrets) ·
score math untouched · never fake score movement.

---

## Step 0 — Branch & commit hygiene (before any build)

The working tree has ~119 uncommitted files (this session's governance/audit artifacts + prior
in-flight work). Before building:

- Commit the **governance/audit artifacts** (`CONTINUITY.md`, register, docs) as one clear
  `docs(governance):` commit — separate from any build code.
- Confirm the branch. We are on `fix/smartmodes-water-first`. **Decision D-d:** continue here, or
  cut a fresh `feat/lock-reconciliation` branch off it. **Never `main`.**

---

## BUILD-1 — "Circle" tab rename  *(low risk · label-only)*

**Scope:** the 5th tab currently renders label `tabs.competition` = "Community". Set it to
**"Circle"**. Route file **stays** `app/(tabs)/competition.tsx` (deep-link stability). Competition
domain (types/engine/`CompetitionScreenV2`) unchanged — it is the content *inside* Circle (§22).

**Change-sites (11 locale files):** `locales/{ar,de,en,es,fr,hi,it,ja,ko,pt,zh}.json` → key
`tabs.competition`.

**Open decisions:**
- **D-a — localization:** is "Circle" a **brand term kept in English** across all 11 locales, or
  **translated** per language (matching how "Community" is localized today in de/es/fr/it/pt)?
- **D-b — scope of rename:** tab label **only**, or also the in-screen `community.*` headings
  (`en.json:1842` title "Community", `:1871` "COMMUNITY MAPS", etc.)? Default = **tab label only**;
  I will list every in-screen "Community" string for a separate go/no-go before touching it.

**Test:** i18n key-parity test (all locales have `tabs.circle`/updated value); visual tab-bar check.
**Rollback:** revert locale edits. **Commit:** `i18n(circle): rename 5th tab label to Circle`.

---

## BUILD-2 — "Founder 250" count  *(docs-only)*

**Scope:** "Founding 200" exists in **zero app code** — only governance/docs. Update to **250**.

**Split by risk:**
- **BUILD-2a (non-frozen docs — proceed on approval):** `governance/FEATURE-PHASE-MATRIX.md:119`,
  `governance/Learning-Journal.md:5`, `docs/PRIVACY-COMPLIANCE-VALIDATION.md:104`,
  `docs/design/PHASE3-I-MIGRATION-ROLLBACK.md:55`.
- **BUILD-2b (FROZEN — hold):** `governance/AForce-Constitution.md:73,91`,
  `governance/Phase-Roadmap.md:17` (Phase 1 is literally *named* "Founding 200"). Per the
  Constitution's own terms, these edits need **Julius + Brandon** sign-off. **I will not touch them
  until you confirm that sign-off.**

**Open decision — D-c:** does **Phase 1 itself rename** from "Founding 200" to "Founding 250"
(a phase-name change that must stay consistent across all docs), or is 250 only the member count?

**Test:** `check:governance` drift script still green. **Rollback:** revert. **Commit(s):**
`docs(governance): Founding count 200 → 250 (non-frozen)`; 2b separate, after sign-off.

---

## BUILD-3 — Score Protection server-side write gate  *(higher risk · phased · flag-gated)*

**Problem (RC-L8b / N-5 / R-29):** the score-snapshot write path trusts client-supplied scores and
reads **no** confirmation gate — the "only verified completed behavior moves the score" guarantee is
documented, not enforced. Evidence: `journal.ts:39` writes any 0–100; `intake.ts:132` mutates
score-input counters from an unverified request; `aforce_confirmations` is written but never read as
a gate.

**Design — additive, does NOT touch score math** (only the *write gate* on the server):

### Phase 3A — Shadow / report-only  *(safe · independent · do first)*
- New `artifacts/api-server/src/lib/scoreWriteGuard.ts`: validates each snapshot write for
  **provenance** (is there a linked verified event — a confirmation or intake log for this user?) and
  **plausibility** (delta vs prior snapshot). On violation it **logs a structured warning + analytics
  event but still writes** — zero behavior change.
- Wire at the `repo.create` boundary in `routes/aforce/journal.ts` and `sensors.ts`.
- Mode via env `SCORE_PROTECTION_MODE` = `off | shadow | enforce`, **default `shadow` in dev, `off`
  in prod**. (Env only — not a domain/secret; not off-limits.)
- **Outcome:** we learn what clients actually send before rejecting anything.

### Phase 3B — Enforce  *(gated — do NOT start until 3A evidence + dependencies clear)*
- Flip to `enforce`: reject writes lacking a verified-event link or showing implausible deltas;
  return a clear error (client already falls back to built-in default state).
- **Dependencies (both currently blocking):**
  1. **Schema:** add **nullable** `source` + optional `confirmation_id` to `aforce_score_snapshots`
     (additive, safe `drizzle-kit push`) — but DB deploy is **R-21 blocked** (no reachable DB).
  2. **Client:** the RN app likely must **attach provenance** to `POST /journal/snapshot`
     (react-native-engineer work) — enforcement without it would reject legitimate writes.

**Risk:** medium. **Mitigations:** shadow-first, flag-gated, nullable schema, score math unchanged,
client fallback exists, rollback = flag → `off`.
**Test:** unit tests for guard (valid passes; unverified flagged in shadow / rejected in enforce);
existing route + parity tests stay green.

---

## Proposed order & gates

| # | Item | Risk | Blockers | Needs founder decision |
|---|---|---|---|---|
| 0 | Branch/commit hygiene | none | — | D-d (branch) |
| 1 | Circle tab label | low | — | D-a (localize?), D-b (scope) |
| 2a | Founding 250 — non-frozen docs | low | — | D-c (phase rename?) |
| 3A | Score Protection — shadow guard | low | — | approve rollout approach |
| 2b | Founding 250 — Constitution/Roadmap | low | **Julius + Brandon sign-off** | confirm sign-off |
| 3B | Score Protection — enforce | med | **R-21 DB deploy + client provenance** | approve after 3A |

**1, 2a, 3A are safe to build immediately on approval.** 2b and 3B are gated on the blockers above.

**Nothing is built until you approve this plan.**
