# WHOOP Sweep Redesign — Architecture Map

**Status: MAP ONLY — NOT IMPLEMENTED. Awaiting founder confirmation.**
Founder decision 2026-08-19: keep WHOOP active for Phase 1; the defect is the
60-second background sweep, not the integration. Member-facing WHOOP data is
displaying correctly and must not change.

## The four flows

```
                        ┌─────────────────────────────────────────────┐
 app foreground/open ──▶│ GET /aforce/state (existing, authenticated) │
                        │  after response: is whoop blob stale AND    │
                        │  connection eligible?                       │
                        │   fresh → NO FETCH (do nothing)             │
                        │   stale → fire-and-forget runWhoopFetchOnce │
                        │           (same worker, singleflight)       │
                        └─────────────────────────────────────────────┘

 background sweep ──────▶ every 30 min (env: 1,800,000 ms)
                          enumerate token rows, then per user:
                            needs_reauth?        → skip (no calls)
                            backoff_until>now?   → skip (no calls)
                            blob fresh?          → skip (no calls)
                            else                 → runWhoopFetchOnce
                                                   (unchanged pipeline)

 failed token refresh ──▶ failure_count += 1
                          backoff_until = now + min(30 min × 2^(n−1), 24 h)
                          n ≥ 8 → needs_reauth = true (member attention;
                                  scheduled retries STOP, row is KEPT)
                          any successful refresh/re-auth → both fields clear

 fresh data ────────────▶ no fetch, no WHOOP call, at most the one
                          enumeration/eligibility read per sweep
```

## Exact thresholds and schedules

| Parameter | Value | Basis |
|---|---|---|
| Sweep cadence | **30 min** (`WHOOP_FETCH_SWEEP_INTERVAL_MS=1800000`) | founder decision |
| Freshness threshold | **30 min** (`WHOOP_DATA_FRESH_MS`, env-overridable) | **no approved constant exists today** — nothing currently reads blob `fetchedAt` for suppression. WHOOP recovery/sleep/strain are daily-granularity scores, so 30 min is far tighter than the data's own update rate. One constant, founder-settable. |
| Backoff schedule | 30 m → 1 h → 2 h → 4 h → 8 h → 16 h → **24 h cap** | exponential, per consecutive failure |
| Member-attention threshold | **8 consecutive failures** (≈ >2 days broken) → `needs_reauth = true`, scheduled retries stop | "must not retry every 30 min forever" |
| Token rows | **never deleted automatically** | founder constraint |
| Reset | any successful refresh or re-auth clears failure count, backoff, and `needs_reauth` | — |

## What this requires — one flag for founder awareness

Backoff state must survive restarts (in-memory would reset on every deploy and
quietly violate "not forever"). That means **three additive nullable columns on
`aforce_whoop_tokens`**:

```sql
ALTER TABLE aforce_whoop_tokens
  ADD COLUMN IF NOT EXISTS refresh_failure_count integer,
  ADD COLUMN IF NOT EXISTS refresh_backoff_until timestamptz,
  ADD COLUMN IF NOT EXISTS needs_reauth boolean;
```

Same proven additive pattern as the last three migrations; old code ignores the
columns; rollback is `DROP COLUMN` ×3. Called out explicitly because "no new
schema changes" was a standing constraint in the urine phase — this design
cannot honestly satisfy requirement #4 without it.

## Impact arithmetic

| | Today (60 s) | After (30 min) |
|---|---|---|
| Scheduled sweeps/day | **1,440** | **48** (−96.7 %) |
| DB queries/day (idle, all suppressed) | ≈ 4,320 | ≈ **48–96** (eligibility folded into the enumeration read) |
| WHOOP calls/day — current 2 dead tokens | ≈ 2,880 doomed refresh POSTs | converges to ≤ 2/day under the 24 h cap, then **0** once `needs_reauth` latches |
| WHOOP calls/day — healthy token | 5,760 theoretical | ≈ 12–20 (staleness-driven: ~3–5 cycles × 4 calls) |
| Neon compute | awake 24 h/day (~720 CU-h/mo) | awake ≈ minutes/day; **autosuspend engages between sweeps** → roughly ≥ 97 % compute reduction |

Foreground refreshes add a handful of queries/calls per day, only while a
member is actually using the app — which is the point.

## Why displayed values cannot change

The fetch → normalize → persist pipeline (`fetchWhoopSnapshot` →
`whoopSnapshotToProviderBlob` → biometrics-blob merge) is **untouched**. This
redesign changes only *when* that pipeline runs, never *what it computes*.
No WHOOP value, signal normalization, HydroState math, or scoring is touched;
WHOOP Recovery/Strain continue to flow only through the already-approved
`health_signals` path — no new score coupling is introduced (constraint #7).

Verification before merge: worker-output pin tests (same snapshot in → same
blob out). After deploy: force one fetch for the founder's user and diff the
biometrics blob against the prior value — identical fields except `fetchedAt`.

## Client involvement: none

The foreground-refresh hook rides the **existing** authenticated
`GET /aforce/state` call the app already makes on open — server-side
fire-and-forget after the response. **Zero client-code changes → no new mobile
build.** Builds ≤ 69 get the identical behavior improvement.

## Rollback

1. Env: `WHOOP_FETCH_SWEEP_INTERVAL_MS` back to `60000` (founder, Railway).
2. Revert the PR — old code ignores the nullable columns.
3. Optional: `ALTER TABLE aforce_whoop_tokens DROP COLUMN IF EXISTS …` ×3.

No data loss at any step; token rows are never modified destructively.
