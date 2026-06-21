---
name: AForce Performance Statements™
description: Voice-only once-per-day coach identity line — its locks, why the data path is inert, and the flag-off-inert mount pattern.
---

# Performance Statements™

A single short, SPOKEN coach "identity" line (e.g. "Performance is non-negotiable.")
delivered once per local day. Distinct from Daily Wins (a TEXT home banner) — never
reuse win framing, and these are identity lines, NOT hydration commands, so the
Water-First "HYDRATE NOW" wording lock does NOT apply here.

## Voice-only is a hard lock
No quote card, no text render, no archive, no replay. "If you miss it, you miss it."
The mount renders `null`; spoken copy is only ever passed to `speak()`.

## The data-driven path is intentionally inert (returns null)
**Why:** a truthful personalised line ("yesterday was your strongest recovery this
month") needs a reliable per-day recovery series, but `HistoryEntry` is event-based,
capped at 30, and persists no daily recovery memory. Emitting such a claim today
would FABRICATE it — a Score-Protection violation. The scaffold stays so a future
reliable daily-memory source can light it up; when it does it must be PREFERRED over
the generic archetype pool, without changing the public selection surface.
**How to apply:** keep generic archetype pools (push/precision/ignite/recovery) as the
only live path until that memory exists; never default optional signals favorably.

## Flag-off inert lock — the pattern that actually satisfies "byte-identical when off"
The sibling AppShell mounts (VoiceCheckInMount, intentCapture) call their hooks
unconditionally and only gate OUTPUT, and their services `void hydrate()` at module
import. That is NOT byte-identical-when-off — effects + AsyncStorage reads still run.
For a truly inert flag-off feature:
- **Outer flag gate component:** read ONLY the flag; `return null` before rendering the
  inner component. The inner component owns every hook/effect/AppState listener/timer,
  so none run when the flag is off (Rules-of-Hooks safe — hooks live in the inner one).
- **No module-boot hydrate** in the service. Hydrate only from the hook's mount effect
  (which only mounts when the flag is on). With the flag off the service does zero
  AsyncStorage work.
**Why:** the architect failed the first pass precisely because hook + service-boot
hydration ran with the flag off.

## Don't talk over the Voice Check-In
Block speaking while a check-in is DUE and for a window (~90s) AFTER one completes
(covers its closing audio). The check-in store only notifies on writes, so schedule a
SINGLE revalidation `setTimeout` at the window's expiry to re-check. Also re-check on
AppState→active.

## Mute = skip WITHOUT marking delivered
If voice playback is muted, skip and do NOT record delivery, so the line can still play
later the same local day once unmuted. Re-check both AppState==='active' and
`isVoicePlaybackEnabled()` again INSIDE the delayed speak callback (not just before
scheduling) — the app can background or mute during the ~1200ms settle delay.

## Boot-hydration merge still required
Even without module-boot hydrate, hydrate MERGES (laterDayKey + union of recent ids,
capped) rather than overwriting, so a delivery recorded before the first disk read is
never clobbered.
