/**
 * Stage 3 — §42 locale policy registry.
 *
 * A locale is VALIDATED only when its banned concepts, approved uncertainty
 * phrases, causal-language rules, medical-language rules, product-neutral
 * wording, score-protection wording, prediction-state phrasing, and Performance
 * DNA lifecycle language have each been explicitly reviewed and versioned.
 *
 * HONEST STATUS: **only `en` is validated.** The five other launch locales
 * (es, fr, de, pt, it) ship product copy today but their §42 intelligence
 * policy has NOT been reviewed, so they are `unvalidated` here. The additional
 * flag-gated locales (ar, zh, ja, ko, hi) are likewise unvalidated.
 *
 * This file must not claim multilingual compliance that has not been reviewed.
 *
 * HARD LOCKS:
 *  - English validation NEVER implies another locale is validated.
 *  - Machine translation does NOT bypass the gate.
 *  - A translated string is evaluated under the DESTINATION locale policy.
 *  - Unvalidated locales may not emit newly generated intelligence claims.
 *  - No silent English-inside-another-locale emission: any fallback is an
 *    explicit, recorded policy.
 */

/** Bump on ANY locale-policy change. Recorded in every gate decision. */
export const LOCALE_POLICY_VERSION = 'l42-v1.0';

export type LocaleValidationStatus = 'validated' | 'partially_validated' | 'unvalidated';

/** What must be reviewed before a locale can be `validated`. */
export interface LocaleReviewChecklist {
  bannedConcepts: boolean;
  uncertaintyPhrases: boolean;
  causalLanguage: boolean;
  medicalLanguage: boolean;
  productNeutralWording: boolean;
  scoreProtectionWording: boolean;
  predictionStatePhrasing: boolean;
  dnaLifecycleLanguage: boolean;
}

export type FallbackPolicy =
  /** Emit nothing; the surface shows approved neutral copy. */
  | 'suppress_with_neutral_copy'
  /** Emit in a validated locale — only where product policy permits. */
  | 'fallback_to_validated_locale'
  /** No recorded policy ⇒ suppress. Never a silent cross-locale emission. */
  | 'none';

export interface LocalePolicy {
  locale: string;
  status: LocaleValidationStatus;
  checklist: LocaleReviewChecklist;
  reviewedAt: string | null;
  reviewer: string | null;
  fallbackPolicy: FallbackPolicy;
  fallbackLocale: string | null;
  notes: string;
}

const NONE: LocaleReviewChecklist = {
  bannedConcepts: false,
  uncertaintyPhrases: false,
  causalLanguage: false,
  medicalLanguage: false,
  productNeutralWording: false,
  scoreProtectionWording: false,
  predictionStatePhrasing: false,
  dnaLifecycleLanguage: false,
};

const ALL: LocaleReviewChecklist = {
  bannedConcepts: true,
  uncertaintyPhrases: true,
  causalLanguage: true,
  medicalLanguage: true,
  productNeutralWording: true,
  scoreProtectionWording: true,
  predictionStatePhrasing: true,
  dnaLifecycleLanguage: true,
};

/**
 * Launch locales are English, Spanish, French, German, Portuguese, Italian
 * (Language lock). Only `en` has had its §42 policy reviewed.
 */
export const LOCALE_POLICIES: readonly LocalePolicy[] = [
  {
    locale: 'en',
    status: 'validated',
    checklist: ALL,
    reviewedAt: '2026-07-22',
    reviewer: 'founder (Stage 3 authorization)',
    fallbackPolicy: 'none',
    fallbackLocale: null,
    notes: 'The only validated locale. Policy authored and reviewed in English.',
  },
  ...(['es', 'fr', 'de', 'pt', 'it'] as const).map((locale) => ({
    locale,
    status: 'unvalidated' as const,
    checklist: NONE,
    reviewedAt: null,
    reviewer: null,
    // Deliberately suppress rather than show English intelligence copy.
    fallbackPolicy: 'suppress_with_neutral_copy' as const,
    fallbackLocale: null,
    notes:
      'Launch locale for product copy, but §42 intelligence policy NOT YET REVIEWED. ' +
      'No intelligence claim may be emitted until reviewed and versioned.',
  })),
  ...(['ar', 'zh', 'ja', 'ko', 'hi'] as const).map((locale) => ({
    locale,
    status: 'unvalidated' as const,
    checklist: NONE,
    reviewedAt: null,
    reviewer: null,
    fallbackPolicy: 'suppress_with_neutral_copy' as const,
    fallbackLocale: null,
    notes: 'Resource-only locale behind a flag. §42 policy NOT YET REVIEWED.',
  })),
];

const BY_LOCALE = new Map(LOCALE_POLICIES.map((p) => [p.locale, p]));

/** Normalizes `en-US` → `en` so a region tag cannot smuggle past the registry. */
export function localePolicyFor(locale: string): LocalePolicy | null {
  const base = locale.toLowerCase().split(/[-_]/)[0];
  return BY_LOCALE.get(base) ?? null;
}

/** An unknown locale is treated as unvalidated — fails closed. */
export function isValidatedLocale(locale: string): boolean {
  return localePolicyFor(locale)?.status === 'validated';
}

/** True only when every checklist item has been reviewed. */
export function checklistComplete(c: LocaleReviewChecklist): boolean {
  return Object.values(c).every(Boolean);
}

export const VALIDATED_LOCALES: readonly string[] = LOCALE_POLICIES.filter(
  (p) => p.status === 'validated',
).map((p) => p.locale);
