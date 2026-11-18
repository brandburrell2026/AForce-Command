# AFORCE OS · Founder decision register

**Date:** 2026-11-18 · **Code:** `main@73d61914` · **Governing spec:** Complete App Spec v1.8.2
**Source:** §6 of `docs/AFORCE-OS-v1.8.2-Revised-Audit-and-Plan-2026-11-18.md`.
**Status:** every row is **OPEN**. Nothing here is decided, and no code has changed for any row.
App paths are relative to `artifacts/aforce-os`.

**How to approve.** Reply with the row number and the option letter (for example "D5: A"). The decision,
who made it and the date are then written into the *Recorded* column before any code changes. For rows
marked *Julius*, his approval must be the one recorded.

---

## Part A · The 17 decisions

### D1 · Conversational model in One Breath (C3, register #41, #42) — Julius + Brandon
- **Recommended: A. Keep the model off for beta.** Fixed rules continue; build only the CB rows that need no model.
- **B.** Authorise a model for understanding only (propose, never seal), behind an internal flag, after provider, retention and no-training terms are set.
- **C.** Authorise it for members.
- **Implications.** A: 8 of 14 CB tests stay unbuilt. B/C: member words leave the device; needs a governance amendment (`governance/AFORCE_OS_AI_VOICE_SPEC.md`, `Architecture-Appendix.md`), a privacy-policy change and counsel review.
- **Affected.** `services/oneBreathDraft.ts`, `components/oneBreath/MomentPreparationScreen.tsx`, new api-server route, `legal/privacy-policy.md`, Proof Tracker CB1–CB14.
- **Exact approval needed.** "C3 stays" **or** a written amendment naming provider, hosting, log retention, no-training guarantee and which builds may use it.

### D2 · Production voice (register #47, C4) — Julius (voice), Brandon (provider)
- **Recommended: A.** Choose the provider and voice now, build it internal-only, still behind Coach Mode, Quiet and Do Not Disturb.
- **B.** Defer; read-back end stays estimated.
- **Implications.** A unblocks V18 and a true confirmation-window start. B leaves V1, V13–V15 dependent on a timing estimate.
- **Affected.** `services/textToSpeech.ts`, `services/coachMode.ts`, `utils/oneBreath/confirmationWindow.ts`, api-server voice route, stop-ship SS-17.
- **Exact approval needed.** Provider, the named voice, latency target, and confirmation that C4's limits stay.

### D3 · Expert-reviewed content (register #44, #48; CB14, R9) — Julius + reviewers
- **Recommended: A.** Keep "decline" and "Not offered yet" until reviewed wording exists; commission the safety wording first (surgery, pregnancy).
- **B.** Commission all three together.
- **Implications.** Without it, follow-up food questions are declined, no exercise options appear, and only chest pain has a safety branch.
- **Affected.** `utils/oneBreath/workoutFocus.ts`, `services/oneBreathDraft.ts`, `governance/CLAIMS-REGISTER.md`.
- **Exact approval needed.** Reviewer name, the approved text, and its version, recorded before it ships.

### D4 · Session timeout and clarification thresholds (register #43, #45) — Julius, Brandon
- **Recommended: A.** Adopt the spec defaults: 10-minute session, draft kept across restart, clarify on any missing day, time, place or person.
- **B.** Different values.
- **Affected.** `services/oneBreathDraft.ts`, One Breath store.
- **Exact approval needed.** The numbers.

### D5 · ™ placement on the opening screen (K4) — Julius
- **Recommended: A.** Keep the C5 placement: "AFORCE OS™" line under "NON — NEGOTIABLE", "AFORCE" wordmark unmarked.
- **B.** Move ™ onto the wordmark directly under the N–И mark, as Part 8.6.2 words it.
- **Implications.** A is already built and tested. B changes the opening sequence layout and its render test.
- **Affected.** `components/opening/OpeningSequence.tsx`, its render test, `TERMINOLOGY-REGISTRY.md`.
- **Exact approval needed.** "Keep C5" or "Move to wordmark".

### D6 · "Lock In" or "LOCK-IN" (K5) — Julius + Brandon
- **Recommended: A.** One spelling everywhere; "LOCK-IN" matches the live site, the manifesto video and Brandon's 2026-11-11 choice.
- **B.** "Lock In", as the spec and prototype write it.
- **Implications.** Either way one of the two sources is amended. Copy only.
- **Affected.** `locales/*.json`, One Breath screens, `TERMINOLOGY-REGISTRY.md`, the site (separate repo).
- **Exact approval needed.** The spelling, and whether it is always red.

### D7 · Status colours (K6, stop-ship SS-11) — Julius + Brandon
- **Recommended: A.** Approve an audit-first change: list every surface that reads `statusColor.ts`, agree one band table, then change it in one reviewed pull request.
- **B.** Leave `statusColor.ts` and bypass it on the redesigned screens.
- **C.** No change.
- **Implications.** A touches a protected file and fixes SS-11 (Home and Performance Signal disagree at 85–89). B creates a second source of truth. C leaves red and amber scores, against the spec.
- **Affected.** `theme/statusColor.ts` (protected), `components/hydration/signalV3Presentation.ts`, `components/journal/JournalDayCard.tsx`, `config/hydroStateModel.ts`.
- **Exact approval needed.** Explicit written approval to edit `statusColor.ts`, naming the band table. **No work starts without it.**

### D8 · Licensed photography (register #20) — Julius
- **Recommended: A.** Name an owner and a source now; ship no World photos to members until licensed.
- **B.** Launch without World photography.
- **Implications.** AI samples are cleared for TestFlight and investor demos only. 12 Travel city photos are editorial-only and also need replacing.
- **Affected.** World asset set (not in the repo), Travel photo picker data.
- **Exact approval needed.** Owner, source, and the licence record location.

### D9 · Trademark status (register #49) — Julius + AWG Law
- **Recommended: A.** ™ only until a US registration issues for software classes.
- **Affected.** `TERMINOLOGY-REGISTRY.md`.
- **Exact approval needed.** Counsel's confirmation of status.

### D10 · Approved N–И vector — Julius
- **Recommended: A.** Supply the approved vector; `AFMark` then renders it and every call site follows.
- **B.** Approve the current typed Inter 300 mark as the production mark.
- **Affected.** `components/ui/AFMark.tsx` and its test.
- **Exact approval needed.** The file, or "typed mark approved".

### D11 · Update the project `CLAUDE.md` brand section (K7) — Brandon
- **Recommended: A.** Replace `#C1281B`, `#0D0D0D` and Archivo Black with `#E51E2A`, `#090A0A` and Inter, matching the spec and the code.
- **B.** Leave it; the conflict stays.
- **Affected.** `CLAUDE.md` only.
- **Exact approval needed.** "Update the brand section."

### D12 · Three behaviour conflicts (K8, K9, K10) — Brandon (K10 also Julius)
- **K8 leaderboard and achievements. Recommended: A.** Keep both (2026-08-27 ruling) but remove rank and trophy styling. **B.** Retire both. Files: `app/leaderboard.tsx`, `app/achievements.tsx`.
- **K9 tab haptic. Recommended: A.** Keep it off (earlier founder rule). **B.** Add the light tick. File: `app/(tabs)/_layout.tsx`.
- **K10 first Home number. Recommended: A.** Show "Collecting" until enough is logged; a new member never sees "Depleted". This is behaviour and scoring copy, so it needs Julius. **B.** No change. Files: `components/editorial/home/EditorialHomeScreen.tsx`, `utils/scoring/copy.ts` (line 593).
- **Exact approval needed.** One letter per item; K10 needs the threshold.

### D13 · Destructive buttons — Brandon
- **Recommended: A.** Outlined, warm-white text, with a confirmation step; red is not used for delete or sign out.
- **B.** Red fill, as "real urgency".
- **Affected.** `components/profile/profileKit.tsx`, account-deletion and sign-out controls.
- **Exact approval needed.** The letter.

### D14 · Website ™ — Brandon
- **Finding.** `joinaforce.com/aforce-os` has no ™ and no trademark footer line (audited read-only 2026-11-18).
- **Recommended: A.** Authorise the three changes in Part 8.6.3 in the site repo, as one pull request.
- **Affected.** `aforce-site` repo (separate). Deploy uses the Deploy Hook.
- **Exact approval needed.** "Authorise the site ™ change", and who deploys.

### D15 · Nov 6 prototype zip — Brandon
- **Finding.** The spec page says to delete it from the repo. **No zip file is tracked in this repo**, so there is nothing to delete here.
- **Recommended: A.** Close as not applicable. **B.** Name another location to check.
- **Exact approval needed.** "Close" or a path.

### D16 · Missing sources — Brandon
- **Recommended: A.** Add Social v0.4.1 and HydroScan v2 to `docs/` so they can be built against.
- **Implications.** Without them, Circles/Social (build-order step 6) and the HydroScan flow cannot be specified.
- **Exact approval needed.** The files.

### D17 · Drink record edit window and trainer visibility (RA-N7) — Brandon + Julius
- **Recommended: A.** A member may edit or delete their own drink record for 24 hours; later changes are kept as a correction with the original retained; a trainer sees the current value and that it was amended.
- **B.** No time limit. **C.** Delete only, no edit.
- **Implications.** Changes stored member data and HydroState history, so it needs the scientific approver. Blocks the log-result Undo in the redesign.
- **Affected.** `api-server/src/routes/aforce/intake.ts`, `lib/db` schema (new migration), `services/realApi.ts`, Hydration screens.
- **Exact approval needed.** The window, the correction rule, and trainer visibility.

| Row | Recorded decision | By | Date |
|---|---|---|---|
| D1–D17 | — | — | — |

---

## Part B · Issues that should come before visual polish

From the stop-ship register (§5 re-audit and later rows). **None of these is fixed by the redesign.** Severity is the register's own.

| Rank | ID | Issue | Why it outranks polish | Blocked on |
|---|---|---|---|---|
| 1 | SS-03 (S1) | Wearable provider tokens are stored in plaintext whether or not an encryption key is set | A database leak exposes members' WHOOP, Oura, Garmin and Strava access | Julius's K-3 sign-off, then a migration on production |
| 2 | SS-04 (S1) | No full account deletion. The endpoint exists and is switched off | Store rules and privacy law require it before outside testers | Stage 3 (sign-in account and subscription), Julius, counsel review of 14 rows |
| 3 | SS-15 (S2) | The server saves the score the phone sends; score protection is off by default | A modified client can write any score into stored history | Founder go-ahead for the Phase-3B pre-flight; deployed setting not checked |
| 4 | RA-N2 | Per-member storage isolation is switched off, so two members on one phone share some stored settings and the analytics outbox | One member's data can be attributed to another | Decision to turn the flag on, plus a device test |
| 5 | SS-10 (S2), RA-N3 | Smart Capture sends a photo to the server with no consent step, and the privacy policy says the photo library is not accessed | The app does something its policy denies | Counsel wording; a consent step |
| 6 | RA-N7 | A member cannot edit or delete a drink record | Wrong entries stay in HydroState history | D17 |
| 7 | SS-26 (S1) | The server still accepts an alcohol entry from any signed-in member; no age or region check | Contained in store builds only at the screen level | Founder policy |
| 8 | SS-02 (S1) | Paid features are gated on the phone only, except one route | A modified client can reach paid or trainer-adjacent features | Founder ruling on plan gating |
| 9 | SS-08 (S2) | No block or report in Circles | Must exist before Circle membership or sharing is switched on | Build before step 6 |
| 10 | Beta checklist | Sign-in still runs on the development Clerk instance | Outside testers cannot be onboarded safely | Brandon (account setup) |
| 11 | SS-11 (S2) | Three different score-band tables are live | The same score reads differently on two screens | D7 |

**Recommendation.** Rows 1–3 and 10 gate outside testers and should be scheduled ahead of further visual steps as soon as their approvals arrive. Until then the visual steps that need no decision can continue in parallel, because they touch different files.

**Not checked in this pass:** production environment values, the production database, and behaviour on a device.
