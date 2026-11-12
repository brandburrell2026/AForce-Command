# AFORCE OS · Proof Tracker (Complete App Spec v1.8.2)

**Status:** Open · **Owner:** Brandon (build evidence), Julius (decisions) · **Created:** 2026-11-12 against `main@0f68f387`
**Source:** AFORCE OS Complete App Spec v1.8.2 (Nov 11, 2026). Appendix A §7 defines the rows and columns; Part 6.7 adds V1–V12, Part 7.9 adds CB1–CB14 and Part 8.7 adds V13–V18.

**Rule:** nothing is built or proven until this file has evidence for it. A row is **PASS** only when the
*Test evidence* column names a test file or a device run (device, OS, build, date, tester) and the *Platform*
column names both iPhone and Android where the row needs a device (`D`). The prototype proves no production
behavior.

**Columns:** ID · Requirement · Source spec · Prototype · Implementation location · Test evidence · Platform · Gap.
*Implementation location* lists only code that exists on `main` today, from the 2026-11-12 audit. "Partial"
means the code covers part of the row, not that the row passes. Empty means nothing exists yet.

**Gap tags:** P prototype · S sample data · B backend · D real-device validation (iPhone + Android) ·
X expert review · ? product decision (Julius).

---

## 1. Workout pilot (Appendix A §7)

| ID | Requirement | Source spec | Prototype | Implementation location | Test evidence | Platform | Gap |
|---|---|---|---|---|---|---|---|
| W1 | Workout: night-before prep → Seal | A §1; Loop 11.2 | P | Partial: `components/oneBreath/MomentPreparationScreen.tsx` (mirror → plan → hold to seal) | | | B, D |
| W2 | Before the Moment: current / changed → re-seal, same Moment ID | A §1 stage 2 | P | Partial: change re-review in `MomentPreparationScreen.tsx`; `services/momentPreparationLifecycle.ts` | | | B, D |
| W3 | One Breath by voice and by text produce the same Mirror | A §1 stage 3 | P (voice simulated) | Partial: `hooks/useOneBreathVoice.native.ts` (iOS only) feeds the same parser `services/oneBreathDraft.ts` | | | D |
| W4 | Corrected input (Adjust, unclear word) | Loop §2 | P | | | | D |
| W5 | Seal once on duplicate taps; offline seal fails honestly | A §3 | P | Partial: `services/momentsStore.ts` `commitReviewedMoment` (transactionId idempotency) | | | B, D |
| W6 | Quiet: no interruptions; HR not used | A §1 stage 8 | P | | | | D, ? |
| W7 | Return once: deliberate return action or first app open after planned end (bedtime: real wake) | Loop 11.9 | P | | | | B, D |
| W8 | Replay → approved lesson → next comparable plan | Loop §2 | P | | | | B, D |
| W9 | Revisit: keep / edit / pause / delete | A §1 stage 12 | P | | | | B |
| W10 | App restart restores sealed plan and lessons | A §0 | S | | | | B, D |
| W11 | Stale or denied device data → honest fallback | A §6 | P | | | | D |
| W12 | Free/Upgrade switch: no data, consent or plan changes; no billing | A §4 | P | | | | B |
| W13 | Mirror latency ≤ 1.5 s and Seal ≤ 1 s on target devices | Nov 5 "Timing targets" | — | | | | D |
| W14 | Lesson schema migration and recovery | B §9.4.1, check 46 | — | | | | B |
| W15 | Automatic touches: at most 3 per Moment; Quiet, Focus and DND always win; never late at night; one per type across devices | A §1.1 | P | | | | B, D |
| W16 | Lock-screen card: 30 minutes before, then Lock In in place; no health values when hidden | A §1.1 | P (mock) | | | | D |
| W17 | Calendar spotting: read-only, one offer per event, never creates or seals | A §1.1 | — | | | | B, D |

## 2. Representative flows (Appendix A §7)

| ID | Requirement | Source spec | Prototype | Implementation location | Test evidence | Platform | Gap |
|---|---|---|---|---|---|---|---|
| R1 | Recreation (pickleball) flow | A §2 | P | | | | X, D |
| R2 | Work (presentation) flow | A §2 | P | | | | X, D |
| R3 | Sleep flow (wake-time Return) | A §2 | P | | | | X, D |
| R4 | Hydration (HydroScan, barcode) | Loop 11.7 | P | | | | D |
| R5 | Circle (invite, share a Moment, privacy) | Circle Worlds spec | P | | | | B, D |
| R6 | Moment Link guest, mobile web first | Appendix E | P | | | | B, D |
| R7 | Settings: Return and Circle notifications, Quiet always on, units display-only | A §3 | P | | | | B |
| R8 | Account: download data, full deletion (D4) | Loop D4 | P | | | | B, ? retention |
| R9 | Safety branch: recent surgery, pregnancy or chest pain → no exercise options, timing-only plan | A §5.2 | P | Partial: chest pain only, `utils/intelligence/decisionGuard.ts` `evaluateMomentSafety` | | | X |
| R10 | Scene style: solo default Activity only; Woman / Man optional; never inferred | D §8, §8.1 | — | | | | S assets, B, ? #29 |
| R11 | Primary action above the tab bar on first view at 390 × 844 and iPhone SE with text at 120% | Part 2 · Visual system | P | | | | D |
| R12 | No member-facing text under 11 pt; no review labels in a member build | Part 2 · Visual system | P | | | | B |
| R13 | Environment heat plan line only at 82°F or above, approved copy; Forecast details names source and update time | Part 2 · Later modules | P | | | | B, D |
| R14 | "Log a drink": drink choice saved with every log; only drinks with an approved rule move HydroState; others "not counted yet"; Undo removes the log | Part 0; register #40 | P | Partial: `components/DrinkChoiceModal.tsx` follows the rule but is **not mounted**. The live path (`AddDrinkModal` → `computeEffectiveOz`, `data/drinkCatalog.ts`) counts non-water drinks by coefficient. See C1 | | | B, X |
| R15 | Photo light follows the real sunrise and sunset for the Moment's place and local date | Appendix D §6 | P | | | | B, D |

## 3. Voice approval, hydration loop, scenes, connected app (Part 6.7)

| ID | Requirement | Source spec | Prototype | Implementation location | Test evidence | Platform | Gap |
|---|---|---|---|---|---|---|---|
| V1 | "Seal it" seals only inside the confirmation window after the full read-back; earlier or later does nothing | 6.1 | P | Wired on the Seal view (internal TestFlight preview only): `components/oneBreath/MomentPreparationScreen.tsx` + `utils/oneBreath/confirmationWindow.ts`. Read-back end is estimated from its length until the voice service reports playback end (#47) | `utils/__tests__/oneBreathConfirmationWindow.test.ts` (logic) · `components/__tests__/momentPreparation.render.test.tsx` (Seal view, typed) | | D |
| V2 | "Approve," "confirm," "yes," "okay," "sounds good" never seal or send; negations cancel | 6.1 | — | Wired on the Seal view (internal preview): `MomentPreparationScreen.tsx` + `confirmationWindow.ts` | `utils/__tests__/oneBreathConfirmationWindow.test.ts` (logic) · `components/__tests__/momentPreparation.render.test.tsx` (Seal view, typed) | | D |
| V3 | "Make it 7" rebuilds the plan, reads it back again, does not seal | 6.1 | P | Wired for time and day changes (`utils/oneBreath/timeChange.ts` `changedTime`, `changedDate`) | `utils/__tests__/oneBreathConfirmationWindow.test.ts` (logic) · `components/__tests__/momentPreparation.render.test.tsx` (Seal view, typed) | | D |
| V4 | A voice seal can be undone for about 5 s; undo returns the Moment to Awaiting seal everywhere | 6.1 | P | Wired: Undo button for 5 s after a spoken or typed seal; the Moment returns to awaiting seal in the shared store. Decision record `MomentPreparation.sealedBy` (method + window). Saying "undo" is handled but the sealed view has no mic yet | `utils/__tests__/oneBreathConfirmationWindow.test.ts` (logic) · `components/__tests__/momentPreparation.render.test.tsx` (Seal view, typed) | | D |
| V5 | Messages and shares pending 5 s with Undo; after delivery only "Send a correction" / "Stop sharing" | 6.1 | P | Partial: share revoke exists (`services/circleMomentSharingService.ts`); no send delay | | | D |
| V6 | No message sent without the recipient and exact text read back first | 6.1 | P | | | | D |
| V7 | An unclear word blocks the plan until fixed; a voice word saved only after "Remember" | 6.2 | P | | | | — |
| V8 | Transcription benchmark by accent, noise and language recorded before a provider is chosen | 6.2 | — | | | | B |
| V9 | A scan never logs without drink and amount confirmed; non-water drinks never change HydroState without an approved rule; HydroState always labeled an estimate | 6.3 | P | See R14 and C1 | | | D |
| V10 | Calendar change beyond timing shows the difference and needs a new seal; timing-only shifts every step and tells the member once | 6.4 | P | Partial: re-review on change in `MomentPreparationScreen.tsx`; no timing-only shift | | | D |
| V11 | Scene appears only after the Moment is identified; text WCAG AA over every scene; Social orb has the Proof Blue ring | 6.5 | P | | | | — |
| V12 | Status line shows the same state on every page and updates on seal/move; Siri App Intents and Android App Actions pass on real devices before lock-screen voice is advertised | 6.6, 6.1 | P | Partial: Home only, `components/home/LiveStatusLine.tsx` | | | B |

## 4. Conversational One Breath (Part 7.9)

| ID | Requirement | Source spec | Prototype | Implementation location | Test evidence | Platform | Gap |
|---|---|---|---|---|---|---|---|
| CB1 | Multi-turn workout: "Lift tomorrow" → "around 6:30, want my legs fresh" → "can I go at 7 instead?" → "seal it": plan at 6:30 read back, change to 7 rebuilds and reads back, sealed once only after "seal it" in the window | 7.9 | P (scripted) | | | | B, D |
| CB2 | Follow-up from confirmed context ("What should I eat before?") answered without re-asking the time, if a reviewed playbook covers it | 7.9 | P (scripted) | | | | B, X |
| CB3 | Ambiguous "Lift at 6:30": one clarification, no plan, nothing sealed | 7.9 | P (scripted) | Wired (internal preview): `suggestTimeQuestion` in `services/oneBreathDraft.ts` asks "6:30 in the morning or evening?" with two answers; nothing is created until answered | `services/__tests__/oneBreathDraft.test.ts` · `components/__tests__/momentPreparation.render.test.tsx` | | B |
| CB4 | "No, Saturday" changes the understood day; "What I heard" keeps the original words | 7.9 | P (scripted) | Wired on the Seal view (internal preview): `changedDate` in `utils/oneBreath/timeChange.ts`; the typed/spoken words are not rewritten | `utils/__tests__/oneBreathTimeChange.test.ts` · `components/__tests__/momentPreparation.render.test.tsx` | | B |
| CB5 | "How am I doing?": HydroState as an estimate with source and update time | 7.9 | P | | | | — |
| CB6 | "Log a 12 oz coffee": logged, HydroState unchanged, "Counts once the coffee rule is approved." | 7.9 | P | See C1 | | | — |
| CB7 | Question outside approved playbooks ("Should I take creatine?"): honest limit, no invented advice, one safe next step | 7.9 | P (scripted) | | | | B, X |
| CB8 | Topic change while a plan is pending: answered; plan stays unsealed and says it's pending | 7.9 | P (scripted) | | | | B |
| CB9 | Send/share in a conversation: read-back, only "send it" / "share it" in the window, 5 s Undo, then "Send a correction" / "Stop sharing" | 7.9 | P | | | | — |
| CB10 | Offline or model timeout during planning: draft and words kept, "Nothing was saved or sent," retry without retyping | 7.9 | P (simulated) | | | | B, D |
| CB11 | Learning off: no lesson created or applied from conversation; Replay saves a note and asks before turning learning on | 7.9 | P | | | | B |
| CB12 | Voice vs text parity: same sentence gives the same understood fields and proposal | 7.9 | P (simulated) | Partial: voice and text share `services/oneBreathDraft.ts`; on the Seal view, spoken and typed replies share `handleUtterance` → `confirmationWindow.ts` | | | D |
| CB13 | Double "seal it" or retry after a timeout: one sealed record, "Already sealed at …" | 7.9 | P (scripted) | Partial: `commitReviewedMoment` idempotency; a second "seal it" never confirms (`confirmationWindow.ts`); no "Already sealed at" copy | `utils/__tests__/oneBreathConfirmationWindow.test.ts` (logic) | | B, D |
| CB14 | Safety mention ("I had knee surgery three weeks ago"): approved safety behavior, no exercise options, coaching stops | 7.9 | P (scripted) | Partial: chest pain only (see R9) | | | B, X |

## 5. Confirmation window, understanding accuracy, voice output (Part 8.7)

| ID | Requirement | Source spec | Prototype | Implementation location | Test evidence | Platform | Gap |
|---|---|---|---|---|---|---|---|
| V13 | Window visibly closed during the read-back, opens with a countdown when it ends, records one end state | 8.1 | P | Wired on the Seal view (internal preview): strip, countdown, numbered window line, end-state lines | `utils/__tests__/oneBreathConfirmationWindow.test.ts` (logic) · `components/__tests__/momentPreparation.render.test.tsx` (Seal view, typed) | | D |
| V14 | "Seal it" during the read-back or after the window closes does nothing and shows the outside-window message; "Hear it again" reads back and opens a new window | 8.1 | P | Wired on the Seal view (internal preview), including Hear it again | `utils/__tests__/oneBreathConfirmationWindow.test.ts` (logic) · `components/__tests__/momentPreparation.render.test.tsx` (Seal view, typed) | | D |
| V15 | A change or follow-up question closes the window, then a fresh read-back opens a new numbered window | 8.1 | P | Wired on the Seal view (internal preview): time change and follow-up question both close the window and read back again; the follow-up gets the decline line until playbooks answer it (#44) | `utils/__tests__/oneBreathConfirmationWindow.test.ts` (logic) · `components/__tests__/momentPreparation.render.test.tsx` (Seal view, typed) | | D |
| V16 | "Want my legs fresh" gives Morning lift + Goal: Legs fresh, and no correction label | 8.2 | P | Wired (internal preview): goal extraction in `services/oneBreathDraft.ts` ("Legs fresh", "Build strength" → Goal field), bare activity → "Morning lift"; correction label only after a real correction | `services/__tests__/oneBreathDraft.test.ts` · `utils/__tests__/oneBreathWorkoutFocus.test.ts` · `components/__tests__/momentPreparation.render.test.tsx` | | B |
| V17 | Upper-body request gets a timing-only plan and "Not offered yet" for exercises | 8.3 | P | Wired (internal preview): `utils/oneBreath/workoutFocus.ts`; every workout plan shows "Not offered yet" for exercises (no playbook is reviewed, #3/#48) | `utils/__tests__/oneBreathWorkoutFocus.test.ts` · `components/__tests__/momentPreparation.render.test.tsx` | | B, X |
| V18 | Every scripted and preset line heard on a real iPhone and Android phone, including with the silent switch on; free-typed replies spoken by the production voice | 8.5 | — | | | | D, ? #47 |

## 6. Device validation gates (Appendix A §7.1)

Measured on at least one current iPhone and one mid-range Android at p95 over 30 runs.

| ID | Gate | Target | Status |
|---|---|---|---|
| G1 | "What I heard" appears after speech stops or typing completes | ≤ 1.5 s | Not measured |
| G2 | Seal commits after the ring fills | ≤ 1 s | Not measured |
| G3 | Plan → Seal → Lock In | ≤ 3 taps or holds | Not measured |
| G4 | Happy path, correct proposal → "Go perform." | < 15 s, never by skipping review or consent | Not measured |
| G5 | Lesson schema migration (B §9.4.1, check 46) | No lesson lost or changed | Not run |

---

## 7. Conflicts logged, not resolved

Spec v1.8.2 Part 0 says: log a conflict here, don't resolve it silently. Per `SPECIFICATION-AUTHORITY.md` §2,
each conflict below changes scoring, product behavior or public claims, so it is **blocking** for the rows it
names and goes to Julius + Brandon. No code has changed for any of them.

| # | Conflict | Spec v1.8.2 says | Repo today | Blocks | Owner |
|---|---|---|---|---|---|
| C1 | Non-water drinks move HydroState | Water 1:1; every other drink saved but not counted until its rule is approved (register #40, Part 6.3) | The live logging path counts non-water drinks by coefficient (`data/drinkCatalog.ts` `hydrationCoefficient` and `computeEffectiveOz`: coffee 0.85, soda 0.60, energy 0.50, alcohol 0.10…) via `AddDrinkModal`. The spec-shaped `DrinkChoiceModal` is not mounted | R14, V9, CB6 | Julius (scope), Brandon (code) |
| C2 | Social drink penalty | Removed; Social context never changes HydroState (register #4) | `utils/scoring/breakdown.ts` applies `socialIntakePoints` up to `SOCIAL_INTAKE_MAX_PENALTY = 30`. Scoring engine is off-limits under `CLAUDE.md`, so this needs explicit founder approval | HydroState release | Julius + Brandon |
| C3 | An AI model understands One Breath turns and classifies them (answer / clarify / propose / decline) | Part 7.2, 7.8 | `governance/AFORCE_OS_AI_VOICE_SPEC.md` limits AI to explaining approved deterministic outputs; `Architecture-Appendix.md` "AForce OS is not an AI chatbot"; `types/moments.ts` steps are "never generated by a model". One Breath today is a deterministic parser | CB1–CB14 model layer; register #41 | Julius + Brandon |
| C4 | Every reply spoken by a streaming voice service | Part 8.5 | `AFORCE_OS_AI_VOICE_SPEC.md`: voice is additive over text; stop-ship SS-17: voice must respect quiet hours and OS Do Not Disturb | V18; register #47 | Julius |
| C5 | "AFORCE OS™" on the opening wordmark and Profile footer | Part 8.6 | `TERMINOLOGY-REGISTRY.md` lists "AForce OS" without ™; `SPECIFICATION-AUTHORITY.md` makes the registry canonical for ™ terms | Part 8.6 copy | Julius (+ AWG Law, register #49) |
| C6 | Voice input and voice sealing are member-facing | Part 6.1 | One Breath voice is documented as internal and gated (`docs/pr-evidence/one-breath-voice.md`); the concierge counsel brief says there is no voice input | V1–V4, V13–V15 on device | Julius |
| C7 | Timing-only calendar shift counts toward the 3 automatic touches | Part 7.10 (stricter rule kept; "needs confirmation") | No timing-only shift exists | V10, W15 | Julius |

### 7.1 Decisions (2026-11-12)

Brandon approved every recommendation in the decision brief "Spec v1.8.2 decision brief: C1–C7"
(Claude Docs, 2026-11-12). Each change ships as its own PR; this table is updated as they land.

| # | Decision | What follows | Status |
|---|---|---|---|
| C1 | Water only moves HydroState. Every other drink is saved and shown as "not counted yet" until its own expert-reviewed rule is approved; AFORCE's rule first | Use the existing "Log a drink" sheet on the live logging path; model-version entry (D-09); release note | Open |
| C2 | Remove the social drink penalty. Explicit founder approval to edit the off-limits scoring code for this change only | One PR: remove `socialIntakePoints` from `utils/scoring/breakdown.ts`, update golden scoring tests, model-version entry | Open |
| C3 | No AI model in One Breath for beta. Fixed rules stay; a governance amendment comes once register #41 and #42 are decided | Nothing to build now | Decided |
| C4 | Keep spoken read-backs behind Coach Mode, Quiet and Do Not Disturb. Choose the production voice (#47); then play read-backs with the silent switch on and report playback end | Waits on #47 | Decided |
| C5 | Add AFORCE OS™ to the Terminology Registry for the two app placements, then build it | Registry entry (#1206); app change: "AFORCE OS™" line under the opening caption and the Profile footer line (`feat/aforce-os-tm`) | Registry done · app in review |
| C6 | Voice sealing stays internal until `ONE-BREATH-DEVICE-QA.md` passes on an iPhone and an Android phone and the concierge counsel brief is updated | Waits on the device run | Decided |
| C7 | A timing-only calendar shift counts as one of the 3 automatic touches per Moment | Applies when the timing shift is built | Decided |

**Follow-up choices (Brandon, 2026-11-12):**
- **C1 + C2 ship together as one major model-version bump, `hydrostate-v1.0` → `hydrostate-v2.0`** (D-09 §1.4: both change HydroState output for identical inputs). The code was already at v1.0 although the registry still said v0, so the next major is v2.0 (confirmed by Brandon). One registry row, one release note, so scores change once.
- **C1 details (Brandon):** plain water counts 1:1; AFORCE counts as its mixing water; Phantom Band sips count as water; sparkling water and every other drink are saved without changing HydroState, today's ounces or the decay clock; saved on the existing `/drinks` route (needs migration `20261111_recorded_drinks.sql` on production).
- **Scientific approver for C1 (D-09 §1.3): Julius.** His approval is recorded in this table before the C1 + C2 PR merges.
- **C5 opening placement:** a small "AFORCE OS™" line under "NON — NEGOTIABLE" on the opening screen. The existing "AFORCE" wordmark stays unmarked. Plus the Profile footer line.
