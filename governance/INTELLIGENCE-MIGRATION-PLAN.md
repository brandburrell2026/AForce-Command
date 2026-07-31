# Intelligence Migration Plan

**Status:** Canonical (plan only — nothing executed) · **Updated:** 2026-07-22 (Phase 2)

How §38–42 and the §61 expansion arrive **without rebuilding anything that already works**.
Constitution Principle 9: new phases reveal capability; they do not require rebuilding the
foundation.

> **Phase 2 executed none of this.** No code, no migrations, no flags, no surfaces.

---

## 1. Migration principles

| Principle | Consequence |
|---|---|
| **Additive only** | No existing engine is rewritten. Existing signatures and tests stay green (Build Rule 6). |
| **Adapter-wrap, don't rebuild** | The three Tier-1 engines (Command Confidence, Performance Memory, Performance Age) already exist and are tested. §38 reads the shared ledger through thin adapters. |
| **Headless first** | Every system lands with no surface. Surfacing is a separate, separately-approved step. |
| **Dark by default** | Flags default off with a strict flag-off short-circuit, so production behavior is byte-identical while dark. |
| **Reversible** | Every increment can be removed by turning a flag off, with no data loss and no orphaned state. |

## 2. Sequence

Derived from the ordering constraints in `INTELLIGENCE-DEPENDENCY-MAP.md` §4. One section at a
time, tested and confirmed before the next (Build Rules 2, 3).

| Step | Scope | Depends on | Exit gate |
|---|---|---|---|
| **M0** | Governance repair — mirror → pointer, drift check in CI | — | ✅ **complete (Phase 2)** |
| **M1** | §41 provenance + model-version types | — | Types reviewed; registry structure in place |
| **M2** | §38 graph — pure builder + query, headless, flag-off | M1 | Score-Protection, no-fabrication, provenance tests green |
| **M3** | §38 persistence — server-authoritative store + encrypted device cache + sync | M2, ~~D-02~~ ✅ `DR-002` | Boot-hydration deferral, generation guard, per-user keying, idempotent sync, deletion propagation |
| **M4** | §42 language & compliance gate + mechanical banned-term test | — (parallel with M2) | **Founder sign-off — blocks M5/M6** |
| **M5** | §39 Prediction Engine, headless, behind sufficiency gate | M2, M4, **D-03 ruling** | Insufficient-data path proven; no banned term reachable |
| **M6** | §40 Performance DNA, headless, patterns only | M2, M4 | Principle 2 review — no numeric output type exists |
| **M7** | §61 expansion — Your Body's Manual reads §38 | M2 | Existing §61 tests still green; "your body taught us" preserved |
| **M8** | Surfacing, per surface, behind flags | all above | Per-surface founder approval |

**M2 is the natural first increment** — it has no external dependency and is useful headless.

## 3. Backward compatibility

| Existing system | Impact | Guarantee |
|---|---|---|
| HydroState™ / scoring engine | **None** | `scoringEngine.ts` and `statusColor.ts` are off-limits and untouched |
| Command Confidence™ | **None** | Adapter reads; adherence deliberately not fed in (would silently upgrade confidence — a Score-Protection breach) |
| Performance Memory™ | **None** | Append-only; history never overwritten |
| §59 Adaptive Response Engine | **None** | §38 reads the Personal Response Library; does not modify it |
| §61 LPM daily lesson | **Additive source only** | Existing exports and behavior unchanged; §38 becomes an *additional* input |
| HydroScan™ | **None** | Advisory-only isolation preserved (DR-001) |
| Navigation | **None** | No new tabs (Build Rule 14, Founder Decision 1) |

## 4. Data migration

**No migration of existing data is required.** §38 derives from events already recorded. The
graph is built forward from the existing ledger; there is no schema change to existing stores.

Two consequences to design for in Phase 3:

1. **Back-derivation.** Whether the graph is built from historical ledger events at first run, or
   only forward from activation, changes how quickly §39's sufficiency gate opens. Recommended:
   back-derive from existing history, since the events are already recorded and back-derivation
   is idempotent under the ledger's first-wins merge.
2. **Day-index conventions must be preserved round-trip** — local-calendar for voice check-ins,
   UTC floor for Performance Age snapshots. Do not normalize to one convention.

## 5. Rollback

| Step | Rollback |
|---|---|
| M1–M2 | Flag off; pure modules become unreachable. No stored state. |
| M3 | Flag off; `clear()` bumps the generation counter so a late hydrate cannot resurrect cleared events. |
| M4 | Gate is additive; removing it re-blocks §39/§40 output (fail-closed). |
| M5–M6 | Flag off; projections are ephemeral, patterns are derived and re-derivable. |
| M7 | §61 reverts to §59-only sourcing; daily lesson unaffected. |
| M8 | Per-surface flag off. |

**Fail-closed everywhere:** if a gate, flag, or data-sufficiency check cannot be evaluated, the
system emits nothing rather than emitting unguarded output.
