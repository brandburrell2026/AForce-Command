---
name: AForce welcome-hero light surface
description: The Welcome Hero is the live cold-launch front door; rules for a light-topped full-screen surface (status bar + scrim + type).
---

# AForce Welcome Hero (light-background front door)

`components/welcome/WelcomeHero.tsx` is the LIVE cold-launch front door. It is
mounted in `app/_layout.tsx` (AppShell) and plays AFTER the OpeningSequence
cinematic via the phase machine `opening → welcome → done`. replit.md's note
that "the welcome lobby was removed" is STALE — this hero is real and reachable.

## Rule — a LIGHT-topped full-screen surface must flip the global status bar to dark AND scrim its bone type

AppShell forces `<StatusBar style="light" />` globally because every normal
surface sits on cinematic black. The hero now uses a light grey-wall photo, so:
- the status bar is conditionally `dark` while `phase === 'welcome'` only
  ('opening' = black cinematic and 'done' = dark app stay light = unchanged);
- the hero's own bone/white type only stays legible because it is clustered in
  the LOWER third over a BOTTOM-weighted scrim (transparent top half →
  ~0.95 `#0D0D0D` at the very bottom), and the top "ticker" eyebrow is recolored
  to cinematic-black `#0D0D0D` so it reads on the light wall.

**Why:** white/bone elements (system clock+battery glyphs, eyebrow, wordmark)
vanish on a light background. The original hero was a DARK photo with a
top-weighted scrim, so light glyphs/type worked; swapping in a light-top image
inverts every one of those assumptions.

**How to apply:** any future full-screen surface whose top region is light must
(1) locally override the forced-light status bar to `dark` for exactly the
window it is front-facing, and (2) place any bone/white type over a dark scrim,
never on the bare light area. Keep the override scoped (phase / mount condition)
so the dark surfaces stay byte-identical.

**Verification note:** the live Expo cold-launch overlay can't be captured by
the web app-preview screenshot (documented blank-white artifact during the
crossfading absolute-fill overlays). Verify it with a PIL/ImageMagick composite
of the actual scrim/type values, or on a real device/simulator — not web.
