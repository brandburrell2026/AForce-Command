# E4 — Voice Coach V2 · Completion Report

**PHASE:** E4 — stronger AI personality / Voice Coach (final phase of the Elite Experience
elevation; see `docs/ui/AFORCE_OS_ELITE_EXPERIENCE_AUDIT.md`).

**STATUS:** Complete. Delivery/phrasing-only, behind a default-OFF flag. Ships as its own PR.

**SCOPE DELIVERED:** the missing piece the audit named — coach identity reached only the TTS
voiceId + a "Coach X" label; `command.action`/`explanation` were byte-identical across coaches
and there was **no `formatCommandForCoach`**. This adds a per-coach **eyebrow + tone lead** on
the command and the **trust-language copy that didn't exist as a shipped string** — all
delivery-only, gated by `elite_voice_coach_enabled`.

**FILES CREATED**
- `services/voice/coachPhrasing.ts` — pure adapter: `coachEyebrow` / `coachLead` /
  `formatCommandForCoach` / `preservesCommandSubstance`.
- `services/voice/__tests__/coachPhrasing.test.ts` — 8 unit tests.
- `exports/elite-voice/` — before/after captures (`before-after.png` + per-coach PNGs).
- `docs/ui/AFORCE_OS_ELITE_E4_COMPLETION.md` — this report.

**FILES MODIFIED**
- `components/home/HomeScreenV2.tsx` — the command card uses the coach eyebrow + tone lead
  (from the selected coach's archetype) and shows the trust line, **only when the flag is on**.
  Flag OFF = the exact prior command (generic "Your next move", original instruction, no trust
  line).
- `locales/en.json` — `coach.trust_line`.
- `featureFlags/flags.ts` / `types/index.ts` / `store/__tests__/_fixtures.ts` — new flag + parity.

**FEATURE FLAGS:** `elite_voice_coach_enabled` — **default OFF** in production, **ON** in
`DEMO_ALL_ON_FLAGS`. Read via `useFeatureFlags()`.

**PROTECTED FILES TOUCHED:** **None.** The adapter runs strictly on the *presentation* side of
the seam: `utils/scoring/*` (`generateCommand`, thresholds, `urgencyLevel`, `estimatedImpact`,
`calculateRiskTimer`), `commandEvidence.ts`, `commandConfidence.ts`, `scoringEngine.ts`,
`statusColor.ts`, entitlement — all untouched. The coach transform only rephrases an
already-selected display string.

**THE SAFETY MODEL (why this can't change a command):**
`formatCommandForCoach(text, archetype)` only **prepends a short tone lead** and then:
1. proves every numeric/dose/timing token survives (`preservesCommandSubstance`), and
2. runs the result through the **§64 observation-only guard** (`isCompliantCoachLine` —
   no risk/injury/diagnosis/prevent, no population comparison), and
3. **fail-safes to the original string** on any failure.
So the command, dose, timing, urgency, and evidence are identical for every coach — **only the
tone differs**. The trust copy makes the doctrine explicit: *"Your coach sets the tone — the
code sets the score. Only verified behavior moves it."*

**REAL DATA CONNECTIONS:** reads `selectedVoiceId` from the store → `findVoice(...).archetype`.
No score/command computation.

**PREVIEW-ONLY FEATURES:** the coach delivery is preview-only (flag OFF in prod).

**TESTS ADDED:** 8 (`coachPhrasing.test.ts`) — distinct eyebrow/lead per archetype; substance
preservation passes/fails correctly; **four coaches → four distinct phrasings but identical
dose tokens + §64-clean**; every output compliant; fail-safe on empty input (never invents a
command).

**TEST RESULTS:** full `artifacts/aforce-os` suite **2432 passed** (+8 new); tsc **0 errors**.
(13 `services/__tests__/*` node-transform failures are **pre-existing**, unrelated.)

**VISUAL QA:** `exports/elite-voice/before-after.png`, live Home (balanced), flag+coach toggled
at runtime:
- **OFF:** generic command, no tone line, no trust copy.
- **Coach Rock (push):** tone line **"Lock in."** + trust line.
- **Coach Sage (recovery):** tone line **"Slow and steady."** + trust line.
The CTA and the dose-bearing title are **identical** across all three — only the coach tone +
eyebrow + trust copy change. (The per-coach eyebrow — "WATER FIRST" vs "EASE IN" — also changes
above the captured crop.)

**ACCESSIBILITY:** the trust line is real on-screen text; no color-only meaning; no motion added.

**PERFORMANCE:** the adapter is a pure string transform at render; negligible.

**KNOWN GAPS / DEFERRED:**
- Coach-differentiated **line banks** for `commandVoice.ts` (score-band / risk / completion
  TTS phrases — today intensity-keyed) and the `STATE + ACTION + TIMING + OUTCOME` 4-slot card
  render — deferred follow-ups (the adapter + guard they'd reuse now exist).
- Coach eyebrow/lead strings live in code (English); localizing them is a follow-up (the trust
  line IS localized via `coach.trust_line`).

**COMMIT:** _(see PR)_
**PR:** _(see PR)_
