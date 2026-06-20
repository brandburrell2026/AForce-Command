---
name: AForce OS global-support audit (units, date/number localization, Arabic RTL, foldable layout)
description: What's actually internationalized vs. not — metric units are solid, numbers aren't localized, Arabic is gated+placeholder, and the foldable responsive system exists but is untested on a real Fold.
---

# AForce OS global-support verification

## Units — metric fully supported (PASS)
`utils/units.ts` stores everything canonical-metric (kg, °C, mL, cm) and converts on
display. Metric AND imperial covered for all three asked-for quantities — height
(cm ↔ ft/in to half-inch), weight (kg ↔ lbs), temperature (°C ↔ °F) — plus volume
(mL ↔ oz). Per-unit toggles on the Preferences card + a single Imperial/Metric switch
in onboarding (`unitPreferencesForMeasurementSystem`). Pure, unit-tested helpers.

## Date/number localization — PARTIAL / GAP
**Numbers are NOT localized.** Formatting is `.toFixed()` / `Math.round()` + hardcoded
string concat (`${...} lbs`, `${...} mL`, `${...}°C`) — no `Intl.NumberFormat`, so
decimal separators / digit grouping never follow the selected language (a `fr` user
still sees `1234.5`, not `1 234,5`). **Dates are only partially localized:** some
surfaces use `Intl.DateTimeFormat`, but call sites pass `undefined` locale (e.g.
`toLocaleDateString(undefined, …)`), which follows the DEVICE locale, not the in-app
i18next-selected language. So switching the app to French doesn't reformat numbers and
won't reformat dates unless the device is also French. **Why it matters:** "localized
dates and numbers" is only half-met; closing it means routing formatting through
`Intl.*` bound to the active i18n locale across call sites (many touch points).

## Arabic + RTL — wired but GATED and NOT production-ready (confirm before activating)
`services/i18nService.ts`: visible launch set is `SUPPORTED_LANGUAGES` = en/es/fr/de/pt/it.
Arabic (`ar`) is in `HIDDEN_LANGUAGES` (with zh/ja/ko/hi), its resource is loaded, and
it is NOT in `LanguageSelector` (which only maps `SUPPORTED_LANGUAGES`). RTL scaffolding
exists: `I18nManager.allowRTL(true)` at init, `isRTLLanguage('ar')===true`, and
`setLanguage` calls `forceRTL(shouldBeRTL)`. BUT three readiness blockers: (1) the hidden
locale JSONs are verbatim English placeholders, so activating Arabic shows English text in
an RTL frame, not Arabic; (2) `forceRTL` only takes effect on next app launch (RN limit) —
the code comments a "prompt for reload" responsibility but no reachable caller does it
(Arabic isn't selectable); (3) custom-positioned layouts (absolute offsets, left/right
paddings, charts, orb) need a real RTL audit — flexbox auto-flips but bespoke styling
won't. **Disposition:** Arabic is correctly inactive; do NOT flip `spec_language_ar`
without owner confirmation + translations + an RTL layout pass.

## Foldable / responsive — system EXISTS, no physical Fold test (readiness only)
`utils/layoutBreakpoints.ts` defines a real device-class system keyed on shortest edge:
`narrow` (≤319, Galaxy Fold cover ~280px) and `foldOpen` (600-839, Fold unfolded), each
with per-class tokens (orbSize, contentMaxWidth, gutter, titleSize, isWide). Driven by
`useWindowDimensions` via `hooks/useDeviceClass.ts` + `useResponsiveLayout.ts`, so it
reacts live to a fold/unfold; `AdaptiveScreenWrapper.tsx` centers content in a max-width
column on wide screens (dominant pattern). So layouts are DESIGNED to adapt to both Fold
states, but this can't be physically verified in the Replit web preview — folded clipping
and the fold transition need an Android emulator with a Fold profile or a device build.
Some web-only fixed paddings exist (`constants/layout.ts`) but don't affect native Fold.
