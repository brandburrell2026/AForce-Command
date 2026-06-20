---
name: AForce OS experience-layer status (Territory, Circles, Performance Timeline, Performance Mode, Competition Mode)
description: Which of the 5 branded experience features are real routed screens vs engine-only/dormant, and what "Performance Mode" / "Competition Mode" actually are in the code.
---

# AForce OS — "experience layer" feature status

Three are real, reachable screens; two are NOT the full experience the branding implies.

## Built & reachable (PASS)
- **Territory™** — full surface: engine `services/territoryEngine.ts` + `services/mapAggregationService.ts`,
  route `app/territory.tsx` → `screens/TerritoryScreen.tsx` (stylized US map, region markers,
  featured battles), `components/TerritoryMap.tsx`. Flags `city/state/team_competition_enabled`
  all default true. Tested (`services/__tests__/territoryEngine.test.ts`).
- **Circles™** — full surface: `services/circleService.ts` + `services/socialModeEngine.ts`,
  routes `app/circles.tsx` (+ `app/circles/[id]`), `screens/CirclesScreen.tsx` +
  `ManageCircleScreen.tsx`. Flag `spec_social: true`. (Legacy `app/(tabs)/social.tsx` is
  `href:null`; the visible hub is the Community tab `app/(tabs)/competition.tsx`.)
- **Performance Timeline™** — IS the "Hydration" tab: route `app/(tabs)/journal.tsx` →
  `screens/JournalScreen.tsx` (range picker, score charts, rollups), engine
  `services/performanceTimeline.ts`. Flag `spec_hydroJournal: true`. (Journal was relabeled
  "PERFORMANCE TIMELINE" in i18n; one of the 5 visible tabs.)

## Partial / not the branded experience (GAP — building = major, owner sign-off)
- **Performance Mode™ ("full optimization environment")** — NO such environment/screen exists.
  What exists: (1) a DORMANT `components/home/AthleteModeCard.tsx` (built but rendered nowhere —
  only self-references + a `HomeDashboard.tsx` comment that it was trimmed from Home); (2) a
  VOICE/autopilot toggle — `voiceService.ts`/`intentClassifier.ts` map "performance mode on/off"
  → `SET_AUTOPILOT` ("Performance Mode is now on."). So today it's a label + voice toggle + a
  dormant progress card, not an optimization environment. Flags `performance_age_enabled` /
  `metabolic_readiness_enabled` default false.
- **Competition Mode™ ("event-day protocol system")** — engine only + rankings UI. Engine
  `services/competitionEngine.ts` (4-part score: Performance+Compliance+Consistency+Recovery,
  `buildSnapshot`); rankings render in `screens/CompetitionScreen.tsx` via the Community tab.
  There is NO `app/competition-mode.tsx` and no "enter event-day protocol" flow. The
  `app/(tabs)/protocol.tsx` ("AForce Protocol") handles recovery protocols, not competition.

## Why building the two gaps is not a quick fill
A "full optimization environment" and an "event-day protocol flow" are new full-screen product
surfaces requiring design + product decisions, and likely new routes/nav — which the build-lock
("Navigation may not expand"; only Home+nav redesign was owner-authorized) forbids without
explicit owner approval. Verify-and-report + ask before building, per the iterative-dev pref.
