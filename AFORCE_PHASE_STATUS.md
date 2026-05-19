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
| 2  | Profile + Units + Login                            | ⏳     | |
| 3  | Bottom Navigation + Timeline                       | ⏳     | |
| 4  | HydroScan Core                                     | ⏳     | |
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
