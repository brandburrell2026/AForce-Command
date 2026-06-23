---
name: AForce welcome-hero surface (dark photo front door)
description: The Welcome Hero is the live cold-launch front door; rules for keeping system/status-bar + bone type legible when its hero photo is swapped.
---

# AForce Welcome Hero (full-bleed photo front door)

`components/welcome/WelcomeHero.tsx` is the LIVE cold-launch front door. It is
mounted in `app/_layout.tsx` (AppShell) and plays AFTER the OpeningSequence
cinematic via the phase machine `opening → welcome → done`. replit.md's note
that "the welcome lobby was removed" is STALE — this hero is real and reachable.

The screen is a full-bleed `assets/images/welcome-hero.png` (`require`d, expo-image
`contentFit="cover"`) with the eyebrow, AFORCE wordmark, tagline, and GET STARTED /
SIGN IN pills all rendered as CODE on top. To restyle the photo, swap the PNG and
leave the text components alone ("change the image only").

## Rule — swapping the hero photo's tonal value cascades to status bar + eyebrow color

The hero photo is currently a DARK gym portrait (intense face, near-black top).
Three things are coupled to that tonal value and must move together if the photo's
TOP region brightness ever changes:
- **Status bar** — AppShell forces `<StatusBar style="light" />` for ALL phases
  (every surface, including welcome, is dark-topped). If a future hero has a LIGHT
  top, the welcome phase must locally override to `dark` glyphs (scoped to
  `phase === 'welcome'`) or the clock/battery wash out.
- **Eyebrow color** — the top "ticker" eyebrow uses `BONE` so it reads on the dark
  top. On a light-topped photo it must flip to cinematic-black `#0D0D0D`.
- **Wordmark + tagline + pills** sit in the LOWER third over the BOTTOM-weighted
  scrim (`SCRIM_COLORS`: transparent top half → ~0.95 `#0D0D0D` at the bottom), so
  bone type there stays legible regardless of the photo's top brightness.

**Why:** white/bone elements (system glyphs, eyebrow, wordmark) vanish on a light
background; black elements vanish on a dark one. The hero photo has been BOTH a
light concrete-wall image and a dark gym image across revisions — every swap
inverts the status-bar + eyebrow-color assumptions, so audit all three together.

**How to apply:** when handed a baked PNG that already contains the wordmark /
tagline / buttons, do NOT use it whole (it doubles the coded text) — crop to the
clean photo region (text-free) and keep the coded copy. Then check the top-region
brightness and set status bar + eyebrow color to match.

**Verification note:** the live Expo cold-launch overlay can't be captured by the
web app-preview screenshot (documented blank-white artifact during the crossfading
absolute-fill overlays). Verify the cropped asset directly, or on a real
device/simulator — not web.

## Rule — sourcing a REAL licensed hero photo via imageSearch

When the ask is a "real / licensed, not AI-looking" hero photo, only
free-commercial sources are safe to drop in: **Pexels / Unsplash / Pixabay**.
`imageSearch` mixes in Getty/iStock (paid) heavily — for action/athlete queries
the *majority* of results are Getty, so filter to free domains and expect a thin
yield. Download by Pexels id at higher res
(`images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?auto=compress&cs=tinysrgb&w=1200`),
then VIEW every candidate — titles lie about race/gender and "athlete" results
often come back as studio physique/boudoir, not gym action.

**Why:** the user iterated for many rounds rejecting AI images; the constraint is
licensing (must be free-commercial) AND content (a Black athlete actually working
out, dark/cinematic). That intersection is genuinely sparse in free stock — the
cable-rig lat-pulldown shot was the one image satisfying all of it.

**How to apply:** keep the swap a pure asset replace (no AI upscale/bg-removal/
re-render — that reintroduces the "AI look"). The component is `contentFit="cover"`
+ centred, so a centred subject needs no manual crop; just convert the jpg to
`welcome-hero.png`, clear Metro/Expo caches, and restart the expo workflow (the
asset is cached).
