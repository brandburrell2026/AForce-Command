# Weekly Data Infrastructure — Implementation Specification

_Status: **approval-ready design**. No data-model or API change is made by this
document. The current Weekly Report keeps rendering honest `Collecting…` /
`Awaiting data` states until the phases below are built and approved._

## 1. Problem

The editorial Weekly Report (E2, `components/insights/EliteWeeklyEditorial.tsx`)
is fed by the pure, honest model `utils/weeklyReport.ts`. Several of its sections
return `collecting` / `awaiting` **because the inputs are empty**, not because the
UI is incomplete:

| Section | Blocked input | Why |
|---|---|---|
| Performance-Age movement | `history.performanceAgeSnapshots: PerformanceAgeDailySnapshot[]` | no cross-day persistence of the daily PA snapshot for the *trend* |
| Recovery trend | `history.recoverySnapshots: DailyValueSnapshot[]` | no persisted daily recovery series |
| Top command | `commandUsage: WeeklyCommandUsage[]` | no command-issued instrumentation |
| True prior-week readiness delta | a prior-week readiness series | V2 hero delta is first-vs-last within one window |
| Causal headline ("hydration +18% → faster recovery") | all of the above + a correlation pass | can't be computed → **must not be fabricated** |

The model is already **Score-Protection-safe**: it stores/reads only
already-derived display values and returns explicit `collecting`/`awaiting`; it
never dispatches a reducer action or moves a score. The gap is a **persistence +
instrumentation** layer, not UI.

## 2. Goal

Persist one honest daily snapshot per UTC day and a prior-week series so the
Weekly can show **real** week-over-week trends and an **honest, correlation-labeled**
headline — with zero fabrication and no change to the scoring engine, HydroState
model, or public API surface.

## 3. What already exists (reuse, don't reinvent)

- **The pattern is proven for Performance Age.** `hooks/usePerformanceAge.ts`
  already writes ONE `PerformanceAgeDailySnapshot` per UTC day into the
  Command-Event Ledger via `emitPerformanceAgeSnapshot` (idempotent: first finite
  value of the day wins; loop-safe; advisory — never dispatches score). The trend
  helper `computePerformanceAgeTrend` already reads them back. **This is the exact
  shape to generalize.**
- `utils/weeklyReport.ts` already accepts `history.performanceAgeSnapshots`,
  `history.recoverySnapshots`, and `commandUsage` — **the input contract is
  already defined**; it's just never populated.
- `lib/db/src/scoreSnapshotRepo.ts` + the api-server model-version parity give a
  server-side snapshot path for later cross-device sync.

## 4. Design (proposed — not implemented here)

### 4.1 The daily snapshot record
Generalize the PA-snapshot pattern into a single **Daily Readiness Snapshot**,
written once per UTC day, storing only already-derived display values:

```
DailyReadinessSnapshot {
  dayIndex: number         // Math.floor(epochMs / 86_400_000) — timezone-free
  readinessScore: number   // engine output (display projection, read-only)
  recoveryScore: number
  performanceAge: number | null
  hydrationConsistencyPct: number   // % of the day's plan met (derived)
  activeDay: boolean
  firstIntakeMinuteOfDay: number | null  // for the "earlier hydration" correlation
}
```

### 4.2 Storage — two tiers, client-first
- **Tier 1 (M1, no backend change): Command-Event Ledger (client).** Reuse the
  existing ledger + a new `emitDailyReadinessSnapshot` dispatcher mirroring
  `emitPerformanceAgeSnapshot`. Offline-first, idempotent per UTC day, loop-safe.
  This alone unblocks the trend sections with **no API change**.
- **Tier 2 (M4, needs founder approval): server sync.** Extend
  `scoreSnapshotRepo` for cross-device history behind the existing
  `profile_server_hydration_enabled` gate + the model-version stamp (parity-tested
  with the api-server). Off-limits per CLAUDE.md → separate approval.

### 4.3 Command-usage instrumentation (M2)
Emit a lightweight analytics event when a command is *issued/shown* (not when it
mutates score — it never does): `{ commandId, atISO }`. `weeklyReport.ts` already
consumes `commandUsage`; this event feeds it → unblocks "Top command" (today
`awaiting`). Purely additive analytics, no score path.

### 4.4 Honest correlation headline (M3)
A **pure, tested** helper `weeklyCorrelations(snapshots)` computes associations from
the persisted series — e.g. "days you started hydration earlier trended toward
higher next-morning readiness (+N)". Rules:
- **Correlation, never causation.** Copy is templated as association ("trended
  with", "on days when…"), never "because".
- Requires a minimum N of real days; below it → keep `Collecting…`.
- The "+18%"-style number is a **real delta from the persisted series**, or it is
  not shown. No synthetic numbers, ever (Constitution + §64 language guard).

### 4.5 True prior-week delta (M1 byproduct)
With the readiness series persisted, `weeklyReport.ts` can compute a genuine
prior-week average vs this-week average for the hero delta (replacing the
first-vs-last-in-window approximation).

## 5. Sequencing & milestones

| M | Deliverable | Backend? | Unblocks | Risk |
|---|---|---|---|---|
| **M1** | `emitDailyReadinessSnapshot` (client ledger) + wire into `weeklyReport` inputs | No | Recovery trend, PA trend, true prior-week delta | Low (mirrors shipped PA pattern) |
| **M2** | Command-issued analytics event → `commandUsage` | No | Top command | Low (additive analytics) |
| **M3** | `weeklyCorrelations` pure helper + correlation-labeled headline | No | Editorial causal-*style* headline (honest) | Low–Med (copy compliance review) |
| **M4** | Server snapshot sync (cross-device) via `scoreSnapshotRepo` | **Yes** | Multi-device history | **Off-limits → founder approval** |

Each milestone ships behind a flag (`weekly_data_snapshots_enabled`), default OFF,
with the UI continuing to show honest states until the series has enough real days.

## 6. Non-negotiables (unchanged)
- Snapshots store **already-derived display values**; never dispatch a reducer
  action, never move a hydration point / performance band / recovery score
  (Score-Protection).
- Sections below their minimum real history render `Collecting…` — **never a
  fabricated trend or number**.
- No change to `scoringEngine.ts`, `statusColor.ts`, `hydroStateModel.ts`, or the
  public API in M1–M3. M4 (server) is a separate, approval-gated change.
- Correlation copy passes the §64 observation-only guard
  (`isCompliantCoachLine`): no causation, no risk/diagnosis, no population
  comparison.

## 7. Acceptance
- With ≥ N real persisted days, the Weekly shows real recovery/PA trends, a real
  prior-week delta, a real top command, and (if the association is real) a
  correlation-labeled headline.
- With < N days, every one of those renders its honest `Collecting…`/`Awaiting`
  state — identical to today.
- No new fabrication path exists anywhere in the pipeline (enforced by the
  builder's existing "no-data → only honest states" test + a new correlation
  minimum-N test).
