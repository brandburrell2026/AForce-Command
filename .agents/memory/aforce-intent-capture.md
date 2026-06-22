---
name: AForce Intent Capture / coach tone-posture
description: How coach tone/intensity adjustments must be wired so they never touch score and stay byte-identical when their flag is off.
---

# Intent Capture™ / coach posture

Intent Capture asks "Ready / Recovering / Not Today" as an additive inline step in the
Voice Check-In overlay, and the choice shifts the coach's **closing tone/intensity** only.

## Durable rules
- **Tone is copy-only.** A posture (`coachingPostureForIntent`) selects which i18n
  *key* the closing display + spoken line use. It must NEVER dispatch a hydration
  action or touch score/band/recovery. This is the Coach-Layer expression of
  Score-Protection: coaching *tone* may react to a declared intent, but *score* may not.
- **Neutral = the original keys.** The `neutral` toneKey (used when no intent is
  selected OR the flag is off) maps back to the pre-existing `closing_spoken` /
  `closing_body` keys, so a flag-off flow is byte-identical to before the feature.
  `coachingPostureForIntent(null)` must return the neutral posture.
- **Persistence is separate.** Intent records live in their own service/store
  (`@aforce/intent-capture`), mirroring the Voice Check-In service pattern
  (serialized write queue, useSyncExternalStore, module-boot hydrate, merge-by-day).
  It does not go through the reducer.

**Why:** the build lock forbids anything that fabricates or moves score; coaching
personalization is allowed as long as it is display/voice only and reversible by a flag.

## How to apply (additive overlay steps)
- New post-check-in steps go INLINE in `VoiceCheckInOverlay` (Step union + a
  `{step === 'x' && ...}` block), gated by a feature flag — never a new tab/route
  (mobile nav lock). Keep `totalSteps`/progress pips derived from the flag.
- The closing `useEffect` is guarded by `finishedRef`; recording an intent or the
  engine-score ~30s re-render must not be able to restart completion or re-speak.
  Speak each step's prompt once via `spokenRef` keyed by a per-step id.
- All consumer copy (labels, sublabels, spoken prompt, every closing variant) must
  exist in all 6 launch locales (en/es/fr/de/pt/it) and every closing variant must
  still lead Water-First ("HYDRATE NOW — start with water" / locale equivalent).

## Second surface — after a Performance Statement
The spec is "after Voice Check-In OR a Performance Statement", so Intent Capture has
TWO surfaces: the inline check-in step (above) AND a post-statement prompt
(`PostStatementIntentPrompt`, mounted by `PerformanceStatementMount` once the
statement has spoken). The statement stays voice-only, so the prompt is a SEPARATE
surface — never a text/quote render of the statement. The post-statement prompt can
reuse the already-localized `voiceCheckIn.intent.*` / `voiceCheckIn.snooze` /
`common.close` keys (no new copy).

- **Dedupe on `hydrated && todayIntent`.** Both surfaces must wait for the per-day
  store to hydrate, then render nothing once today's intent is on record — or the
  second surface re-asks after the morning check-in already captured it.
- **Flag-off inertness gates the MOUNT, not the store.** `intent_capture_enabled`
  decides whether the prompt component mounts; the intent service already
  module-boot-hydrates app-wide (the always-mounted check-in overlay imports the
  same chain), so do NOT rip out that boot hydrate to chase byte-identical-off.
  Inertness here = never mount the prompt / run its UI.
- **Entrance-delay touch trap.** A full-fill dim overlay with a delayed/faded
  entrance must arm `pointerEvents` only after the delay, or the invisible backdrop
  steals/dismisses the tap before the user can see it.
