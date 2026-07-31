# Locale Policy Registry — §42 Gate

**Status:** Canonical · **Locale-policy version:** `l42-v1.0` · **Updated:** 2026-07-22
**Machine-readable representation:** `artifacts/aforce-os/utils/intelligence/languageGate/localePolicy.ts`
(must not silently diverge from this document)

---

## 1. Honest status

> **Only English (`en`) is validated.** Five launch locales ship product copy today but their §42
> intelligence policy has **not been reviewed**. No intelligence claim may be emitted in them.
>
> **This document does not claim multilingual compliance that has not been reviewed.**

## 2. Validation definition

A locale is **validated** only when all eight items have been explicitly reviewed and versioned:

banned concepts · approved uncertainty phrases · causal-language rules · medical-language rules ·
product-neutral wording · score-protection wording · prediction-state phrasing ·
Performance DNA lifecycle language

## 3. Registry

| Locale | Status | Checklist | Reviewed | Reviewer | Fallback policy |
|---|---|---|---|---|---|
| **en** | ✅ **validated** | 8/8 | 2026-07-22 | founder (Stage 3) | n/a |
| es | ❌ unvalidated | 0/8 | **Not yet reviewed** | — | suppress with neutral copy |
| fr | ❌ unvalidated | 0/8 | **Not yet reviewed** | — | suppress with neutral copy |
| de | ❌ unvalidated | 0/8 | **Not yet reviewed** | — | suppress with neutral copy |
| pt | ❌ unvalidated | 0/8 | **Not yet reviewed** | — | suppress with neutral copy |
| it | ❌ unvalidated | 0/8 | **Not yet reviewed** | — | suppress with neutral copy |
| ar · zh · ja · ko · hi | ❌ unvalidated | 0/8 | **Not yet reviewed** | — | suppress with neutral copy |

No locale is currently `partially_validated`. The status exists in the contract for a locale
mid-review.

## 4. Rules (enforced in code and tested)

1. **English validation does not validate any other locale.**
2. **Machine translation does not bypass the gate.**
3. A translated string is evaluated under the **destination** locale policy.
4. **Unvalidated locales may not emit newly generated intelligence claims.**
5. Permitted responses: fall back to a validated locale *where product policy permits*, **or**
   suppress and show approved neutral fallback copy. Current policy for every unvalidated locale
   is **suppress** — no cross-locale fallback is enabled.
6. **No silent English-inside-another-locale emission.** Any fallback must be a recorded policy.
7. Every gate decision records the locale and the locale-policy version.

An **unknown** locale fails closed as unvalidated. Region tags normalize (`en-US` → `en`) so a
tag cannot smuggle past the registry.

## 5. Consequence

Until a locale is validated, §39/§40/§61 intelligence output is **suppressed** there. This is a
deliberate launch constraint: the Language lock ships six launch locales for product copy, but the
intelligence layer is English-only until each locale's policy is reviewed.

**Tracked as a release consideration, not a defect.** Recorded in `OPEN-RISKS.md` R-24.

## 6. To validate a locale

1. Review all eight checklist items with a qualified reviewer for that language.
2. Record reviewer and date here and in `localePolicy.ts`.
3. Bump `LOCALE_POLICY_VERSION`.
4. Add locale-specific banned concepts — a direct translation of the English list is **not**
   sufficient; idiomatic medical/causal/certainty phrasing differs per language.
5. Extend the §42 property test to cover the locale.
