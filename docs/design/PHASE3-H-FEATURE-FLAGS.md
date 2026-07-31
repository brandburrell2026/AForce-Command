# Phase 3 · H — Feature-Flag Design

**Status:** DESIGN ONLY — **no flags created.** `featureFlags/flags.ts` is unchanged.
**Updated:** 2026-07-22

**All new public exposure defaults to disabled.**

---

## 1. Rules

| # | Rule |
|---|---|
| 1 | **Every new flag defaults `false`.** No exceptions. |
| 2 | **Strict flag-off short-circuit** — return *before* any ledger read, storage read, network call, or clock access. Production stays byte-identical while dark. |
| 3 | **Flag off ⇒ no storage key.** Per the intake-outbox precedent, a null storage key makes every persist/hydrate/clear a no-op — no orphaned state accumulates while dark. |
| 4 | **Backend flags are separate from surface flags.** A backend flag enables derivation; a surface flag enables display. Founder Decision 1: never exposed merely because the backend exists. |
| 5 | **One flag per surface**, so exposure advances one approved step at a time. |
| 6 | **§42 gate is not a flag.** It is a fail-closed gate; it cannot be flagged past. |

## 2. Proposed flags

### 2.1 Backend / derivation

| Flag | Enables | Default |
|---|---|---|
| `spec_knowledgeGraph` | §38 ingestion, graph construction, query | `false` |
| `spec_intelligenceSync` | Client outbox + sync | `false` |
| `spec_predictionEngine` | §39 derivation (headless) | `false` |
| `spec_performanceDna` | §40 derivation (headless) | `false` |
| `spec_intelligenceProvenance` | §41 provenance capture | `false` |

### 2.2 Surface — Performance DNA™, in `DR-003` order

Each is a separate approval gate. Enabling one does **not** authorize the next.

| # | Flag | Surface | Default |
|---|---|---|---|
| 1 | `spec_dnaFounderInspector` | Founder Mode inspector (Sandbox only) | `false` |
| 2 | `spec_dnaWeeklyReport` | Weekly Performance Report beta | `false` |
| 3 | `spec_dnaBodyManual` | Profile → Your Body's Manual | `false` |
| 4 | `spec_dnaCoachExplanations` | AI Coach explanations | `false` |
| 5 | `spec_dnaHomeInsightCard` | Selected Home insight card | `false` |

**No onboarding flag exists** — Performance DNA™ must never appear during onboarding
(Founder Decision 4 / `DR-003`), so there is deliberately nothing to enable.

### 2.3 Surface — other

| Flag | Surface | Default |
|---|---|---|
| `spec_predictionSurface` | Any §39 user-facing output. **Requires §42 accepted.** | `false` |
| `spec_lpmBodyManual` | §61 Your Body's Manual | `false` |
| `spec_lpmConfidenceJourney` | §61 Confidence Journey | `false` |
| `spec_intelligenceExport` | Privacy Center export | `false` |

## 3. Flag dependencies

```
spec_intelligenceProvenance ──► spec_knowledgeGraph ──► spec_intelligenceSync
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
          spec_predictionEngine  spec_performanceDna   spec_lpm*
                    │                   │
              §42 ACCEPTED ─────────────┤
                    ▼                   ▼
          spec_predictionSurface   spec_dna* (5 steps, in order)
```

A dependent flag with its prerequisite off must **fail closed** — behave as if it were also off,
never partially enable.

## 4. Kill switches

Turning any flag off must be safe at any moment:

| Flag off | Effect |
|---|---|
| Backend | Derivation stops. Server records remain (not deleted) but are not extended. |
| Surface | Display stops immediately. Underlying records untouched. |
| `spec_intelligenceSync` | Queue stops; no data loss; queue resumes on re-enable |

**No flag-off path deletes user data.** Disabling is reversible; deletion is a separate,
explicit, audited action.

## 5. Founder Mode interaction

Per §62, Founder Mode grants full access to every feature regardless of phase, including
mid-build features with no phase assigned — **reading Sandbox or Production, writing Sandbox
only**. Founder Mode does **not** bypass the §42 language gate: internal inspection shows raw
records rather than user-facing copy, so the gate is not the control that protects it.
