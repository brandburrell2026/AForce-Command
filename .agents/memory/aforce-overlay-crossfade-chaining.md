---
name: AForce overlay crossfade chaining
description: How to chain a second full-bleed launch overlay AFTER the cold-launch cinematic with no black flash and no app bleed-through.
---

To play a second full-screen surface (e.g. a photo Welcome Hero) right after the
cold-launch cinematic (`OpeningSequence`) WITHOUT a black flash or the routed app
showing through, do NOT sequence by unmount-then-mount. Instead:

- Mount the new surface **opaque, underneath** the cinematic for the WHOLE launch
  (lower `zIndex`/`elevation` — e.g. hero 999 vs cinematic 1000), present during
  both the `opening` and `welcome` phases. The cinematic's master-opacity fade
  (~520ms) then reveals the already-painted surface beneath it; there is never a
  frame with nothing on top of the app.
- Drive it with a small AppShell phase machine: `opening → welcome → done`. The
  cinematic's `onFinish` flips `opening → welcome` (and sets the hero's `active`
  prop true to start its own intro stagger). The hero's buttons set `done` + route.
- **Re-gate downstream overlays on the FINAL phase, not on cinematic finish.**
  Anything previously gated on "cinematic done" (VoiceCheckIn, PerformanceStatement)
  must now gate on `phase === 'done'`, or it fires while the hero is still waiting
  for the user's choice.
- Keep the under-surface **inert while inactive**: `pointerEvents="none"` +
  `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"`
  + `accessibilityViewIsModal={active}`, all gated on `active`. Prevents phantom
  button taps and stray screen-reader focus during the cinematic.

**Why:** an unmount→mount handoff leaves a black/app-bleed frame; layering opaque
underneath turns the existing fade into a true crossfade for free.

**How to apply:** any new launch-time overlay that must appear after the cinematic.
Do NOT modify `OpeningSequence` to achieve this — it already fades and self-unmounts;
just put the next surface beneath it.

Note: this Expo app's web `app_preview` screenshots come back blank for the
cinematic/hero overlays (black canvas + heavy Reanimated don't paint into the web
capture pipeline) — verify visually on a real simulator build, not web screenshots.
