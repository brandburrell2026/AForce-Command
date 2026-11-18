# AFORCE OS · Revised audit and plan against Complete App Spec v1.8.2

**Date:** 2026-11-18 · **Code:** `main@37fd3025` · **Builds from this commit:** iPhone 164, Android 7
**Governing spec:** AFORCE OS Complete App Spec v1.8.2 (Nov 11, 2026), per Julius's clarification relayed by Brandon on 2026-11-18.
**Status of this document:** audit and plan only. It changes no code and resolves no conflict.

---

## 1. Specification authority

| Item | Finding |
|---|---|
| Spec file | `AFORCE_OS_Complete_App_Spec_v1.8.2.md` re-read from the spec artifact today. Its checksum (`sha256 c1b0edce…`) is identical to the copy the Proof Tracker and the visual gap report were built against. **Nothing in the spec changed.** |
| Prototype | "Every tab, one system." re-read today. Used as the look, layout and motion reference only (Part 0). Its sample data, preset modes, scripted CB1–CB14 turns, simulated sources and mocked integrations prove nothing about production. |
| v1.8.3 and v1.9 | Remain **proposed**. No part of them is treated as overriding v1.8.2. The documents stay in `docs/` for reference. |
| Higher-priority rules | The repo's governance set, the stop-ship register and the off-limits list in `CLAUDE.md` still apply. Where they disagree with v1.8.2 the disagreement is listed in §5, not resolved. |
| Embedded instructions | The spec landing page carries a block addressed to coding agents, including "Delete that one from the repo" (the Nov 6 prototype zip). **Not acted on.** Deleting anything needs your instruction. |

**What this means for the earlier audit.** The visual gap report (`docs/AFORCE-OS-Visual-Gap-Report-2026-11-18.md`) was written against Appendix F (Master Brief) and Appendix G (Screen Upgrade v1.1), which are inside v1.8.2, so its findings stand. The v1.9 A–H audit (`docs/AFORCE-OS-v1.9-Audit-A-H-2026-11-18.md`) is now reference only: its defect findings are still facts about the code, but its proposed-spec items carry no authority.

---

## 2. Current implementation status

### 2.1 Build order (Part 3)

| Step | Requirement | Status |
|---|---|---|
| 1 | Repo reconciliation: colour-token swap, Screen Upgrade v1.1 fixes, decisions D1–D8 | **In progress.** Tokens consolidated (#1231). Mark, bottom bar and primary buttons done (#1232–#1234). "Screenshot every tab" **not done**. Remaining Screen Upgrade items in §3. D1–D8 not re-audited in this pass |
| 2 | Moment ID and decision record | Partial. A seal records its method and window (`MomentPreparation.sealedBy`). The full decision record (B §11.2) is not audited as complete |
| 3 | Workout pilot on real iPhone and Android | **Not proven.** 4 of 17 W rows partly built, 13 not built. No device run recorded |
| 3a | Lock-screen card | Not built |
| 4 | Consented usefulness measures | Not built |
| 5 | Representative flows | 2 of 15 R rows partly built, 13 not built |
| 6 | Circle v1.2, then Social v0.4.1 | Circle screens exist; not built to v1.2. Social v0.4.1 source is not in the repo |
| 7 | Moment Link v0.2 | Not built |
| 8 | Optional product references | Not built |

Part 0 says: prove one complete workout Moment and the next comparable one on both phones **before** expanding. That has not happened. The visual work underway is step 1 and does not jump the order.

### 2.2 Acceptance rows (from `governance/PROOF-TRACKER.md`)

| Group | Built in code | Partly built | Not built | Passed on a device |
|---|---|---|---|---|
| W1–W17 workout pilot | 0 | 4 | 13 | **0** |
| R1–R15 representative flows | 0 | 2 | 13 | **0** |
| V1–V18 | 9 (V1–V4, V13–V17) | 4 (V5, V9, V10, V12) | 5 (V6, V7, V8, V11, V18) | **0** |
| CB1–CB14 | 2 (CB3, CB4) | 4 (CB6, CB12, CB13, CB14) | 8 (CB1, CB2, CB5, CB7–CB11) | **0** |
| G1–G5 device gates | — | — | — | **0 measured** |

"Built in code" means automated tests exist and pass. **No row is a PASS**: every row that needs a device is unverified, and the device script's pass log is empty.

### 2.3 Parts 6–8 behaviour asked for in the directive

| Requirement | Status |
|---|---|
| Voice approval rules ("seal it" only; "yes", "okay" never seal) | Built on the Seal view, internal builds only. Tests pass. Device: unverified |
| Seven-second visible confirmation window | Built (strip, countdown, numbered windows, one end state each). Read-back end is **estimated** from text length, not reported by the voice service (#47). Device: unverified |
| Fresh read-back after any change | Built for time and day changes and follow-up questions. Device: unverified |
| "Legs fresh" is a goal | Built ("Morning lift" + Goal: Legs fresh). Tests pass |
| Upper-body timing-only plans | Built. Every workout plan shows "Not offered yet" for exercises, because no playbook is reviewed |
| Sample-data disclosure | Prototype only. Production has no simulated sources, so there is nothing to label; readiness "shown only" wording (8.4.3) is not audited |
| CB1–CB14 | See 2.2. Eight rows depend on the conversational model, which is switched off by decision C3 |
| Nothing effective until sealed | Holds in the built path: the parser proposes, only a hold or an in-window "seal it" commits |

---

## 3. Visual mismatches

Done and on `main`: one palette (#1231), the N–И mark as one component (#1232), bottom bar with the 64pt orb (#1233), warm-white primary buttons (#1234). **None of it has been seen on a device by me**; builds 163/164 and Android 6/7 are with Brandon.

Still mismatched:

| Area | Mismatch |
|---|---|
| **N–И mark** | Spec: production uses the **approved vector asset** (Part 0, C §6). App: a typed Inter 300 component, which the spec calls the prototype's approximation. No approved vector is in the repo |
| Typography | Archivo Black still in the opening monogram, `WelcomeHero`, reset-password title, investor demo overlay. 53 uppercase styles and about 388 all-caps strings. Eyebrows and captions not yet muted |
| Colour | Selected pills (segmented controls, tab pills, pickers) still red. Status colours (green, amber, red for scores) come from the protected `statusColor.ts` and conflict with "scores never red" |
| Glows | Non-orb glows remain |
| Buttons | All-caps labels inside otherwise correct buttons ("SAVE 8 OUNCES TO LOG") |
| Home | No time-of-day greeting, ring hero, "Start", or "Why this?" link; red kicker and red-railed plan card remain |
| Hydration | **"Log water" is still the action name.** Spec (Nov 6, register #40): "Log a drink" with a drink choice. No last-updated time; empty rows shown; log result has no Undo |
| HydroState | Not always labelled an estimate with source and update time. "Collecting" and "Starting target" states: "Starting point" label exists (#1224); the rest not verified |
| One Breath | Prompt copy not the approved short prompt; the reservation paste form is still present; confirmation-window UI exists only on the internal Seal view |
| Moments | No Now / Upcoming / Done grouping or row states. No World photography |
| Circles | Not built to Circle v1.2. No "Start a Moment". Kickers still red |
| Profile | Streak and aura chips remain (spec: no ranks, streaks, trophies). Profile entry exists on Home only, not every tab header |
| Performance Signal | No trend line; list not muted |
| HydroScan | Not the five-step flow |
| Navigation | Tab-change haptic absent (earlier founder rule removed it) |
| Trademark | See §4 |

Screen-by-screen detail is in the gap report §4; it is unchanged.

---

## 4. Missing requirements

**One Breath and approval**
- Conversational turns (answer / clarify / propose / decline): not built. Blocked by C3.
- Messages and shares: 5-second pending send with Undo (V5), recipient and exact text read back (V6), "send it" / "share it" (CB9): not built.
- Unclear-word block and "Remember" (V7): not built.
- Transcription benchmark by accent, noise and language (V8): not run.
- "Already sealed at …" copy (CB13): not built. The duplicate is already ignored.
- Offline / model-timeout draft keeping (CB10): not built.
- Safety mentions beyond chest pain (CB14, R9): not built. Needs expert-reviewed wording.
- Playback-end signal from the voice service, and audio with the silent switch on (8.5, V18): not built. Waits on #47.

**Loop and platform**
- Workout pilot end to end, automatic touches, lock-screen card, timing-only calendar shift, status line on every page, Siri App Intents and Android App Actions.
- Learning loop, Replay, lessons and lesson migration (Appendix B).
- First launch and onboarding to Appendix C.
- Circle v1.2, Worlds and weather, Social v0.4.1, Moment Link v0.2.

**Brand and photography**
- **App ™:** present in two places (opening screen, Profile footer) plus the Travel share card. See conflict K4 on placement.
- **Website ™ (audited today, read-only, not modified):** `joinaforce.com/aforce-os` has **no ™ anywhere**. The hero wordmark, the page title and the share title read "AFORCE OS" without it, and the footer trademark line is absent. Spec 8.6.3 requires all three. The site lives in a separate repo.
- **Photography:** every World photo in the prototype is an AI sample, cleared for TestFlight and investor demos only (register #20). None is shipped in the app. Travel city photos: 28 of 40 picks cleared, 12 editorial-only picks still need replacing. No licensed-photo plan is recorded.

**Sources not in the repo:** Social v0.4.1, HydroScan v2, the approved N–И vector, the 19 "Activity only" assets.

---

## 5. Specification conflicts (logged, not resolved)

| # | Conflict | Current handling |
|---|---|---|
| K1 | **Directive vs decision C3.** The directive asks for CB1–CB14, most of which need a conversational model. C3 (2026-11-12) says no AI model in One Breath for beta, and the directive itself says not to activate one until reconciled | Model stays off. CB rows that need it stay "not built" |
| K2 | **Voice is member-facing (Part 6.1) vs C6.** Voice sealing is internal until the device script passes on both phones and the counsel brief is updated | Internal only |
| K3 | **Every reply spoken (8.5) vs C4 and stop-ship SS-17.** Spoken output must respect Coach Mode, Quiet and Do Not Disturb | Kept behind those controls |
| K4 | **™ placement.** Spec: on the opening-screen wordmark under the mark. App (decision C5): a small "AFORCE OS™" line under "NON — NEGOTIABLE"; the "AFORCE" wordmark is unmarked. The directive now says "correct AFORCE OS™ placement" | Needs a decision: keep C5 or move it |
| K5 | **Ritual spelling.** Spec and prototype: "Lock In". Site, manifesto video and Brandon's 2026-11-11 choice: "LOCK-IN" | Needs a decision |
| K6 | **Status colours.** Spec: scores never red, no green/teal/amber. `statusColor.ts` is protected | No change without recorded approval |
| K7 | **Project `CLAUDE.md` brand section** names `#C1281B`, `#0D0D0D` and Archivo Black. Spec retires all three | File needs a founder-approved update |
| K8 | **Leaderboard and achievements.** Spec: no ranks, streaks, trophies. A 2026-08-27 founder ruling keeps both screens | Kept |
| K9 | **Tab haptic.** Screen Upgrade asks for a light tick; an earlier founder rule removed it | Not added |
| K10 | **When the Home number first appears.** Spec: a new member never sees "Depleted". App shows it after one logged drink. Changing it is behaviour, and touches scoring copy | Not changed |
| K11 | **Engine boundary (Part 0).** The spec does not supply the full HydroState algorithm or personal-target rules and says to preserve validated behaviour. HydroState is `hydrostate-v2.0`; the 96 oz target is labelled a starting point | Preserved |
| K12 | **Work merged under the v1.9 correction order** (#1224–#1229: duplicate-log protection, Smart Capture wording, analytics filtering, private notification titles, Profile entry) | Bug and safety fixes. I found none that contradicts v1.8.2, but they were not individually re-checked against it in this pass |

C1–C7 and their decisions are in the Proof Tracker §7.1 and are unchanged.

---

## 6. Founder decisions required

**Julius**
1. C3 and register #41/#42: may a conversational model run in One Breath, with which provider, retention and no-training terms? Until then 8 CB rows cannot be built.
2. Register #47: production voice and provider (blocks V18 and a true read-back end).
3. Register #44 and #48, and safety wording for CB14 / R9: expert review.
4. Register #43, #45: session timeout and "material change" thresholds.
5. K4: ™ placement on the opening screen.
6. K5: "Lock In" or "LOCK-IN".
7. K6: recorded approval to change, or bypass, status colours.
8. Register #20: licensed photography plan and owner.
9. Register #49: trademark status with AWG Law.
10. The approved N–И vector asset.

**Brandon**
11. K7: approve updating the `CLAUDE.md` brand section.
12. K8, K9, K10: leaderboard and achievements, tab haptic, first appearance of the Home number.
13. Destructive-button colour (delete, sign out).
14. Authorisation for the website ™ change, and who makes it.
15. Whether to delete the Nov 6 prototype zip from the repo, as the spec page asks.
16. Supply Social v0.4.1 and HydroScan v2 sources.
17. Edit window and trainer visibility for drink records (blocks edit / delete / undo).

---

## 7. Prioritised implementation plan

Each item is one small pull request with tests; nothing here changes HydroState maths, backend behaviour or stored data.

**A. Proof first (needs you, no code)**
1. Run `governance/ONE-BREATH-DEVICE-QA.md` on iPhone build 164 and Android build 7. This is the only way any V or CB row can pass.
2. Screenshot every tab on both phones (build order step 1).

**B. Visual reconciliation, no decision needed**
3. Eyebrows and glows (V5).
4. Profile entry on every tab header (V6).
5. Selected pills to the warm-white segmented style (V9).
6. "Log a drink" naming and drink-choice sheet (register #40), with Hydration last-updated time and hidden empty rows (V8).
7. Home: greeting, "Start", "Why this?" (V7).
8. Moments: Now / Upcoming / Done (V10).
9. Profile: remove streak and aura chips, "Member since" (V9).
10. Uppercase, Archivo Black and ungated-motion sweep (V13).
11. One Breath prompt copy (V11). The paste form is a working entry path, so removal is confirmed first.

**C. One Breath behaviour that needs no model**
12. "Already sealed at …" (CB13).
13. Offline draft keeping and "Nothing was saved or sent" (CB10, deterministic path).
14. CB6 copy to the spec line.
15. Confirmation-window UI outside the internal preview — only after the device run and C6.

**D. Blocked on decisions in §6**
16. Status colours (K6). 17. ™ placement (K4). 18. Mark from the approved vector. 19. Conversational turns (C3, #41, #42). 20. Production voice, silent-switch audio, playback end (#47). 21. Safety branches (expert review). 22. Send/share read-back and Undo (V5, V6, CB9).

**E. Later build-order steps**
23. Workout pilot to completion, then lock-screen card, usefulness measures, representative flows, Circle v1.2, Social v0.4.1, Moment Link.

**Still held from earlier work:** drink edit / delete / undo; token encryption; account-deletion stages 3–5 (endpoint stays off until Julius and counsel sign off).

---

## 8. Acceptance tests and device verification

| What | How | State today |
|---|---|---|
| V1–V4, V13–V17 | Device script rows on iPhone (voice and typed) and Android (typed only; voice is iPhone-only today) | Automated tests pass. **Device: unverified** |
| V5–V8, V10–V12, V18 | Not runnable: not built or partly built | **Unverified** |
| V9 | Routing tested; scan confirmation and the estimate label need a device check | **Unverified** |
| CB3, CB4 | Device script | Automated tests pass. **Device: unverified** |
| CB1, CB2, CB5, CB7–CB11 | Not runnable: not built | **Unverified** |
| CB6, CB12, CB13, CB14 | Partly built | **Unverified** |
| G1–G5 | p95 over 30 runs on a current iPhone and a mid-range Android | **Not measured** |
| Visual steps V1–V4 of the redesign | Screenshots of every tab, both phones, light text sizes and largest Dynamic Type, Reduce Motion on | **Not seen on a device** |

**Evidence rule.** A row becomes PASS in `governance/PROOF-TRACKER.md` only with the device, OS version, build number, date and tester recorded, on both platforms where the row needs a device. I cannot hold a phone: I can prepare builds, the script and the tracker, and record what you report. I have not run, and will not claim, any device test.

**Preserved in this pass:** no code changed, no database touched, no existing TestFlight build altered or expired, website untouched.
