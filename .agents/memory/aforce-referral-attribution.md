---
name: AForce Referral & Ambassador Attribution (founder panel)
description: Tier/status filter semantics for the founder referral-attribution Command Center panel.
---

# Referral & Ambassador Attribution — founder filter semantics

The founder panel (`GET /admin/command-center/referral-attribution`) reads the
REAL referral ledger (`aforce_users.referral_code` + `aforce_referral_claims`),
not the pseudonymous analytics pipeline. Identity (Clerk id + non-PII code) is
surfaced by design; NO score/health/recovery/email is ever joined.

## Filter scoping contract (keep consistent)
from / to / code / referrerUserId / **tier** / **status** all scope ONLY the
recent-claims detail table + the `claimsInRange` count. The leaderboard, tier
distribution, and lifetime totals are ALWAYS full-ledger. Don't make a new
filter narrow the top section without explicit ask — it would break this contract.

## Tier filter — apply in the shared WHERE, pre-LIMIT
Tier is a property of the REFERRER's lifetime claim count, not of a single claim.
Filter it via a correlated sub-query pushed into the shared `whereSql`
(`(SELECT count(*) FROM aforce_referral_claims rc WHERE rc.referrer_user_id = c.referrer_user_id) >= lo [AND < hi]`).
**Why:** it must run on BOTH the count and detail queries, and BEFORE `ORDER BY/LIMIT`,
or a tier page gets silently truncated (filter-after-limit bug).
**How to apply:** bands come from `tierClaimBounds(tierId)` derived from
`REFERRAL_TIERS` (single source of truth) — never hard-code the 0/1/5/15/50
thresholds; the top tier is open-ended (`hi === null`).

## Status filter — honest validated no-op
The ledger models only completed claims (a row's existence IS the claim; no
pending/expired state). So `status` accepts `all|claimed` and is validated +
echoed but is NOT a SQL predicate (both select the same rows). Don't offer
`pending` (a value that always returns empty is misleading); normalize rejects
unknown status → `invalid_status` (400), unknown tier → `invalid_tier` (400).

## Deleted/missing referrer
LEFT JOIN keeps deleted referrers visible; null code → `Operator ????` handle in
the pure builder. No-duplicate-attribution relies on the existing referee
uniqueness constraint + GROUP BY per referrer — don't aggregate referrers any
other way.
