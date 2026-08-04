# General i18n — Pending Human-Translation Review

**Scope:** cross-surface tracker for locale keys that carry the **verbatim
English source string** in `ar`, `hi`, `ja`, `ko`, `zh` (or any other
locale) because no human translation exists yet, per the house rule:
"never machine-translate — carry the English source and log it here for
follow-up." This file is general/cross-surface; `docs/health/TRANSLATION-REVIEW.md`
is a separate, Connected-Health-scoped record and should not be conflated
with this one.

Each row is one key that needs a real human translation before it can be
considered done in that locale.

## Pending table

| Key | File origin | en source value | Locales still English | Notes |
|---|---|---|---|---|
| `common.was` | `components/ui/AFPrice.tsx` (RC-1 Wave-1 r2, item 2) | `"was"` | ar, hi, ja, ko, zh | New key added to replace the reused, differently-scoped `logIntake.score_was`. `de`/`es`/`fr`/`it`/`pt` already carry real translations (copied from their existing `logIntake.score_was` values: vorher/antes/avant/prima/antes). |
| `home.live_status.last_label` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"LAST"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | New key from `home.*` localization of `LiveStatusLine`. The whole `home.v2.*`/`home.live_status.*` sub-namespace is English-only in all 10 non-English locales today (confirmed via `home.v2.greeting_default`, pre-existing) — not specific to this fix. |
| `home.live_status.pts_suffix` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"pts"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. |
| `home.live_status.verb_ascending` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"ASCENDING"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | One of the 7-value `StatusVerb` set (`services/statusVerb.ts`). |
| `home.live_status.verb_locked_in` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"LOCKED IN"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. |
| `home.live_status.verb_holding` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"HOLDING"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. |
| `home.live_status.verb_drifting` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"DRIFTING"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. |
| `home.live_status.verb_declining` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"DECLINING"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. |
| `home.live_status.verb_recovering` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"RECOVERING"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. |
| `home.live_status.verb_critical` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"CRITICAL"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. |
| `home.live_status.a11y_label` | `components/home/LiveStatusLine.tsx` (RC-1 Wave-1 r2, item 5) | `"Trend {{verb}}"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Accessibility label composed from the verb above. |

## Convention this table follows

Same convention as `docs/health/TRANSLATION-REVIEW.md`: `de`, `es`, `fr`,
`it`, `pt` get real translations when a reasonable one exists or can be
carried over from an equivalent key (as happened for `common.was`);
`ar`, `hi`, `ja`, `ko`, `zh` always keep the English source string verbatim
(never machine-translated) until a human translator supplies real copy.
For the `home.live_status.*` keys specifically, `de`/`es`/`fr`/`it`/`pt`
also stayed English because there was no existing equivalent phrase to
carry over (the entire `home.v2.*` sub-namespace these keys sit beside is
still English-only in all 10 non-English locale files, predating this fix)
— so all 10 non-English locales are listed for those rows, not just the
5-locale "no real translation available" set. `services/i18nService.ts`'s
`fallbackLng: 'en'` is unrelated — every locale file still carries every
key, just with an English value for the untranslated ones.

**Maintenance:** when a row's locale gets a real human translation, update
the locale JSON and delete the row (or move it to a "resolved" section if a
paper trail is wanted).
