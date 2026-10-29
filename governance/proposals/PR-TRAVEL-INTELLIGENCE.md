# Travel Intelligence — founder-authorized full build

Brandon requested “build it all” on 2026-10-29 after reviewing the remaining scope: flight-change review and adaptive preparation, arrival planning, connected legs, cross-device trip syncing, TravelGate account linking, and opt-in automatic flight-status alerts.

This extends the existing travel route, flight loader/bridge, Moments projections and account boundaries. It does not replace HydroState, mint hydration doses, silently rewrite itineraries, add bottom tabs, auto-book travel or expand the public cohort.

## Build sequence and acceptance

1. Versioned trips/legs and provider snapshots, with freshness, identity and chronology validation; test before UI integration.
2. Account-owned cloud storage with revision conflicts, explicit sync consent, offline local drafts and deletion.
3. Two-account linking: short-lived single-use code, genuine Clerk sessions in both applications, encrypted server-only grant, explicit import/revoke.
4. Budgeted server monitoring and opted-in devices; durable alert outbox, deduplication, retry/receipts and sign-out/account-deletion handling. Generic notification content carries no itinerary or health detail.
5. Adaptive preparation/arrival projections through existing Moments recommendation authority. Changed departure/arrival requires an explicit member review; stale/cancelled/diverted data cannot silently change a plan.
6. Complete native UI, route guards, privacy controls, integration tests and runtime review.

New server capabilities fail closed until schema and configuration are installed. Production migration/deployment requires a concrete target-specific activation review under both repositories' protected-system rules. Implementation, local verification and migration rehearsal precede that review. No live database, credentials, provider subscriptions or distribution audience is changed as part of local construction.
