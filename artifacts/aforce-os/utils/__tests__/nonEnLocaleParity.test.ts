/**
 * Non-English locale parity guard (RC-1 final fold-in, item 3).
 *
 * Mechanical companion to docs/i18n/TRANSLATION-REVIEW.md: for every
 * documented English-placeholder key in the `coach.*`, `welcome.*`,
 * `opening.*`, and `common.was` families (the pragmatic subset named by
 * this item — the full pending table also covers `home.live_status.*`,
 * `profile.v2.*`, and `common.offline_banner.*`, not included here), every
 * non-English locale file must carry the *exact current* English source
 * value — byte-for-byte — unless that (key, locale) pair has a REAL human
 * translation, in which case it is listed in REAL_TRANSLATIONS below.
 *
 * This is the exact defect item 1 of this same fold-in fixed: `en.json`'s
 * `coach.peak_explanation` was reworded ("this is what peak feels like" →
 * "notice what peak feels like") but the 10 non-English locale files kept
 * the old wording — a Constitution §5 defect shipping in 5 selectable
 * locales that nothing caught mechanically. This test exists so the next
 * en.json rewording of one of these keys fails CI instead of shipping.
 *
 * Pure (reads locale JSON only) — runs in node/vitest, no react-native
 * import in the module graph.
 *
 * REAL_TRANSLATIONS was built by diffing every key in
 * ENGLISH_PLACEHOLDER_KEYS against en.json across all 10 non-English
 * locale files and verifying each divergence by hand against
 * docs/i18n/TRANSLATION-REVIEW.md's Convention section — not assumed from
 * the docs alone. As of this fold-in, `common.was` is the only genuine
 * translation among these four families; every `coach.*` / `welcome.*` /
 * `opening.*` key is still an English placeholder in all 10 locales.
 */
import { describe, it, expect } from 'vitest';

import en from '../../locales/en.json';
import ar from '../../locales/ar.json';
import de from '../../locales/de.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import hi from '../../locales/hi.json';
import itLocale from '../../locales/it.json'; // "it" would shadow vitest's it()
import ja from '../../locales/ja.json';
import ko from '../../locales/ko.json';
import pt from '../../locales/pt.json';
import zh from '../../locales/zh.json';

const LOCALES: Record<string, unknown> = { ar, de, es, fr, hi, it: itLocale, ja, ko, pt, zh };

// Documented in docs/i18n/TRANSLATION-REVIEW.md's Pending table. Pragmatic
// subset per this item: the coach.*, welcome.*, opening.* families plus
// common.was.
const ENGLISH_PLACEHOLDER_KEYS = [
  'common.was',
  'coach.balanced_explanation',
  'coach.peak_explanation',
  'coach.peak_explanation_heat',
  'coach.peak_explanation_sleep',
  'coach.peak_explanation_streak',
  'coach.balanced_explanation_heat',
  'coach.balanced_explanation_sleep',
  'coach.balanced_explanation_streak',
  'coach.recovering_explanation_heat',
  'coach.recovering_explanation_sleep',
  'coach.depleted_explanation_heat',
  'coach.depleted_explanation_sleep',
  'coach.morning_explanation',
  'coach.consequence_drop',
  'coach.context_late_night',
  'coach.pattern_streak',
  'coach.social_take_rtd_explanation',
  'welcome.eyebrow',
  'welcome.tagline',
  'welcome.get_started',
  'welcome.sign_in',
  'opening.brand_eyebrow',
  'opening.brand_caption',
  'opening.ritual_pause',
  'opening.ritual_hydrate',
  'opening.ritual_lock_in',
  'opening.ritual_perform',
  'opening.ritual_footnote',
  'opening.readiness_eyebrow',
  'opening.readiness_default_status',
  'opening.tap_to_skip',
  'opening.skip_a11y',
] as const;

// (key -> locales) pairs that carry a REAL, human-quality translation
// rather than the English placeholder. Verified directly against the
// locale files: de: "vorher", es/pt: "antes", fr: "avant", it: "prima" —
// matches docs/i18n/TRANSLATION-REVIEW.md's `common.was` row. Every other
// key/locale combination in ENGLISH_PLACEHOLDER_KEYS is currently
// byte-identical to en.json across all 10 non-English locales — do not add
// an entry here without verifying the divergence is an intentional
// translation, not staleness (a wrong entry would silently mask the exact
// regression this test exists to catch).
const REAL_TRANSLATIONS: Record<string, readonly string[]> = {
  'common.was': ['de', 'es', 'fr', 'it', 'pt'],
};

function getPath(obj: unknown, dotted: string): unknown {
  return dotted
    .split('.')
    .reduce<unknown>(
      (cur, part) => (cur != null && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined),
      obj,
    );
}

describe('Non-English locale parity guard — coach.* / welcome.* / opening.* / common.was', () => {
  for (const key of ENGLISH_PLACEHOLDER_KEYS) {
    const enValue = getPath(en, key);

    it(`"${key}" is documented and present in en.json`, () => {
      expect(enValue).not.toBeUndefined();
      expect(typeof enValue).toBe('string');
    });

    for (const [locale, table] of Object.entries(LOCALES)) {
      const isRealTranslation = (REAL_TRANSLATIONS[key] ?? []).includes(locale);
      const label = isRealTranslation
        ? `"${key}" in ${locale}.json carries a real translation, not the English placeholder`
        : `"${key}" in ${locale}.json matches the current English source verbatim`;

      it(label, () => {
        const value = getPath(table, key);
        expect(value).not.toBeUndefined();
        if (isRealTranslation) {
          // A genuine translation must actually differ from English — if it
          // doesn't, either the translation regressed to English or this
          // allowlist entry is stale and should be removed.
          expect(value).not.toBe(enValue);
        } else {
          // No allowlist entry: this locale must carry the CURRENT English
          // source verbatim. A key reworded in en.json without syncing every
          // non-English locale fails here.
          expect(value).toBe(enValue);
        }
      });
    }
  }
});
