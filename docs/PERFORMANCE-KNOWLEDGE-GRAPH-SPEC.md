# §38 — Performance Knowledge Graph™ Specification

**Status:** Build Now (architecture, headless) · Phase 2 for any surface
**Authorized by:** Founder Decisions 1 and 5 · **Updated:** 2026-07-22
**Implementation status:** **Not implemented.** Phase 2 is documentation-only.

---

## 1. Purpose

The Performance Knowledge Graph™ is the structured, per-user substrate that records **what this
person's body has actually demonstrated**.

It is **not a new data source**. It is a new *organization* of data AForce OS already collects
and for which consent already exists. It introduces no new raw collection — a deliberate
constraint that keeps the privacy surface unchanged (`DATA-CLASSIFICATION-MATRIX.md` §3).

**Why it earns its place** (Constitution gate — *does this help us understand this person
better?*): it is the first structure that can answer "what has *this person's* body taught us"
with provenance. Principles 4 and 13 both demand that capability; no existing structure supports
it.

## 2. Structure

### 2.1 Nodes

Three kinds, created **only from real recorded events** — never inferred, never seeded, never
back-filled with assumptions:

| Node kind | Examples |
|---|---|
| **Context** | heat day, travel, poor sleep, high training load, time of day |
| **Behavior** | completed command, logged intake, timing of first intake |
| **Outcome** | recovery movement, follow-through, Confidence After Action, self-reported energy |

### 2.2 Edges

An edge records an **observed co-occurrence** of context → behavior → outcome. Every edge carries:

| Field | Meaning |
|---|---|
| `observationCount` | How many times this has actually been seen |
| `confidence` | Derived from count and consistency; never asserted |
| `provenance` | The source event ids that produced it (§41) |
| `observationPeriod` | The window the observations span |
| `modelVersion` | The derivation logic that created it (§41) |
| `contradictions` | Observations that ran counter — recorded, never discarded |

### 2.3 Absence

**Absence is not evidence.** A missing or thin edge yields *"not enough data yet"* — never a
favorable default, never an optimistic guess. This mirrors the existing ledger rule and is
tested (`INTELLIGENCE-VALIDATION-MATRIX.md` V-2, G-2).

## 3. Sources

Reads the existing shared command-event ledger and the §59 Personal Response Library through thin
adapters. It does **not** rebuild the engines those feed.

**Day-index conventions differ per source and must be preserved round-trip:** voice check-ins
carry the record's local-calendar day index; Performance Age snapshots carry the UTC day-index
floor. Do not normalize them to one convention — each consumer relies on its own.

## 4. Hard constraints

| # | Constraint |
|---|---|
| 1 | **Score Protection.** Advisory-only. Never dispatches a reducer action; never awards, mutates, or fabricates score. Read-only score access for fail-closed gating is permitted. |
| 2 | **Pure and RN-free** (type-only imports) so it runs under the existing vitest pure runner. |
| 3 | **Never surfaced as a graph.** Users never see nodes, edges, or network visualizations. The graph is a substrate; §39, §40, and §61 are its voices. |
| 4 | **No new navigation.** No tab, no route. |
| 5 | **Idempotent re-derivation** under the ledger's first-wins merge. |
| 6 | **Config-driven.** Every threshold in `config/hydroStateModel.ts`. |
| 7 | **Evidence Engine™ is the only exit** to a user-facing claim. |

## 5. Persistence

Logic is pure; persistence is an app-layer service, following the `hydroScanHistory` pattern:

- an append updates memory but **defers its storage write until after boot-hydration** has read
  original storage — otherwise a pre-hydration append clobbers stored history;
- **`clear()` bumps a generation counter** and nulls the in-flight hydrate promise, so a late
  hydrate abandons its merge and cannot resurrect cleared events;
- recorder effects that both read and append are guarded by **both** a freshest-state existence
  check and an in-flight latch keyed by the dedupe key — an unguarded append re-fires the read
  and appends forever.

**Storage topology — settled by `DR-002`.** **PostgreSQL is authoritative** for graph nodes,
relationships, provenance, observation counts, confidence history, invalidation status, and audit
records. The device holds a **limited, encrypted, non-authoritative cache** (offline continuity,
pending event sync, recent HydroState context, recent commands, selected graph-derived insights,
current LPM snapshot). **The server wins on conflict.**

The client-side rules above still govern the local cache. Three new obligations apply:

- **Encryption** — the cache must be encrypted; existing stores are plaintext (`OPEN-RISKS.md` R-12).
- **Per-user keying** — scope under a per-user key, never clear-on-sign-out (R-13).
- **Deletion propagates to the cache**, not only the server.

## 6. Consumers

| Consumer | Reads |
|---|---|
| §39 Prediction Engine™ | Edges + confidence, to project forward |
| §40 Performance DNA™ | Edges over time, to form durable patterns |
| §61 Living Performance Model™ | Edges, as an **additional** source for the daily lesson and as the basis for Your Body's Manual |
| Evidence Engine™ | Provenance, to explain |

## 7. Validation

`INTELLIGENCE-VALIDATION-MATRIX.md` — universal V-1…V-8 plus per-system G-1…G-7. All currently
**not started**.
