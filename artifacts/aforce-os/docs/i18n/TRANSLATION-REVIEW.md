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
| `common.offline_banner.queued_one` / `queued_other` / `failed_one` / `failed_other` | `components/ui/AFOfflineBanner.tsx` (RC-1 Wave-2B, item 1) | `"1 intake queued — not yet synced. It'll send automatically once you're back online."` (+ 3 siblings) | ar, hi, ja, ko, zh | New keys for the offline intake-outbox banner. `de`/`es`/`fr`/`it`/`pt` got real human-quality translations (the `common.*` namespace is otherwise well-translated in those 5 locales); `ar`/`hi`/`ja`/`ko`/`zh` carry the English source per house rule pending real translation. |
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
| `profile.v2.apple_fetch_failed` | `components/profile/ProfileScreenV2.tsx` (RC-1 Wave-2B, item 4) | `"Couldn't refresh Apple Health data."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | New key for the Apple Health fetch-failure inline error row. `profile.v2.*` is, like `home.v2.*`, already English-only across all 10 non-English locales (confirmed: 268–273 of 281 `profile.v2` keys are byte-identical to the English source in de/es/fr/it/pt) — no existing equivalent phrase to carry over, so all 10 are listed here rather than just the 5-locale set. |
| `profile.v2.whoop_status_failed` | `components/profile/ProfileScreenV2.tsx` (RC-1 Wave-2B, item 4) | `"Couldn't check WHOOP connection status."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same as above — WHOOP status-check failure inline error row. |
| `coach.balanced_explanation` | `services/scoringEngine.ts` → `utils/scoring/copy.ts` (RC-1 Wave-4, item 1) | `"You're holding steady. Staying a step ahead of your next drink keeps it that way."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Voice-spec rewrite of a "worst-10" coach line (was syslog-style "Recovery stable."). `de`/`es`/`fr`/`it`/`pt` previously carried real human translations of the OLD English text — those are now stale (they translate wording that no longer exists) and have been overwritten with the NEW English source per house rule, rather than risk shipping a translation of a sentence that was never reviewed against the voice spec (acknowledge→insight structure, no syslog "active", no forbidden §59/§64 stems) in that language. All 10 non-English locales need a fresh human translation of the NEW copy. |
| `coach.peak_explanation` | `services/scoringEngine.ts` → `utils/scoring/copy.ts` (RC-1 Wave-4, item 1) | `"You're locked in — this is what peak feels like. Add a stick if the heat or your effort ramps up."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same rewrite pass — was "Flow state active." (syslog "X active", the exact pattern the voice spec calls out for streaks/wins). Same stale-translation reasoning as `coach.balanced_explanation` above. |
| `coach.morning_explanation` | `services/scoringEngine.ts` → `utils/scoring/copy.ts` (RC-1 Wave-4, item 1) | `"Overnight took {{oz}} oz out of you. Reset your baseline before training starts."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Was a "Label: value" data-readout ("Overnight recovery window: {{oz}} oz."), not a sentence a coach would say. `{{oz}}` interpolation preserved. Same stale-translation reasoning. |
| `coach.consequence_drop` | `utils/scoring/copy.ts` `composeExplanation` (RC-1 Wave-4, item 1) | `"Skip this and you're likely to land near {{projected}} in the next {{minutes}} min."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Was "Without action: score drifts to {{projected}} in {{minutes}} min." — report-label format, not coach speech. `{{projected}}`/`{{minutes}}` interpolation preserved. Previously MISSING (relying on `fallbackLng: 'en'`) in `de`/`es`/`fr`/`it`/`pt`; now present literally in all 10, same as the other rows here. |
| `coach.context_late_night` | `utils/scoring/copy.ts` `composeExplanation` (RC-1 Wave-4, item 1) | `"It's late, and this window sets up your tomorrow."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Was "Late-night recovery window active." (syslog "X active"). Previously MISSING in `de`/`es`/`fr`/`it`/`pt`; now present literally in all 10. |
| `coach.pattern_streak` | `utils/scoring/copy.ts` `composeExplanation` (RC-1 Wave-4, item 1) | `"{{count}} days strong — that consistency is paying off."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Was "{{count}}-day recovery streak active." (syslog "X active" on a win — the voice spec's named example of what NOT to do to a streak/win line). Rewrite is also constrained by the Section 63 streak-copy guard (`utils/__tests__/streakCopy.test.ts`) — no "keep/save/protect...streak" preservation-urgency framing. `{{count}}` interpolation preserved. Previously MISSING in `de`/`es`/`fr`/`it`/`pt`; now present literally in all 10. |
| `coach.social_take_rtd_explanation` | `utils/scoring/copy.ts` `generateSocialCommand` (RC-1 Wave-4, item 1) | `"Recovery window opening. Electrolytes now make tomorrow morning easier."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Was "Recovery window opening ({{score}}/100). Electrolytes now make morning easier." — the exact "raw number in parentheses mid-sentence" pattern the voice spec forbids; the hangover-risk score stays available on-screen via the existing risk meter, just not spoken. `{{score}}` interpolation param is still passed at the call site but is intentionally unused in the new copy. Same stale-translation reasoning as the rows above. |
| `reports.sections.topCommand.awaiting` | `app/weekly-report.tsx` / `utils/weeklyReport.ts` (RC-1 Wave-4, item 1) | `"Keep logging — your most-used move shows up here next week."` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Was "Your most-used command appears once command tracking is on." — exposed the internal instrumentation term "command tracking" to the user. Rewrite matches the sibling `reports.sections.improved.collecting` voice ("Keep logging — your wins show up here next week."). Same stale-translation reasoning. |
| `welcome.eyebrow` | `components/welcome/WelcomeHero.tsx` (RC-1 Wave-5, item 6) | `"PERFORMANCE IS NON-NEGOTIABLE"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | New `welcome.*` namespace — first-run hero, was 100% hardcoded English. No existing equivalent phrase anywhere else to carry over, so all 10 non-English locales carry the English source pending real translation (same situation as `home.live_status.*` below). Extraction only — zero wording changes from the pre-fix hardcoded copy. |
| `welcome.tagline` | `components/welcome/WelcomeHero.tsx` (RC-1 Wave-5, item 6) | `"BUILT FOR PEOPLE\nWHO DON'T GET TO BE OFF"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. Embedded `\n` preserved verbatim from the original two-Text-node + literal `'\n'` layout. |
| `welcome.get_started` | `components/welcome/WelcomeHero.tsx` (RC-1 Wave-5, item 6) | `"GET STARTED"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. Primary CTA into onboarding. |
| `welcome.sign_in` | `components/welcome/WelcomeHero.tsx` (RC-1 Wave-5, item 6) | `"SIGN IN"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. Secondary CTA into sign-in. |
| `opening.brand_eyebrow` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"PERFORMANCE IS"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | New `opening.*` namespace — cold-launch cinematic, was 100% hardcoded English. Same "no existing equivalent to carry over" situation as `welcome.*` above. |
| `opening.brand_caption` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"NON — NEGOTIABLE"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. The em-dash and the monogram's mirrored-N glyphs themselves stay outside translation (brand mark, not copy — see the component's own doc-comment). |
| `opening.ritual_pause` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"PAUSE"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | 1 of 4 ordered ritual words (`RITUAL_KEYS` in the component) — order must stay in lockstep with the other 3. |
| `opening.ritual_hydrate` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"HYDRATE"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same set. |
| `opening.ritual_lock_in` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"LOCK IN"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same set. |
| `opening.ritual_perform` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"PERFORM"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same set. |
| `opening.ritual_footnote` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"Your Readiness Ritual Starts Now"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same namespace situation. |
| `opening.readiness_eyebrow` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"TODAY'S READINESS"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. Was `TODAY&apos;S READINESS` in JSX; the JSON value carries a plain apostrophe (same rendered character). |
| `opening.readiness_default_status` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"READY TO PERFORM"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. Only the *fallback* used when the caller passes no live `statusLabel` — the real band-aware label (e.g. "REHYDRATE NOW") is supplied by the caller and out of scope here. |
| `opening.tap_to_skip` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"TAP TO SKIP"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same namespace situation. |
| `opening.skip_a11y` | `components/opening/OpeningSequence.tsx` (RC-1 Wave-5, item 6) | `"Skip the opening sequence"` | de, es, fr, it, pt, ar, hi, ja, ko, zh | Same. Accessibility label on the tap-anywhere-to-skip Pressable. |

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

For the 8 RC-1 Wave-4 `coach.*` / `reports.sections.topCommand.awaiting`
rows, all 10 non-English locales are listed for a different reason than
`home.live_status.*`: `de`/`es`/`fr`/`it`/`pt` DID have real human
translations, but of the OLD English wording this wave rewrote for voice-spec
compliance (acknowledge→insight structure, no syslog "X active" on wins/
streaks, no raw numbers in parentheses, no exposed instrumentation terms).
Carrying those stale translations forward would ship copy that was never
reviewed against the new English source or the new voice constraints in that
language, and an AI-agent-authored ad-hoc translation risks silently
reintroducing the same violations in another language without native review
— worse than just being untranslated. So every non-English locale carries the
new English source verbatim for these 8 keys pending real human translation,
per the house rule.

**Maintenance:** when a row's locale gets a real human translation, update
the locale JSON and delete the row (or move it to a "resolved" section if a
paper trail is wanted).
