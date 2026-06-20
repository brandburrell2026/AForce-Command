---
name: AForce Location Intelligence surfacing
description: How Location Intelligence travel vs. ambient insight surface on the home screen, and why the travel i18n key looks unused.
---

The headless Location Intelligence engine surfaces on home through TWO different banners, by design:

- **Ambient environmental insight** (altitude / uv / air / heat_humid / baseline note) → `components/home/LocationInsightBanner.tsx` (flag-gated by `location_intelligence_enabled`, returns null when off → byte-identical home).
- **Travel advisory** → the Smart Modes TRAVEL mode rendered by `components/home/SmartModesBanner.tsx` (`useSmartModes` reads `useLocationIntelligence().travel.isTraveling`).

Do **NOT** add a second travel banner or surface travel inside `LocationInsightBanner` — that double-surfaces travel on home.

`locationIntel.protocol.travel_protocol` (present in all locales) is the i18n CONTRACT copy for the travel advisory; it is intentionally **not yet consumed** because Smart Modes guidance is currently hardcoded English in `utils/modes/smartModes.ts` for all four modes (heat/workout/travel/recovery) — a real localization gap once the flag is on.

`environmentalAdderOz` is Phase-1 only: gated + tested in `services/hydrationDemandSelector.ts` but no visible surface consumes the demand engine yet.

**Why:** spec Step 5 says "one Water-First location insight AND a Travel Protocol banner"; travel was already wired into Smart Modes in Step 4, so the only genuine new Step-5 surface is the ambient insight note.

**How to apply:** extending Location Intelligence UI → add ambient context to `LocationInsightBanner`; for travel, work through Smart Modes; localize Smart Modes guidance (point it at the i18n keys) before broad i18n QA.
