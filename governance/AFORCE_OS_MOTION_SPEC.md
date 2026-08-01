# AForce OS — Motion Spec (Phase 0)

**Status:** Draft for founder review · Read-only audit → codified spec · **Owner:** Julius + Brandon
**Verified against:** `52986ece` (2026-08-01). Source: Phase 0L. Token source: `theme/afTokens.ts`.

> This spec **codifies the motion system already present in `afMotion`** and records adoption gaps.
> AForce motion communicates state, freshness, loading, intake processing, command acceptance,
> verified completion, recovery, and environmental pressure — never decoration. **Every animation
> must have a reduced-motion / static alternative.** No confetti, no looping celebration.

---

## 1. Timing classes (canonical — `afMotion.durations`, `afTokens.ts:122-132`)

| Class | Token | ms | Use |
|---|---|---|---|
| Press feedback | `fast` | 120 | press-scale, tab dot |
| Selection | `selection` | 150 | tone/opacity change, no bounce |
| Micro transition | `standard` | 220 | default UI transition |
| Entrance | `entrance` | 260 | opacity + short translate (`entranceTranslateY: 10`), ease-out |
| Sheet | `sheet` | 300 | native sheet spring |
| Content transition | `slow` | 360 | larger content transitions |
| State reveal | `cinematic` | 700 | hero reveals (arc draw-in, count-up) |
| Ambient | `pulse` | 3200 | recovery pulse — subtle, informative only |

Scale: `scale.rest = 1`, `scale.pressed = 0.97`. Easing: `standardOut [0.22,1,0.36,1]`,
`standardInOut [0.4,0,0.2,1]`. These bands match the prompt's press/micro/content/reveal/ambient
targets. **Recommendation:** treat `afMotion` as the single motion source; forbid scattered inline
durations in new work.

## 2. Reduced motion — honored, coverage thin (gap)

- Single unified signal: `hooks/useReducedMotion.ts:12-16` (wraps Reanimated's `useReducedMotion`,
  created to unify three prior divergent reads).
- **Gap:** only **6** files consult it (`AFSkeleton`, `AFReadinessArc`, `HomeScreenV2`,
  `AFMotionPressable`, `RecoveryCoachScreen`, + the hook) while **~36** use Reanimated and ~35 use RN
  `Animated`/`LayoutAnimation`. Most animated surfaces have **no verified static alternative.**
- Tested at logic level only: `components/ui/__tests__/motionLogic.test.ts`. No render-level reduced-
  motion assertions (0L).
- **Action (Plan P5):** extend the reduced-motion branch to every animated surface; add render tests
  asserting the static path.

## 3. Semantic motion → state mapping (target)

| Moment | Motion register | Reduced-motion fallback |
|---|---|---|
| HydroState resolve | calm reveal (`cinematic` 700) | instant value |
| Status arc | state color + thin arc draw | static arc |
| Command enter | restrained entrance (`entrance` 260 + translate 10) | static card |
| Intake processing | processing/reassessment indicator before any eligible score change | static "processing" label |
| Verified completion | success pulse (once) | static confirmation + Success haptic |
| Recovery / ambient pressure | `pulse` 3200 subtle, informative | none |

No confetti / looping celebration / decorative animation (Constitution Principle 11; prompt 0C1).

## 4. Haptics (0L)

`expo-haptics` in 71 files: `selectionAsync` ×71, `notification(Success)` ×17, `impact(Medium)` ×16,
`impact(Light)` ×8, `notification(Warning)` ×2, `impact(Heavy)` ×2.
- Intended mapping: Light = selection · Medium = command acceptance · Success = **verified completion
  only** · Warning = meaningful urgency · never decorative.
- **Gaps:** (a) **no global haptics opt-out** preference surfaced; (b) "Success only on verified
  completion" is per-call-site, not centrally guaranteed — spot-review + a shared haptics façade
  recommended. Sound/voice are optional and must be off by default (see SS-17).

## 5. Status
Motion tokens = **Live** (defined + tested, `afMotion`). Reduced-motion coverage + haptics opt-out =
**Partially Built**. Adoption of the token layer is opt-in per screen; enforcement is a Plan P5 item.

## 7. Night Out command experience — NO-c (2026-08-01)
`NightOutCommandScreen` honors reduced motion (`animate={!reducedMotion}` on the HydroState hero;
static fallback). Haptics: **medium** on START WATER (command acceptance), **success only after verified
COMPLETE WATER** (routed through `logIntake`), **light** for selection (Adjust/Not Now). No decorative
looping motion; no confetti/celebration on completion — the post-completion state is a neutral
"Water confirmed. Reassessing…". Web has no haptics (guarded).

## 6. Night Out Protocol cross-reference (2026-08-01)
Per `AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md` §14: **no celebration on Night Out activation or on alcohol
logging**; **neutral or no haptic for alcohol logging**; success feedback reserved for verified
beneficial completion only. **Currently compliant** — alcohol is logged via a separate `logSocialDrink`
path (no `notification(Success)`), and the screen uses light selection/impact haptics
(`SocialModeV2Screen.tsx:265,324`). Preserve this on rename.
