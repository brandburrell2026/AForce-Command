# AForce OS — AI Coach & Voice Spec (Phase 0)

**Status:** Draft for founder review · Read-only audit → codified spec · **Owner:** Julius + Brandon
**Verified against:** `52986ece` (2026-08-01). Source: Phase 0C / 0F.
**References:** `governance/Section-63-Compliance-Pass.md`, `CLAIMS-REGISTER.md`, Architecture §59/§61/§64.

> AI **explains** approved deterministic outputs; it never invents a score, threshold, dose,
> confidence, cause, or medical conclusion. Personas change **delivery only**. This spec records the
> shipped guardrails (strong) and the standard gaps (Force Mode defaults, notifications).

---

## 1. Coach personas (delivery-only) — `services/voiceCatalog.ts:46-79`

| Coach | Archetype | Tone |
|---|---|---|
| Rock | push | decisive, brief, direct |
| BB | precision | disciplined, identity-oriented |
| Surge | ignite | energizing, momentum |
| Sage | recovery | calm, restorative |

**Delivery-only guarantee is enforced** (`services/voice/coachPhrasing.ts`): the adapter only prepends
a tone lead / swaps the eyebrow (`:19-48,67-75`); `preservesCommandSubstance()` proves every
numeric/dose/timing token survives (`:50-60`); `isCompliantCoachLine()` applies the §64 guard (`:73`);
**on any failure it returns the original string unchanged** (`:72-74`). HomeScreenV2 confirms identical
command/dose/evidence across coaches, only eyebrow+tone change (`HomeScreenV2.tsx:210-224`). Persona
delivery is gated behind `elite_voice_coach_enabled` (Built-Hidden).

## 2. Language guardrails — **Live/Validated**

Every proactive line normally carries `STATE → COMMAND → REASON → RECHECK/COMPLETION`. Guards
(assert-throwers, test-covered):
- §59 cause-and-effect only, forbidden stems `risk|injur|diagnos|prevent` — `responseLanguage.ts:25-34,46-54`.
- §64 coach compliance + population-comparison ban — `conversationalLanguage.ts:21-42,48-56`
  (population comparison actively banned + tested).
- §61 lesson copy — `livingPerformanceLanguage.ts:51-60`; "your body taught us" only with evidence.
- **No fabrication:** confidence derives only from real, fresh signals; empty/stale/NaN/future never
  counts (`commandConfidence.ts:10-21,56-63`); dose set only from a validated structured value; absent
  signals → **silence** (`conversationalIntelligence.ts:94`, `speak:false`). Recurring symptoms route
  to a physician nudge, never an OS claim (`responseLanguage.ts:61-84`).
- Evidence Engine fails **closed**: if the explained rule ≠ the fired command, it does not emit
  (`commandEvidence.ts:14-27`).

**Note (PA-09):** code labels these §59/§61/§64; there is no "§63" code module — §63 is the
governance compliance-pass, enforced through these guards + copy edits.

## 3. Universal Command Standard — 14 fields (Phase 0C)

| Present | Partial (surface-dependent) | Missing |
|---|---|---|
| #1 action, #3 time window, #4 reason, #7 primary Start/Complete, #12 recheck/completion | #2 amount (no safe range), #5 confidence, #6 source/freshness, #8 adjust, #9 decline, #10 partial — exist on RecoveryCoach, **absent on the flagship Home card** | **#11 verification method, #13 safe alternative** — absent from every command type |

Calm no-command state: first sentence exists ("You're exactly where you should be.",
`livingPerformanceLanguage.ts:63`) but "No action needed." + a calm Home no-command state are absent
(Home always renders a command). → completion items in Plan P3 (SS-22).

## 4. Water-First ordering
Strongly enforced (`homeCommand.ts:80-96,131-139`; band copy leads with water). **One exception:** the
Social RTD command leads with product ("Take 1 RTD now. Sip 16 ounces…", `en.json:720`), gated by
state+behavior — needs a founder ordering ruling (SS-25).

## 5. Force Mode & notifications — **Partially Built**
- **No named "Force Mode."** Nearest = Command Voice Engine intensity (`calm|standard|pressure`) + scope
  (`all|risk|commands|muted`) with visible controls + persistence (`commandVoice.ts:32-38,332-338`).
- **Voice defaults ON** (`useAppStore.tsx:172,183`) — SS-17. **No quiet hours, no OS-DnD respect** for
  TTS. Text alternative always present (voice is additive over text).
- Notifications: `NotificationSettings` covers toggles only; **no Daily/Performance Standard** cap,
  no suppression near a HydroState alert, no category rotation (0C). → Plan P3.

## 6. Status
Persona delivery-only + language guardrails = **Live/Validated** (well-guarded). Command Standard
coverage = **Partially Built**. Force Mode / Daily Standard = **Partially Built / Proposed**. §64
production enable stays gated on RD-1/CR-1 (out of this program's scope).

## 7. Night Out Protocol cross-reference (2026-08-01)
Night-Out AI/language constraints are in `AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md` §10: AI may never
determine/display BAC, impairment, sobriety, driving, alcohol clearance, hangover prevention, a safe
alcohol quantity, a score weight, or a medical conclusion, and may never infer alcohol use from
face/voice/gait/wearable/location. Residual BAC/impairment/transportation copy in `socialModeEngine`
(NO-5 = SS-05) and "Hangover Risk" wording (NO-6 = SS-21) are the items to retire. Use "configured
recommended range"; never a safe alcohol range.
