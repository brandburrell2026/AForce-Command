# R-28 — Founder Materials Checklist

**Status:** ⏳ **R-28 NOT COMPLETE.** Materials requested; no audit performed.
**Prepared:** 2026-07-22 · **Companion:** `R-28-INVESTOR-MATERIAL-AUDIT-PLAN.md` (checks C1–C11)

> One consolidated list of what is needed to complete R-28. **Nothing here has been audited.**

---

## The eleven checks that will be applied

**C1** score change without completed behavior · **C2** Demo Mode bypass · **C3** predictions shown
as live when simulated · **C4** architecture labeled built when only specified · **C5** unsupported
superiority claims · **C6** clinical/diagnostic implications · **C7** unsupported validation claims
· **C8** schema-deployment claims · **C9** external-review claims · **C10** English-only limitation
· **C11** feature status accuracy

## Materials required

| # | Group | Why required | Preferred format | Priority | Checks |
|---|---|---|---|---|---|
| **1** | **Current investor deck** | Highest-exposure external artifact; most likely place for status overstatement | PDF **as last sent**, plus source (Keynote/Slides) | 🔴 **P1** | C1 C3 C4 C5 C6 C7 C8 C9 C10 C11 |
| **2** | **Credit / lender materials** | Financial-institution claims carry the highest consequence for inaccuracy | PDF + any submitted form | 🔴 **P1** | C4 C5 C7 C9 C11 |
| **3** | **Investor demo scripts** | A scripted demo is the likeliest place for score to move without completed behavior | Source file or written script | 🔴 **P1** | **C1 C2 C3** C4 C11 |
| **4** | **Founder demo scripts** | Live demos are unrehearsed by auditors; verbal claims are unrecorded | Written outline / talk track | 🟠 P2 | C1 C3 C4 C7 C9 |
| **5** | **Pitch videos** | Fixed, distributable, hard to retract once shared | MP4 + transcript | 🟠 P2 | C1 C3 C4 C5 C6 C7 |
| **6** | **External product demonstrations** | Conference/partner demos may show unreleased surfaces | Recording or written description | 🟠 P2 | C1 C2 C3 C4 C11 |
| **7** | **Screenshots / recordings showing HydroState movement** | **Directly tests C1** — the single most important Score-Protection claim | PNG/MP4 with the triggering action described | 🔴 **P1** | **C1 C2** C3 |
| **8** | **Partner presentations** | Enterprise/partner claims may imply readiness or approval | PDF + source | 🟠 P2 | C4 C7 C9 C10 C11 |
| **9** | **Public white papers & exported specs** | `HYDROSTATE-WHITE-PAPER.md` already has a flagged unsupported claim (R-27 #10); 7 spec PDFs exist in `exports/` | The versions actually shared externally | 🔴 **P1** | C4 **C5** C6 **C7** C8 C9 |
| **10** | **America's Real Deal materials** *(if applicable)* | Broadcast/competition materials reach a wide audience and cannot be retracted | Submitted deck, application, any recorded pitch | 🔴 **P1** | C1 C3 C4 C5 C6 C7 C9 |

## Already in the repository (audit authorization needed, not supply)

| Material | Location | Status |
|---|---|---|
| Pitch deck source | `artifacts/aforce-pitch/src/`, `SLIDE-GUIDE.md` | ❌ Not audited |
| Investor demo beats | `services/demo/investorDemoBeats.ts` | ❌ Not audited — **P1** |
| Seeded demo profile | `data/demoProfile.ts` | ⚠️ Partial |
| Demo Mode service | `services/demoMode.ts` | ✅ **Verified clean** (Phase 3.5) |
| Investor-demo readiness doc | `artifacts/aforce-os/docs/investor-demo-readiness.md` | ❌ Not audited |
| Exported spec PDFs (7) | `exports/*.pdf` | ❌ Not audited |
| Phantom RFP / tearsheet | `exports/phantom-rfp/` | ❌ Not audited |

## Reference truths for auditors

| Claim | Truth as of 2026-07-22 |
|---|---|
| Prediction engine | **Specified.** No algorithm. Four gates open. |
| Performance DNA | **Specified.** No implementation. |
| Knowledge graph | **Partially Built.** **Deployed nowhere.** |
| §42 language gate | **Partially Built.** No caller. |
| Living Performance Model | **Live** — daily lesson only |
| "Validated" / "clinically reviewed" | **Nothing is validated or reviewed.** |
| Multilingual intelligence | **English only.** |
| "Full architecture built" | Contradicts the Capability Status Register. |

## What is needed from you

1. **Supply** groups 1–10, **or explicitly declare each non-existent.** A group not supplied is
   recorded as **"not audited"** — never as "passed".
2. **Authorize** the audit of the in-repository materials above.
3. **Rule** on whether investor demos may show synthetic predictions (also legal-package Q9).

**R-28 cannot be marked complete until every group is supplied-and-audited or declared
non-existent.**
