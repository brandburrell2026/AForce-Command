# Pending — RC-1 Wave-4 Item 2 Context-Variant Coach Keys

**Status:** Temporary holding doc. **Fold this table into `docs/i18n/TRANSLATION-REVIEW.md`
once PR #553 (`fix/rc1-w5-a11y-breadth`) merges to `main`** — that PR also touches
`TRANSLATION-REVIEW.md`, so this record was kept out of it to avoid a conflict, per
RC-1 closing-follow-ups doctrine (never push follow-up work onto another open PR's
branch or its conflict-adjacent files).

**Scope:** the 10 new `coach.<band>_explanation_<context>` keys added by RC-1 Wave-4
item 2 (context-aware band explanations, `utils/scoring/copy.ts`
`selectExplanationContext()`). These exist only in `locales/en.json` as of the #552
PR; this follow-up adds them to all 10 non-English locale files with the **verbatim
English source value**, per the same house rule `TRANSLATION-REVIEW.md` already
documents ("never machine-translate — carry the English source and log it here for
follow-up").

## Pending table

| Key | File origin | en source value | Locales still English | Notes |
|---|---|---|---|---|
| `coach.peak_explanation_heat` | `utils/scoring/copy.ts` `buildExplanation` (RC-1 Wave-4, item 2) | `"You're locked in, and the heat's pulling harder than usual — don't let your guard down."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | New context-variant key; no prior equivalent to carry over. |
| `coach.peak_explanation_sleep` | same | `"You're locked in even on a short night — nice work. Keep the intake steady so it holds."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Same. |
| `coach.peak_explanation_streak` | same | `"You're locked in and riding a real streak — this is what consistency builds."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Same. |
| `coach.balanced_explanation_heat` | same | `"You're holding steady, but the heat's raising the bar — stay a step ahead of it."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Same. |
| `coach.balanced_explanation_sleep` | same | `"You're holding steady after under 6 hours of sleep — staying a step ahead of your next drink keeps it that way."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Value reflects the RC-1 closing-follow-ups item-3 rewrite (Constitution §5 narrowing — the original PR #552 wording, "your body's working a little harder for it," asserted an unobservable internal state and was replaced with an observation of the sleep threshold itself plus the action, before this key was ever propagated to non-English locales). |
| `coach.balanced_explanation_streak` | same | `"You're holding steady and stacking days — that consistency is doing the work."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Same. |
| `coach.recovering_explanation_heat` | same | `"Recovery window opening, and the heat's speeding it up — a water cycle now matters more."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Same. |
| `coach.recovering_explanation_sleep` | same | `"Recovery window opening after a short night — a water cycle now helps you catch up."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Same. |
| `coach.depleted_explanation_heat` | same | `"Deep recovery window, and the heat is pulling harder than usual. Electrolytes now are the priority."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Same. |
| `coach.depleted_explanation_sleep` | same | `"Deep recovery window after a short night. Electrolytes now help you catch up."` | ar, de, es, fr, hi, it, ja, ko, pt, zh | Same. |

None of the 10 keys carry `{{...}}` interpolation.

## Known follow-up NOT covered by this table

`coach.peak_explanation` (a pre-existing, already-localized-as-English-placeholder
key, unrelated to the 10 new keys above) was also reworded by this same closing-
follow-ups pass, item 3 ("this is what peak feels like" → "notice what peak feels
like," reframing an assertion about what the user feels into an invitation, per
Constitution §5). **`locales/en.json` now carries the new wording; the 10 non-English
locale files still carry the OLD English placeholder text** (`"You're locked in —
this is what peak feels like. Add a stick if the heat or your effort ramps up."`),
since `TRANSLATION-REVIEW.md` — where `coach.peak_explanation`'s existing pending-row
lives — is off-limits until PR #553 merges. When folding this doc in, also update that
row's `en source value` column and the 10 locale files' `coach.peak_explanation`
value to match the new `en.json` text.

## Convention

Same as `docs/i18n/TRANSLATION-REVIEW.md`: `ar`, `hi`, `ja`, `ko`, `zh` always keep
the English source string verbatim (never machine-translated) until a human
translator supplies real copy. `de`, `es`, `fr`, `it`, `pt` normally get a real
translation when a reasonable one exists or can be carried over — but for these 10
brand-new keys there is no equivalent existing phrase to carry over in any locale
(the base `coach.<band>_explanation` keys themselves are still English placeholders
in most of these files), so all 10 non-English locales carry the English source for
all 10 rows above, matching how the sibling RC-1 Wave-4 item-1 `coach.*` rows in
`TRANSLATION-REVIEW.md` were handled.

**Maintenance:** once PR #553 merges, move this entire table (and the "Known
follow-up" note above) into `docs/i18n/TRANSLATION-REVIEW.md`'s Pending table, then
delete this file.
