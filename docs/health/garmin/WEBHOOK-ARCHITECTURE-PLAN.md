# Garmin Webhook Architecture — Risk Note and Plan Sketch

**Last verified:** 2026-08-03
**Status:** Unresolved design risk, not a build plan. Nothing here is
scheduled work — this exists so the risk is written down and discoverable
rather than living only in a code comment inside a dormant module.

## The risk, stated plainly

Garmin's wellness API is widely documented as **push-based**: Garmin calls
a partner-registered webhook with summary payloads as they become
available, rather than the poll-on-demand model WHOOP and Oura use (where
AForce's own worker calls `GET /recovery`, `GET /sleep`, etc. on a
schedule). The current dormant code
(`artifacts/api-server/src/lib/garminSnapshot.ts`,
`garminFetchWorker.ts`) is shaped as a **pull** — a worker-triggered fetch
against `/dailies`, `/sleeps`, `/hrv` — mirroring the WHOOP/Oura pattern
for consistency, not because Garmin's real API has been confirmed to work
that way.

**If the push/webhook model is confirmed, `fetchGarminSnapshot`'s current
shape is the wrong integration pattern for production**, not a minor
adjustment. This is the single highest-risk assumption anywhere in the
Garmin dormant code and must be resolved — against the Garmin Developer
Program partner portal, ideally with a live sandbox — before writing a
real (non-mock) fetcher.

## Why this matters more than a typical unverified assumption

Every other unverified item in `ENDPOINT-VERIFICATION-CHECKLIST.md` (field
names, exact paths, rate limits) is a **shape** risk — wrong, it costs a
mapping fix. This one is an **architecture** risk — wrong, the entire
worker/sweep/scheduling model this codebase has consistently used for
WHOOP, Oura, and the dormant Garmin pull-shaped code doesn't apply, and a
webhook receiver is a different kind of component: it needs a public
endpoint, request verification (signature or shared secret, TBD pending
Garmin's docs), idempotent ingestion (a webhook can be redelivered), and a
local cache/queue rather than a synchronous request/response cycle.

## What resolving this requires (not a commitment to build any of it yet)

1. Confirm with the Garmin Developer Program partner portal (post-approval)
   whether wellness summary delivery is:
   - **Push-only** (webhook registration required, no polling equivalent
     for summaries), or
   - **Poll-available** (a REST summary-pull option exists alongside or
     instead of webhooks), or
   - **Hybrid** (e.g. webhook notifies "new data available," pull confirms
     it via a REST call).
2. If push is confirmed as the only or primary path, sketch (in a follow-up
   to this doc, not here) a webhook-receiver design: public endpoint
   ownership (api-server route), request authentication/verification
   scheme once Garmin's docs confirm what they support, idempotent
   ingestion keyed on whatever unique identifier Garmin's payload provides,
   and how a webhook-delivered record reaches the same
   `garminSnapshotToProviderBlob` → `normalizeProviderSnapshot('garmin', ...)`
   pipeline the current mock already proves works for a given snapshot
   shape (see `MOCK-COVERAGE.md` — that part of the pipeline is architecture-
   agnostic and should not need to change regardless of push vs. pull).
3. Only after that design exists should `garminFetchWorker.ts` and
   `garminSnapshot.ts` be rewritten or replaced — rewriting them first,
   before confirming the delivery model, risks building the wrong thing
   twice.

## What this doc is not

This is not a scoped engineering ticket, not an estimate, and not
authorization to build a webhook receiver. It exists solely so that the
next person who picks up Garmin work — likely a different session or a
different engineer than whoever eventually gets partner credentials —
starts from "we already know this is probably the wrong shape, confirm the
delivery model first" instead of rediscovering the risk from scratch or,
worse, shipping the pull-shaped code as-is because it already exists and
passes its own tests.
