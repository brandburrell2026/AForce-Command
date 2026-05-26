---
name: AForce Water-First wording lock
description: Final-lock copy + score + i18n rules for the Recovery Coach and recommendation engines.
---

Coach copy must lead with water, never product. Default recommendation sentence opens with `HYDRATE NOW` followed by `Start with water — <oz>`; optional product support may only appear after hydration needs are evaluated.

**Why:** FINAL BUILD LOCK reframed the engine as Water → Command → Optional support → Score Update. Behavior first, product second. Product-led copy ("AForce Stick + …") is explicitly banned in defaults.

**How to apply:** When adding/editing any recommendation, coach overlay, or voice template, the first user-visible token must be a hydration command, not a SKU. Brand product names stay only in the product DB and tests asserting product fixtures.

---

Score is mutated only by completed actions. HydroScan stays advisory; recommendations and product selection never increase score.

**Why:** Trust gate — any "looking" or "suggesting" path that bumps the score lets users game the engine.

**How to apply:** Score-mutating code paths must be reachable only from `COMPLETE_*` / intake-logged action handlers. Reviews should flag any scan/recommendation handler that writes to score state.

---

Launch i18n = `en, es, fr, de, pt, it` (`SUPPORTED_LANGUAGES`). Other locales (`ar, zh, ja, ko, hi`) stay loaded as `HIDDEN_LANGUAGES` resources behind flags; they must not appear in `LanguageSelector`. No country-specific prioritization. No Denmark/Danish.

**Why:** Localization must stay modular for future expansion without rebuild; launch surface is locked.

**How to apply:** When adding a new language, append to `HIDDEN_LANGUAGES` first behind a `spec_language_*` flag. Promotion to `SUPPORTED_LANGUAGES` is a separate release decision.

---

Scale wording: use "horizontal scaling" — never "50M+ users" / "50 million" in user-facing or governance docs (internal engineering specs under `artifacts/api-server/docs/` may keep concrete numbers).

**Why:** Cleaner engineering tone; avoids over-promising in marketing/governance surfaces.
