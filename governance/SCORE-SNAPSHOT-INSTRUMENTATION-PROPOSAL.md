# Score Snapshot Instrumentation — Proposal

**Status: PROPOSAL ONLY — NOT IMPLEMENTED. Requires founder approval.**
Written 2026-08-14. No code, schema, or calculation has been changed.

**Why:** Dark Yellow was observed on device to remove 10 points where the urine
term computes to −8. The remaining −2 could not be attributed, because a score
snapshot records only the total. The snapshots either side swung ±30–41 points
within *milliseconds*, so no delta was decomposable. This proposal makes every
snapshot answer "why did this score change?" without a device test or a code
audit.

**Constraints honoured:** no new scoring factors, no calculation changes, no
proprietary weights exposed to the consumer UI.

## 1. The factor vector already available today

`utils/scoring/breakdown.ts` already computes all twelve terms and **discards
them** after summing. Each is `{ id, label, delta, maxMagnitude }`:

| id | covers | maxMagnitude |
|---|---|---|
| `base` | intake ounces vs target | 45 |
| `aforce_bonus` | protocol bonus | 50 |
| `recency` | decay since last intake | 35 |
| `confirmation` | last command confirmation | 3 |
| `consistency` | compliance streak | 15 |
| `context` | heat / sweat / activity | 20 |
| `recovery` | recovery momentum | 15 |
| `symptom` | performance signals | 30 |
| `urine` | hydration signal (1–8) | 20 |
| `output` | output stress | 10 |
| `sleep` | overnight carryover | 10 |
| `health_signals` | provider recovery signal | 10 |

`socialIntake` also contributes to `raw` but has no factor row; it must be
included for the sum to reconcile. `raw` is these summed; `score` is
`clamp(round(raw), 0, 100)`.

**This vector alone would have answered the −10 question in one query.**

## 2. Proposed representation

One additive column holding `{id: delta}` — **deltas only, never weights**:

```json
{"base":31,"aforce_bonus":0,"recency":-12,"confirmation":0,
 "consistency":6,"context":-4,"recovery":9,"symptom":-22,
 "urine":-8,"output":-3,"sleep":0,"health_signals":0,
 "social_intake":0,"raw":-3,"clamped":0}
```

`raw` and `clamped` are included so a snapshot is **self-checking**: factors must
sum to `raw`, and `clamped` records how much the 0–100 clamp absorbed — the term
that silently swallows explanation today.

## 3. Is additive JSONB the smallest safe approach? Yes.

The alternatives are worse:

- **Twelve typed columns** — a wider migration now and a schema change for every
  future factor.
- **A separate table** — a join on every read and a second write per snapshot.
- **JSONB** — one `ADD COLUMN`, nullable, no default, catalog-only, no table
  rewrite. Identical in shape to the two migrations already verified this week.

Labels and `maxMagnitude` stay in code; only deltas persist.

## 4. Migration SQL

```sql
BEGIN;
ALTER TABLE aforce_score_snapshots
  ADD COLUMN IF NOT EXISTS factor_deltas jsonb;
COMMIT;
```

421 existing rows receive `NULL`, which correctly reads as "captured before
instrumentation" rather than "all factors were zero".

## 5. Storage and privacy

~200–300 bytes per snapshot. **Twelve integers — no PII.** No identifiers beyond
the existing `user_id`, no free text, no location, no raw health values. Because
`label` and `maxMagnitude` are excluded, **proprietary weights are never
persisted and never reach the client**. The consumer UI is unchanged; this is
operator diagnostics only.

## 6. Write-volume impact: zero additional writes

The snapshot write already exists — `postJournalSnapshot`, debounced to ~5
minutes or a band change via `lastSnapshotRef` in `store/useAppStore.tsx`. This
adds a field to an existing payload: **no new requests, no new rows, no new
cadence.** The payload grows by a few hundred bytes.

## 7. Rollback

```sql
ALTER TABLE aforce_score_snapshots DROP COLUMN IF EXISTS factor_deltas;
```

Safe while the column holds only diagnostics — dropping it loses explanation
data, never score or intake data.

## 8. Tests

- factors sum to `raw` across arbitrary states
- every `id` in the vector appears in the persisted object
- **no** label or `maxMagnitude` is persisted (weight-leak guard)
- the object contains no string values (PII guard)
- a `NULL` column reads as "pre-instrumentation", not zero
- signs survive the wire round-trip
- **mutation:** dropping a factor from the payload must fail the sum check

## Optimistic vs authoritative — mechanism, and why nothing is suppressed yet

**Hypothesis, not a finding.** `logIntake` applies an **optimistic** state
immediately, then `applyServerUserState` **replaces** it with the server's. Both
re-render, both can cross a band boundary, and the snapshot debounce keys on
band — so two rows land milliseconds apart. That matches the observed
`76 BALANCED → 45 DEPLETED` in 57 ms: first optimistic, then authoritative.

**This has not been proven, and nothing should be suppressed on it.** The
`factor_deltas` column confirms it at no extra cost: if the pair differ in
`base`/`recency`, it was a genuine state change; if they are identical apart
from `clamped`, it is the same computation twice.

**Terminology — the repo already owns this concept; do not invent one.**
`aforce_score_snapshots.level` already carries a `NOT_COMPUTED` provenance value,
and `routes/aforce/journal.ts` already filters aggregates with
`inArray(level, [...LEVELS])` so non-measured rows cannot pollute averages. That
is the canonical existing vocabulary for "this row is not a measurement". Extend
**that** provenance concept rather than adding an `optimistic`/`authoritative`
field — and only after the data confirms the mechanism, as its own proposal.

---

# Appendix — urine save failure is invisible to the member

`components/urine/UrineCheckScreenV2.tsx` `handleConfirm` catches with
`console.error` and nothing else. A failed save tells the member nothing, and
they believe it worked.

**Reuse the existing machinery — build nothing new.** `store/app/writeFailure.ts`
already classifies any thrown error into
`offline / auth / forbidden / conflict / timeout / rate_limited / invalid /
server`, with member-safe copy in all 11 locales, and `logIntake` already alerts
through it.

```ts
} catch (err) {
  const failure = classifyWriteFailure(err);
  Alert.alert(
    i18n.t(`common.action_failed_title.${failure.kind}`),
    i18n.t(`common.action_failed_body.${failure.kind}`),
  );
}
```

Roughly five lines. No new copy, no new locale keys, no new classification
system, no change to the write path or to scoring.

**It would have removed the ambiguity in Build-67 Test A**, where the confirm
produced no server request at all and neither the founder nor the logs could
distinguish "never fired" from "failed silently".
