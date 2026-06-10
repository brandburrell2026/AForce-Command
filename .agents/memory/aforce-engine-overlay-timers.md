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
