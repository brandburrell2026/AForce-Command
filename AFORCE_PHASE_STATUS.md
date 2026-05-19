# AFORCE OS — Phase Status

Live tracker for the implementation order defined in
`AFORCE_FINAL_SPEC.md` (core) and `AFORCE_SOCIAL_CRUISE_ADDON.md`
(enhancement layer).

Update this file at the end of every phase. One phase at a time.
Stop after each phase and wait for approval before continuing.

Status legend: ⏳ pending · 🔧 in progress · ✅ shipped · 🚫 blocked

## Core Phases (AFORCE_FINAL_SPEC.md)

| #  | Phase                                              | Status | Notes |
| -- | -------------------------------------------------- | ------ | ----- |
| 1  | Opening Screen Safe-Area Fix                       | ✅     | Added `<StatusBar style="light" />` once at root layout so system glyphs (clock/battery/signal) stay visible against the pure-black opening canvas. Existing safe-area inset math on `app/splash.tsx` + `app/welcome.tsx` was already robust (`Math.max(insets.top + 28, winH * 0.08)`) and was left untouched. |
| 2  | Profile + Units + Login                            | ✅     | Audit: Profile (Clerk user binding, sign-out button), Units (weight lbs/kg, temp F/C, volume oz/mL with persistent slice + 137 lines of tests), and Login (sign-in 254 lines, sign-up 375 lines with email/password + Google SSO) were already built. Real gap: `app/index.tsx` had no `isSignedIn` check — sign-in screens were unreachable. Surgical fix: added auth gate in `app/index.tsx` (respecting `DEMO_MODE` so pitch screenshots keep working) + defensive `(auth)/_layout.tsx` redirect when already signed-in. |
| 3  | Bottom Navigation + Timeline                       | ✅     | Audit: already fully shipped. 6 tabs (Home, Check, Protocol, Timeline, Social, Profile) with dual implementations — `NativeTabs` on iOS (liquid glass) + classic `Tabs` on Android/web with custom `PlainTabButton` (haptic tick, WHOOP-cinematic styling, lime active tint, transparent BlurView on iOS, 84px web height). Timeline = `JournalScreen` ("PERFORMANCE TIMELINE" eyebrow, 7/30/90 range picker, section summaries Recovery/Heat/Hydration/Corrections/Territory/Streaks, Win Moments strip, score-over-time chart with band zones, collapsible day cards from `/journal/rollups`, Export PDF). Route file stays `journal.tsx` for deep-link stability; user-facing label "Timeline" via i18n (`tabs.journal`). Store correctly excluded from bottom nav. No code changes required. |
| 4  | HydroScan Core                                     | ✅     | Audit: already fully shipped. Route `app/scan.tsx` → `HydrationScanScreen` (907 lines): scan → recognize → score → recommend → log into live store, with success flash overlay (20% PEAK tint + Haptics.Success + router.back at 800ms per spec §11). Companion: `app/urine-check.tsx` → `UrineHydrationCheckScreen` (261 lines). Services: `hydrationScanService`, `hydrationScoreService`, `hydrationStatus`, `productRecognitionService`, `scanCoachVoice` (174 lines, voice-coach script builder), `urineHydrationCheck`, `beverageComparisonEngine` (204 lines), `openFoodFactsService`. Components: ScanResultCard, ScanAICoachCard, ProductFitCard, AForceReplacementCard, CameraScanModal (Expo Camera barcode scanner on native), AddDrinkModal, SmartCaptureModal, WhyThisForYouCard, SuperfoodSignalsCard. Mock barcode tray + manual search field for web preview where Expo Camera is unavailable. Tests: `hydrationScanRecommendation.test.ts`, `scanCoachVoice.test.ts`, `drinkCatalog.test.ts`. No code changes required. |
| 5  | Orb Intelligence                                   | ⏳     | |
| 6  | Heat + Territory                                   | ⏳     | |
| 7  | Share System + BECOME AFORCE footer                | ⏳     | Referral spec #7 slices 1–3 already shipped |
| 8  | Legal + Compliance                                 | ⏳     | |
| 9  | Feature Locks (Guardian / Clutch hidden)           | ⏳     | |

## Addon Phases (AFORCE_SOCIAL_CRUISE_ADDON.md)

Locked until **all core phases above show ✅**.

### Social Additions

| Phase                | Status | Notes |
| -------------------- | ------ | ----- |
| Contexts             | ⏳     | Locked until core complete |
| Morning Reset        | ⏳     | Locked until core complete |
| Moments Engine       | ⏳     | Locked until core complete |

### Cruise Additions

| Phase                | Status | Notes |
| -------------------- | ------ | ----- |
| Voyage Recovery      | ⏳     | Locked until Social additions complete |
| Recovery Concierge   | ⏳     | Locked until Voyage Recovery complete |
| Cruise Contexts      | ⏳     | Locked until Recovery Concierge complete |

### Explicitly Not Built

- Recovery Journey — architecture only
- Journey Summary — architecture only
- Phantom — architecture only
