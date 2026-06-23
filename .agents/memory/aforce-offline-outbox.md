---
name: AForce offline intake outbox
description: Design rules for the durable offline-intake queue — cross-user safety and the server-snapshot reconcile chokepoint.
---

# AForce offline intake outbox

A durable local queue (AsyncStorage) of intakes the user completed while offline,
replayed with a frozen `clientEventId` so the server applies each exactly once.
Two non-obvious design rules came out of architect review and must be preserved.

## Rule 1 — cross-user replay safety is a per-USER storage key, not a sign-out clear

Scope the persisted queue under a per-user key (`@aforce/intake-outbox:<userId>`).
A user transition (sign-in, sign-out→null, A→B) flips the in-memory scope, bumps
the generation guard (abandoning any in-flight hydrate), and resets in-memory to
empty+un-hydrated; the previous user's queue stays under THEIR key (replays on
return).

**Why:** A sign-out-only `clearIntakeOutbox()` is lifecycle-fragile — a queue
built while the flag was ON survives if the flag is OFF at sign-out, if the
build/flag changes, or if a user switch happens without an observed signed-out
transition. On the next ON the queue would replay under the *current* Clerk
session = cross-user write. Architect FAILED the sign-out-clear approach twice;
the per-user key makes mismatched replay/hydrate structurally impossible.

**How to apply:** Any device-shared durable queue that replays writes under the
caller's identity must key persistence by identity. Don't rely on a sign-out
hook to clear it. Keep flag-off byte-identical: never set a scope when the
feature flag is off → `storageKey()` stays null → every persist/hydrate/clear
short-circuits with zero I/O.

## Rule 2 — server-snapshot replacement funnels through ONE guarded chokepoint

Every path that REPLACES reducer state from a server snapshot (periodic /state
refresh drift branch, WebSocket broadcast handler, and the third apply path) must
go through one function (`applyServerUserState`). Guard it: while the flag is ON
and `selectPendingCount(...) > 0`, return early (hold optimistic state). Only
reconcile to authoritative server truth once the queue fully drains
(pendingCount → 0, after markSynced + prune).

**Why:** A fresh server snapshot does not yet include intakes the user completed
offline that are still queued locally; replacing reducer state would silently
drop those completed-but-unsynced intakes. Replay must NOT re-dispatch
CYCLE_SUCCESS — the optimistic dispatch already recorded history/analytics/voice
at log time, so reconcile-by-replace (not increment) avoids double-apply.

**How to apply:** Before adding an optimistic-then-reconcile layer, find the
single server-state replacement chokepoint and prove ALL refresh/WS/other paths
flow through it; guard there, not at each call site.
