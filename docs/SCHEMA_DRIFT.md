# Schema ↔ DB drift log

Tracks cases where `drizzle-kit push` reconciled a difference between the schema file and the dev DB that was **pre-existing**, i.e. not introduced by the change being pushed. Recorded here so the reconciliation isn't silently absorbed into an unrelated commit.

- **2026-06-29** — `aforce_privacy.fields` `SET DEFAULT` (the `{score,state,streak,protocol,trend: true}` default): the schema declared `.notNull().default({...})` since before the Section 18 work, but the dev DB column lacked it; the Section 18 push swept in the `ALTER COLUMN ... SET DEFAULT`. Default-only change (affects future inserts; no existing rows rewritten). Unrelated to Section 18 — not in that commit.
