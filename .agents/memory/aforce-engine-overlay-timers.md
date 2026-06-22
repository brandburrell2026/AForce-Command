---
name: AForce engine-driven overlay timers
description: Why timed/animated overlays that read useEngineSlice() must hold callbacks in refs and isolate their finish timer.
---

# Engine-driven overlay timers (cold-launch opening, investor demo, etc.)

Full-screen overlays mounted in `app/_layout.tsx` AppShell that subscribe to
`useEngineSlice()` (the whole engine output) **re-render whenever the score
refreshes** — and the score lands on first `/state` fetch at mount AND refreshes
on a ~30s interval. So the parent re-renders within seconds of every cold launch,
guaranteed, while the overlay is still animating.

**Rule:** any timed/animated overlay driven off the engine must give its callbacks
**stable identities** or the engine refresh tears down + reschedules its timeline
mid-play (visible stage regression / stutter), and can strand the overlay.

**How to apply:**
- Parent passes `onFinish` via `useCallback(..., [])`, not an inline arrow.
- The overlay also keeps `onFinish` in a ref (`onFinishRef`) and updates it in an
  effect, so its internal `finish`/timeline `useCallback`s don't depend on the
  prop identity at all.
- The teardown/fade-out timeout (the one that actually calls `onFinish`) must live
  in its **own** ref, NOT in the array that the timeline effect's cleanup clears —
  otherwise a re-run/cleanup clears the pending finish and the overlay stays
  mounted at opacity 0 over an absolute-fill Pressable, locking the whole app.

**Why:** caught in architect review of the cold-launch OpeningSequence; the inline
`onFinish={() => setVisible(false)}` made `finish` unstable, so the routine 30s
score refresh rebuilt the timeline effect on essentially every launch.

**Score-Protection note:** these overlays are display-only. Read `engine.score`
(fallback before load) and `readinessLabel(performanceState.level)` for a
band-aware caption — never hardcode "READY TO PERFORM" (a DEPLETED user must read
"REHYDRATE NOW"). Never award/mutate score from an overlay.

## Time-based "isDue" overlays (Voice Check-In morning ritual)

When an overlay's visibility is a **pure function of wall-clock time** (e.g.
"due only inside the morning window AND not snoozed") but the store only notifies
on writes, the overlay must schedule its own re-check timer — there is no event
to wake it when a window opens/closes.

**Rule:** schedule the re-check timer ONLY for a strictly-future expiry
(`delay > 0`). Never call `setState`/bump a revalidate tick for an
already-expired time. Push that decision into a pure helper
(`snoozeRevalidationDelay(untilMs, now) → positive ms | null`) and unit-test it.

**Why:** caught in architect review. The earlier code did
`if (delay <= 0) setRevalidateTick(...)`. If a snooze expired *outside* the
morning window, `isDue` stays false and the snooze value stays non-null, so the
effect could re-enter and re-fire the state update → max-update-depth risk. An
expired snooze needs no nudge: the next ordinary `isDue` render already accounts
for it.

**Latch, don't permanently dismiss:** keep the overlay mounted through its
closing/confirmation screen with an `activated` latch (completing flips `isDue`
false mid-ritual and would otherwise unmount it). CLEAR the latch on
close/snooze — never a permanent `dismissed` boolean, or future mornings and an
expired snooze in the same warm session can never re-open.

## Reduce-motion: fade content + decoration in lockstep

When an animated element has a **separate shared value for a decorative layer**
(e.g. a glow/halo behind glyphs) AND the content fade is delayed, the
reduced-motion branch must fade them **in lockstep — identical timing, NO
delay** for both. A delayed content fade alongside an un-delayed decoration fade
makes the decoration pop in *ahead* of the content, which reads as an ordering
bug and breaks the "skip motion, just fade" accessibility contract.

**Rule:** in reduce mode, set scale/translate to their resting value instantly
(no `withTiming` ramp), and drive every opacity (content + glow) with the same
`withTiming(target, {duration})` and zero delay so it is a single synchronized
fade.

**Why:** caught in architect review of the OpeningSequence Stage 2 N|N monogram —
the glow rose immediately while the glyph fade was delayed, skewing the reveal.
