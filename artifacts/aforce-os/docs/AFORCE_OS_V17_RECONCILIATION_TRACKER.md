# AFORCE OS v1.7 reconciliation tracker

**Branch:** `feat/aforce-os-v17-reconciliation`  
**Source package:** `AFORCE_OS_Codex_Handoff_Nov6`  
**Status:** in progress — no requirement is complete until the listed evidence exists.

## Phase 1 plan: colors and Screen Upgrade v1.1

### Files and routes in the first implementation slice

| Area | Current location | Planned change | Status |
|---|---|---|---|
| Brand source of truth | `theme/colors.ts`, `theme/afTokens.ts`, `theme/editorialTokens.ts` | Adopt the Nov 5 brand values: black `#090A0A`, warm white `#F7F4EF`, signal red `#E51E2A`, proof blue `#2765FF`, and the approved text, line and panel tokens. Remove legacy frozen-color commentary and prevent new raw member-surface colors. | In progress |
| Token tests | `theme/__tests__/afTokens.test.ts`, related token tests | Replace tests that freeze the retired red/canvas values; add assertions for the v1.7 palette and allowed orb gradients. | Planned |
| App frame | `app/_layout.tsx`, `components/GradientBackground.tsx`, `components/ui/AFScreen.tsx` | Move the app canvas and navigation frame to the v1.7 black and remove decorative color gradients. | Planned |
| Bottom navigation | `app/(tabs)/_layout.tsx` | Ship the approved member-facing labels/order: Home, Hydration, raised One Breath, Moments, Circles. Keep old route names only for deep-link compatibility. | Planned |
| Home | `app/(tabs)/index.tsx`, `components/editorial/home/EditorialHomeScreen.tsx`, `components/home/HomeScreenV2.tsx` | Use “Collecting” and a neutral ring when evidence is insufficient; make the one useful next move visible above the tab bar. | Planned |
| Hydration | `app/(tabs)/journal.tsx`, `components/hydration/*` | Replace decorative red actions with neutral actions; retain the v2 private Gentle Hydration boundary. | Planned |
| One Breath | `components/oneBreath/*` and its route | Use the short prompt and the red orb only where the v1.7 brief permits it. | Planned |
| Moments/Profile | `app/(tabs)/moments-tab.tsx`, `components/editorial/moments/*`, `components/profile/*` | Hide unfinished/internal surfaces behind flags and remove member-facing gamification/status copy. | Planned |
| Circle | `app/(tabs)/competition.tsx`, `components/community/*` | Keep a separate Phase 3 implementation: private people and exact, consented Moment fields only; no rank, score, HydroState, streak, challenge, or leaderboard. | Not started |

### Routes that remain compatible while labels change

| Member label | Current route | Implementation status |
|---|---|---|
| Home | `/(tabs)/index` | Existing route; visual reconciliation pending |
| Hydration | `/(tabs)/journal` | Existing route; visual reconciliation pending |
| One Breath | existing One Breath route/action | Existing flow; short-form review pending |
| Moments | `/(tabs)/moments-tab` | Existing gated route; label/order reconciliation pending |
| Circles | `/(tabs)/competition` | Existing route; must be replaced rather than cosmetically retaining legacy competition semantics |

## Workout pilot plan

The pilot will be built and validated after the visual reconciliation. It uses one Moment ID throughout and does not use health state, scores, or inferred behavior to write lessons.

| Proof row | Pilot evidence required | Data / route work |
|---|---|---|
| W1–W5 | Night-before prep, changed plan/re-seal, voice/text parity, correction, duplicate-tap and offline-seal behavior | Moment record plus idempotent Seal handling; decision record attached to the Moment ID |
| W6–W7 | Quiet behavior and deliberate/first-open Return | Return prompt schedule and explicit Return action |
| W8–W10 | Replay, reviewed lesson, restart restoration | `aforce_reflections`, `aforce_lessons`, `aforce_lesson_applications`, local scoped storage |
| W11 | Stale/denied data fallback | source/freshness field and honest fallback state |
| W13 | Latency measurements | device test log, 30-run p95 records |
| W14 | Schema migration/recovery | `schema_version` on every lesson and reversible migration backup |
| W15–W17 | Automatic-touch, lock-screen, calendar behavior | explicit permissions and the delivery log; no auto-sealing |
| R9 | Safety branch | timing-only plan with no exercise options for the defined safety inputs |

### Required data tables (Appendix B §9.4)

`aforce_reflections`, `aforce_lessons`, `aforce_lesson_applications`, `aforce_voice_words`, `aforce_shortcuts`, `aforce_return_prompts`, and `aforce_learning_consent`.

Every table is member-scoped and part of full-account deletion. Lessons store a template ID and reviewed text only, never executable free text; every lesson carries `schema_version`.

## Decisions and conflicts logged

| Register | Finding / decision | Handling in this branch |
|---|---|---|
| D1 | No implicit member-specific learning | Do not add learning writes until explicit, separate consent and route audit exist. |
| D2 | Retire gamification | Legacy leaderboard/rank/streak/challenge surfaces are inventory targets. They will not be repurposed as Circle. |
| D3 | Circle never shares scores or HydroState | Circle work will use consented Moment fields only. |
| D4 | Deletion must cover complete member record | New loop tables must be included before the workout pilot is sealed. |
| D5 | Lessons never change HydroState, scores, targets or protocols | Preserve the existing scoring boundary. |
| D6 | Learning defaults off | No effective-runtime enablement until reviewed opt-in exists. |
| D7 | Remove outcome-response score writes | Audit separately from UI work; do not silently change score behavior in a styling commit. |
| Color-source conflict | v1.7 replaces the legacy red/canvas palette; the prior Gentle Hydration v2 brief protects `theme/statusColor.ts` and `utils/scoringEngine.ts`. | Apply v1.7 presentation tokens, but leave the protected status/scoring boundary unchanged. Record and test any later governed scoring decision separately. |
| Circle asset gate | 19 solo “Activity only” World photos are required but absent. | Keep current scene behavior behind the asset gate; do not infer a scene style. |

## Validation evidence to add

- Token tests and route/component tests for each altered screen.
- Screenshot set for Home, Hydration, One Breath, Moments, Circles, and Profile at phone size.
- Dynamic Type and Reduce Motion checks for the changed member flows.
- Real-device records for W1–W17 and R1–R14; prototype screenshots do not count as completion.
