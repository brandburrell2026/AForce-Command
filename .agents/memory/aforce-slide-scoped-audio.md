---
name: Slide-scoped audio + autoplay-unlock pattern
description: How to add sound to a single deck slide without it leaking to other slides or fighting the user, plus the autoplay-block fallback that is race-free.
---

# Slide-scoped audio (aforce-pitch deck)

The slide loader mounts only the active slide component at a time, so audio that
is created in a slide's `useEffect` and torn down in its cleanup is automatically
scoped to that one slide — no manual "current slide" check needed.

## The pattern (used on slide 7 CategoryNoise.tsx)

- Create `new Audio(...)` in `useEffect`, keep it in `audioRef`. Cleanup must
  `pause()` + `currentTime = 0` + null the ref + remove every listener.
- Drive the on/off label from the element's real `play`/`pause` events, NOT from
  React state set optimistically. `soundOn` starts `false` and only flips via the
  `play`/`pause` event listeners, so the label stays honest when autoplay is
  blocked.
- The toggle handler must be **intent-driven** on `audio.paused` (`if paused play
  else pause`), never on stale `soundOn`.

## Autoplay-block fallback — the race traps (all hit during review)

Browsers block autoplay-with-sound until a user gesture. A naive window
`pointerdown`/`keydown` listener that calls `play()` creates bugs:

1. **Same-click double-act**: the window gesture plays AND the toggle button's
   onClick pauses on the *same* click → ends muted. Fix: the unlock listener must
   early-return when `e.target` is inside the toggle button (`btnRef.contains`),
   leaving the button's onClick as the sole handler for its own activation.
2. **Stays-armed-after-mute**: if the listener isn't truly one-shot, after the
   user mutes, a later stray click restarts audio. Fix: a `disarmRef` holding a
   `disarm()` (removes both window listeners, nulls itself), called from THREE
   places — `onPlay` (once audio starts the fallback is moot), inside `unlock`
   after it fires, and at the top of `toggleSound` (explicit control wins).
   `disarm()` must be idempotent.

**Why:** in a deck, the slide is reached via key/click navigation, so the page
usually already has user activation and mount-autoplay succeeds; the fallback is
only for the deep-link/blocked case. Getting it wrong is silent (muted or
self-restarting), so keep this disarm pattern for any future slide-scoped audio.
