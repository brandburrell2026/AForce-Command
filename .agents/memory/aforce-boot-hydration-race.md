---
name: AForce boot-hydrated AsyncStorage store race
description: Module-boot-hydrated pub-sub stores must merge-by-id on hydrate, not overwrite, or an early write is lost.
---

# Boot-hydration clobber race in AsyncStorage pub-sub stores

The AForce local stores (voiceCheckIn-style, HydroScan History, analytics) follow
one pattern: a module-level `let current` snapshot + listeners, a `void hydrate()`
kicked off at import time that async-reads AsyncStorage and `setState(loaded)`, and
synchronous `recordX()` mutators that `setState([entry, ...current.entries])` then
enqueue a persist.

**The bug:** if a `recordX()` lands *before* the in-flight `hydrate()` resolves,
hydrate's completion `setState(loaded)` overwrites the just-recorded entry in
memory — the entry is dropped from the live UI (and only reappears after a reload,
if it persisted at all).

**The rule:** on hydrate completion, MERGE the loaded list with whatever is already
in `current.entries` (dedupe by id, then sort/cap) — never blindly replace.

**Why:** the synchronous read surface is the whole point of these stores (UI reads
`current` immediately), so a write can always interleave with the boot load. Tests
that always `await hydrate()` before writing never hit this; you need a regression
test that records BEFORE awaiting hydrate.

**How to apply:** any new store with `void hydrate()` at module scope + a sync
mutator must merge-by-id on hydrate, and ship a "record during the hydration
window" test (import module → recordX immediately → await hydrate → assert both
the persisted and the early entry survive).
