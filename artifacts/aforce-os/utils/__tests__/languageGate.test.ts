/**
 * Stage 3 — §42 Intelligence Language and Claims Gate.
 *
 * Covers the Stage 3 required-testing list, including the property/table-driven
 * requirement that EVERY banned concept in the canonical policy registry is
 * blocked across every applicable validated locale and surface.
 */
import { describe, expect, it } from 'vitest';
import { evaluateClaim, mayEmit } from '../intelligence/languageGate/gate';
import {
  ALL_PROHIBITED_CONCEPTS,
  GATE_POLICY_VERSION,
  POLICY_RULES,
  conceptPresent,
  rulesFor,
} from '../intelligence/languageGate/policyRegistry';
import {
  LOCALE_POLICIES,
  LOCALE_POLICY_VERSION,
  VALIDATED_LOCALES,
  checklistComplete,
  isValidatedLocale,
  localePolicyFor,
} from '../intelligence/languageGate/localePolicy';
import {
  GOVERNED_TRANSFORMATIONS,
  findTransformation,
  isTransformable,
} from '../intelligence/languageGate/transformations';
import {
  ACTIVE_CLAIM_CATEGORIES,
  GATE_OUTCOMES,
  INTENDED_SURFACES,
  STRICT_SURFACES,
  isSuppression,
  type ClaimCandidate,
  type GateOutcome,
} from '../../types/claimGate';

const NOW = 1_800_000_000_000;

function candidate(over: Partial<ClaimCandidate> = {}): ClaimCandidate {
  return {
    candidateId: 'c1',
    userId: 'user-1',
    sourceSubsystem: 'knowledge_graph',
    intendedSurface: 'weekly_performance_report',
    locale: 'en',
    copyKey: 'insight.hydration_timing',
    proposedText: 'You logged more water before noon on several recent days.',
    claimCategory: 'observation',
    claimSubject: 'hydration_timing',
    evidenceRefs: ['edge-1'],
    provenancePath: ['e1', 'e2'],
    supportingObservationCount: 6,
    contradictoryObservationCount: 0,
    evidenceState: 'supported',
    predictionState: null,
    patternState: null,
    contextOnly: false,
    modelVersion: 'graph-v1.0',
    profileVersionId: 7,
    baselineVersionId: 3,
    freshness: 'fresh',
    signalQuality: 'good',
    uncertaintyRequirement: 'none',
    disclaimerClass: 'none',
    referencesProduct: false,
    referencesCommand: false,
    privacyClass: 'S1',
    retentionClass: 'R4',
    createdAtMs: NOW - 1000,
    ...over,
  };
}

const OK = { nowMs: NOW, adapterEligible: true };

/* ── baseline allow ───────────────────────────────────────────────────────── */

describe('baseline', () => {
  it('allows a well-supported, clean observation', () => {
    const d = evaluateClaim(candidate(), OK);
    expect(d.outcome).toBe('ALLOW');
    expect(d.reasons).toEqual([]);
    expect(mayEmit(d)).toBe(true);
    expect(d.emittedLocale).toBe('en');
  });

  it('records policy versions and audit metadata on every decision', () => {
    const d = evaluateClaim(candidate(), OK);
    expect(d.audit.gatePolicyVersion).toBe(GATE_POLICY_VERSION);
    expect(d.audit.localePolicyVersion).toBe(LOCALE_POLICY_VERSION);
    expect(d.audit.modelVersion).toBe('graph-v1.0');
    expect(d.audit.evaluatedAtMs).toBe(NOW);
    expect(d.audit.provenanceComplete).toBe(true);
  });

  it('audit carries ids only — never the proposed text', () => {
    const d = evaluateClaim(candidate({ proposedText: 'sensitive detail here' }), OK);
    expect(JSON.stringify(d.audit)).not.toContain('sensitive detail');
  });
});

/* ── every outcome is reachable ───────────────────────────────────────────── */

describe('gate outcomes', () => {
  const cases: Array<[GateOutcome, Partial<ClaimCandidate>, typeof OK]> = [
    ['SUPPRESS_MEDICAL_OR_DIAGNOSTIC_LANGUAGE',
      { proposedText: 'This is a diagnosis of your condition.' }, OK],
    // Categories deliberately OUTSIDE each transformation's applicable set, so
    // the bare suppression path is exercised rather than the transform path.
    ['SUPPRESS_UNSUPPORTED_CAUSALITY',
      { proposedText: 'Heat caused your poor recovery.', claimCategory: 'command_explanation' }, OK],
    ['SUPPRESS_UNSUPPORTED_CERTAINTY',
      { proposedText: 'You will definitely improve.', claimCategory: 'observation' }, OK],
    ['SUPPRESS_PRODUCT_BIAS',
      { proposedText: 'You need AForce to improve.' }, OK],
    ['SUPPRESS_SCORE_PROTECTION_VIOLATION',
      { proposedText: 'Scanning increases your score.' }, OK],
    ['SUPPRESS_INSUFFICIENT_EVIDENCE',
      { evidenceState: 'insufficient' }, OK],
    ['SUPPRESS_CONTRADICTORY_SUPPORT',
      { evidenceState: 'contradicted' }, OK],
    ['SUPPRESS_INVALID_PROVENANCE',
      { provenancePath: [] }, OK],
    ['SUPPRESS_UNVALIDATED_LOCALE',
      { locale: 'es' }, OK],
    ['SUPPRESS_STALE_INPUT',
      { freshness: 'stale' }, OK],
    ['SUPPRESS_CONTEXT_AS_PERSONAL',
      { contextOnly: true, claimCategory: 'observed_pattern' }, OK],
    ['SUPPRESS_POLICY_VIOLATION',
      { claimCategory: 'medical' }, OK],
  ];

  for (const [expected, over, opts] of cases) {
    it(`produces ${expected}`, () => {
      const d = evaluateClaim(candidate(over), opts);
      expect(d.outcome).toBe(expected);
      expect(mayEmit(d)).toBe(false);
      expect(d.reasons.length).toBeGreaterThan(0);
    });
  }

  it('produces ALLOW_WITH_APPROVED_TRANSFORMATION', () => {
    const d = evaluateClaim(
      candidate({ proposedText: 'Heat caused lower recovery.', claimCategory: 'association' }),
      OK,
    );
    expect(d.outcome).toBe('ALLOW_WITH_APPROVED_TRANSFORMATION');
    expect(d.transformedCopyKey).toBe('gate.association.observed_alongside');
  });

  it('refuses a candidate the Stage 2 adapter marked ineligible', () => {
    const d = evaluateClaim(candidate(), { nowMs: NOW, adapterEligible: false });
    expect(d.outcome).toBe('SUPPRESS_INVALID_PROVENANCE');
  });

  it('never collapses distinct refusals into one generic result', () => {
    const outcomes = new Set(
      cases.map(([, over, opts]) => evaluateClaim(candidate(over), opts).outcome),
    );
    expect(outcomes.size).toBeGreaterThanOrEqual(10);
  });

  it('declares 14 outcomes and marks suppressions correctly', () => {
    expect(GATE_OUTCOMES).toHaveLength(14);
    expect(isSuppression('ALLOW')).toBe(false);
    expect(isSuppression('ALLOW_WITH_APPROVED_TRANSFORMATION')).toBe(false);
    expect(GATE_OUTCOMES.filter(isSuppression)).toHaveLength(12);
  });
});

/* ── PROPERTY: every banned concept blocked, every category × surface ─────── */

describe('PROPERTY — every banned concept is blocked in every validated locale and surface', () => {
  it('has at least one validated locale and blocks everywhere in it', () => {
    expect(VALIDATED_LOCALES.length).toBeGreaterThan(0);

    for (const locale of VALIDATED_LOCALES) {
      for (const concept of ALL_PROHIBITED_CONCEPTS) {
        // Find a category+surface pair where a rule containing this concept applies.
        let checkedSomewhere = false;

        for (const category of ACTIVE_CLAIM_CATEGORIES) {
          for (const surface of INTENDED_SURFACES) {
            const applicable = rulesFor(category, surface).filter((r) =>
              r.prohibitedConcepts.includes(concept),
            );
            if (applicable.length === 0) continue;
            checkedSomewhere = true;

            const d = evaluateClaim(
              candidate({
                locale,
                claimCategory: category,
                intendedSurface: surface,
                proposedText: `Prefix ${concept} suffix.`,
                // Keep every non-language gate clean so only the concept can fire.
                evidenceState: 'supported',
                freshness: 'fresh',
                signalQuality: 'good',
                contextOnly: false,
                predictionState: null,
                patternState: null,
                uncertaintyRequirement: 'none',
              }),
              OK,
            );

            expect(
              mayEmit(d) && d.outcome === 'ALLOW',
              `concept "${concept}" reached ALLOW at ${category}/${surface}/${locale}`,
            ).toBe(false);
          }
        }

        expect(checkedSomewhere, `concept "${concept}" is unreachable by any rule`).toBe(true);
      }
    }
  });

  it('matches concepts on word boundaries, not arbitrary substrings', () => {
    expect(conceptPresent('this prevents cramping', 'prevents')).toBe(true);
    expect(conceptPresent('Prevention matters', 'prevention')).toBe(true);
    // "cause" must not fire inside an unrelated longer word.
    expect(conceptPresent('because', 'cause')).toBe(false);
  });
});

/* ── locale governance ────────────────────────────────────────────────────── */

describe('locale governance', () => {
  it('validates only English, honestly', () => {
    expect(VALIDATED_LOCALES).toEqual(['en']);
    for (const p of LOCALE_POLICIES) {
      if (p.locale === 'en') expect(checklistComplete(p.checklist)).toBe(true);
      else expect(checklistComplete(p.checklist)).toBe(false);
    }
  });

  it('does not let English validation imply another launch locale is validated', () => {
    for (const l of ['es', 'fr', 'de', 'pt', 'it']) {
      expect(isValidatedLocale(l)).toBe(false);
      expect(evaluateClaim(candidate({ locale: l }), OK).outcome).toBe(
        'SUPPRESS_UNVALIDATED_LOCALE',
      );
    }
  });

  it('treats an unknown locale as unvalidated (fails closed)', () => {
    expect(isValidatedLocale('xx')).toBe(false);
    expect(localePolicyFor('xx')).toBeNull();
    expect(evaluateClaim(candidate({ locale: 'xx' }), OK).outcome).toBe(
      'SUPPRESS_UNVALIDATED_LOCALE',
    );
  });

  it('normalizes a region tag so it cannot smuggle past the registry', () => {
    expect(isValidatedLocale('en-US')).toBe(true);
    expect(isValidatedLocale('es-MX')).toBe(false);
  });

  it('does not bypass the gate for machine-translated copy', () => {
    // Clean English text, merely re-tagged as Spanish, is still suppressed.
    const d = evaluateClaim(candidate({ locale: 'es' }), OK);
    expect(d.outcome).toBe('SUPPRESS_UNVALIDATED_LOCALE');
    expect(d.emittedLocale).toBeNull();
  });

  it('records an explicit fallback policy — never a silent cross-locale emission', () => {
    for (const p of LOCALE_POLICIES) {
      if (p.status === 'validated') continue;
      expect(p.fallbackPolicy).toBe('suppress_with_neutral_copy');
      expect(p.fallbackLocale).toBeNull();
    }
  });
});

/* ── prediction language ──────────────────────────────────────────────────── */

describe('prediction language rules', () => {
  it('blocks a personal claim at insufficient_data', () => {
    const d = evaluateClaim(
      candidate({
        predictionState: 'insufficient_data',
        claimCategory: 'emerging_personal_prediction',
      }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_INSUFFICIENT_EVIDENCE');
  });

  it('blocks a context-only estimate dressed as personal learning', () => {
    const d = evaluateClaim(
      candidate({
        contextOnly: true,
        predictionState: 'context_only',
        claimCategory: 'emerging_personal_prediction',
      }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_CONTEXT_AS_PERSONAL');
  });

  it('allows a context estimate declared as a context estimate', () => {
    const d = evaluateClaim(
      candidate({
        contextOnly: true,
        predictionState: 'context_only',
        claimCategory: 'context_estimate',
        proposedText: 'Current conditions suggest higher fluid needs today.',
      }),
      OK,
    );
    expect(d.outcome).toBe('ALLOW');
  });

  it('blocks emerging evidence claimed as calibrated (DR-006)', () => {
    const d = evaluateClaim(
      candidate({
        predictionState: 'emerging_personal',
        claimCategory: 'calibrated_personal_prediction',
      }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_UNSUPPORTED_CERTAINTY');
  });

  it('allows cautious emerging-prediction language', () => {
    const d = evaluateClaim(
      candidate({
        predictionState: 'emerging_personal',
        claimCategory: 'emerging_personal_prediction',
        proposedText: 'Your recent patterns suggest earlier hydration may help.',
        uncertaintyRequirement: 'required',
      }),
      OK,
    );
    expect(d.outcome).toBe('ALLOW');
    expect(d.requiredUncertaintyKey).toBeTruthy();
  });

  it('blocks deterministic language in any prediction state', () => {
    for (const state of ['context_only', 'emerging_personal', 'calibrated_personal'] as const) {
      const d = evaluateClaim(
        candidate({
          predictionState: state,
          contextOnly: state === 'context_only',
          claimCategory:
            state === 'context_only' ? 'context_estimate' : 'emerging_personal_prediction',
          proposedText: 'This is guaranteed to happen.',
        }),
        OK,
      );
      expect(mayEmit(d) && d.outcome === 'ALLOW').toBe(false);
    }
  });
});

/* ── Performance DNA language ─────────────────────────────────────────────── */

describe('Performance DNA language rules', () => {
  it('blocks genetic framing', () => {
    const d = evaluateClaim(
      candidate({
        claimCategory: 'observed_pattern',
        patternState: 'observed',
        proposedText: 'This is genetic — it is in your DNA.',
      }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_POLICY_VIOLATION');
  });

  it('blocks permanence framing', () => {
    const d = evaluateClaim(
      candidate({
        claimCategory: 'observed_pattern',
        patternState: 'observed',
        proposedText: 'This pattern is permanent.',
      }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_POLICY_VIOLATION');
  });

  it('blocks a DNA score', () => {
    const d = evaluateClaim(
      candidate({ proposedText: 'Your DNA score is 78.' }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_SCORE_PROTECTION_VIOLATION');
  });

  it('blocks emerging pattern claimed as high confidence', () => {
    const d = evaluateClaim(
      candidate({ patternState: 'emerging', claimCategory: 'high_confidence_pattern' }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_UNSUPPORTED_CERTAINTY');
  });

  it('blocks a retired or superseded pattern from making a claim', () => {
    for (const s of ['retired', 'superseded'] as const) {
      const d = evaluateClaim(
        candidate({ patternState: s, claimCategory: 'observed_pattern' }),
        OK,
      );
      expect(mayEmit(d)).toBe(false);
    }
  });

  it('allows an observed pattern with change-aware framing', () => {
    const d = evaluateClaim(
      candidate({
        claimCategory: 'observed_pattern',
        patternState: 'observed',
        proposedText: 'Observed pattern: you respond strongly to early hydration.',
      }),
      OK,
    );
    expect(d.outcome).toBe('ALLOW');
  });
});

/* ── injury / Guardian wording ────────────────────────────────────────────── */

describe('injury and risk framing', () => {
  it('blocks the retired Guardian description', () => {
    const d = evaluateClaim(
      candidate({ intendedSurface: 'guardian', proposedText: 'Injury-risk protection.' }),
      OK,
    );
    expect(mayEmit(d)).toBe(false);
  });

  it('blocks injury prediction and medical-risk detection', () => {
    for (const text of ['We predict injury.', 'Medical-risk detection enabled.', 'You are at risk.']) {
      const d = evaluateClaim(candidate({ proposedText: text }), OK);
      expect(mayEmit(d) && d.outcome === 'ALLOW').toBe(false);
    }
  });
});

/* ── evidence and contradictions ──────────────────────────────────────────── */

describe('evidence and provenance rules', () => {
  it('suppresses when contradictions dominate support', () => {
    const d = evaluateClaim(
      candidate({ supportingObservationCount: 3, contradictoryObservationCount: 3 }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_CONTRADICTORY_SUPPORT');
  });

  it('suppresses a superseded evidence state', () => {
    expect(evaluateClaim(candidate({ evidenceState: 'superseded' }), OK).outcome).toBe(
      'SUPPRESS_INSUFFICIENT_EVIDENCE',
    );
  });

  it('suppresses missing model version and missing user scope', () => {
    expect(evaluateClaim(candidate({ modelVersion: '' }), OK).outcome).toBe(
      'SUPPRESS_INVALID_PROVENANCE',
    );
    expect(evaluateClaim(candidate({ userId: '' }), OK).outcome).toBe(
      'SUPPRESS_INVALID_PROVENANCE',
    );
  });

  it('suppresses unavailable signal quality', () => {
    expect(evaluateClaim(candidate({ signalQuality: 'unavailable' }), OK).outcome).toBe(
      'SUPPRESS_STALE_INPUT',
    );
  });
});

/* ── surface-specific policy ──────────────────────────────────────────────── */

describe('surface-specific policy', () => {
  it('refuses predictive copy on strict surfaces', () => {
    for (const surface of STRICT_SURFACES) {
      const d = evaluateClaim(
        candidate({
          intendedSurface: surface,
          claimCategory: 'emerging_personal_prediction',
          predictionState: 'emerging_personal',
        }),
        OK,
      );
      expect(mayEmit(d)).toBe(false);
    }
  });

  it('refuses copy needing qualification on a short-form surface', () => {
    const d = evaluateClaim(
      candidate({ intendedSurface: 'notification', uncertaintyRequirement: 'required' }),
      OK,
    );
    expect(d.outcome).toBe('SUPPRESS_POLICY_VIOLATION');
  });

  it('permits the same claim on a long-form surface', () => {
    const d = evaluateClaim(
      candidate({
        intendedSurface: 'weekly_performance_report',
        uncertaintyRequirement: 'required',
      }),
      OK,
    );
    expect(d.outcome).toBe('ALLOW');
  });
});

/* ── transformation ───────────────────────────────────────────────────────── */

describe('governed transformation', () => {
  it('transforms causal phrasing into governed association phrasing', () => {
    const d = evaluateClaim(
      candidate({ claimCategory: 'association', proposedText: 'Heat caused lower recovery.' }),
      OK,
    );
    expect(d.outcome).toBe('ALLOW_WITH_APPROVED_TRANSFORMATION');
    expect(d.transformedCopyKey).toBe('gate.association.observed_alongside');
    expect(d.requiredUncertaintyKey).toBe('gate.uncertainty.association_not_causation');
  });

  it('transformation preserves the required uncertainty', () => {
    const d = evaluateClaim(
      candidate({
        claimCategory: 'context_estimate',
        contextOnly: true,
        predictionState: 'context_only',
        proposedText: 'You will definitely crash in 40 minutes.',
      }),
      OK,
    );
    expect(d.outcome).toBe('ALLOW_WITH_APPROVED_TRANSFORMATION');
    expect(d.requiredUncertaintyKey).toBeTruthy();
  });

  it('REFUSES to transform an unsupported claim into a supported one', () => {
    // Causal phrasing AND insufficient evidence: rewording would hide the real
    // failure, so the candidate must be suppressed, not transformed.
    const d = evaluateClaim(
      candidate({
        claimCategory: 'association',
        proposedText: 'Heat caused lower recovery.',
        evidenceState: 'insufficient',
      }),
      OK,
    );
    expect(d.outcome).not.toBe('ALLOW_WITH_APPROVED_TRANSFORMATION');
    expect(mayEmit(d)).toBe(false);
  });

  it('never transforms a medical or score-protection violation', () => {
    for (const text of ['This is a diagnosis.', 'Scanning increases your score.']) {
      const d = evaluateClaim(candidate({ proposedText: text }), OK);
      expect(d.outcome).not.toBe('ALLOW_WITH_APPROVED_TRANSFORMATION');
      expect(d.transformedCopyKey).toBeNull();
    }
  });

  it('offers transformations only for phrasing outcomes', () => {
    expect(isTransformable('SUPPRESS_UNSUPPORTED_CAUSALITY')).toBe(true);
    expect(isTransformable('SUPPRESS_UNSUPPORTED_CERTAINTY')).toBe(true);
    expect(isTransformable('SUPPRESS_MEDICAL_OR_DIAGNOSTIC_LANGUAGE')).toBe(false);
    expect(isTransformable('SUPPRESS_INSUFFICIENT_EVIDENCE')).toBe(false);
    expect(isTransformable('SUPPRESS_INVALID_PROVENANCE')).toBe(false);
  });

  it('returns null when no governed transformation applies', () => {
    expect(findTransformation('SUPPRESS_UNSUPPORTED_CAUSALITY', 'high_confidence_pattern')).toBeNull();
  });

  it('uses governed copy keys only — no free-text rewriting', () => {
    for (const t of GOVERNED_TRANSFORMATIONS) {
      expect(t.copyKey).toMatch(/^gate\./);
    }
  });
});

/* ── policy registry integrity ────────────────────────────────────────────── */

describe('policy registry', () => {
  it('gives every rule a unique id and a governance source', () => {
    const ids = POLICY_RULES.map((r) => r.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of POLICY_RULES) {
      expect(r.governanceSource.length).toBeGreaterThan(0);
      expect(r.effectiveVersion).toBe(GATE_POLICY_VERSION);
    }
  });

  it('records review status honestly', () => {
    for (const r of POLICY_RULES) {
      expect(['founder_approved', 'not_yet_reviewed', 'legal_review_required']).toContain(
        r.reviewStatus,
      );
    }
  });

  it('reports machine-readable rule ids on every suppression', () => {
    const d = evaluateClaim(candidate({ proposedText: 'This is a diagnosis.' }), OK);
    expect(d.reasons.every((r) => r.ruleId.startsWith('P42-'))).toBe(true);
  });
});

/* ── Score Protection & no emission ───────────────────────────────────────── */

describe('Score Protection and boundaries', () => {
  it('blocks scan-changes-score, purchase-changes-score, recommendation-changes-score', () => {
    for (const text of [
      'Scanning increases your score.',
      'Buying increases your hydration score.',
      'This recommendation raises your HydroState.',
    ]) {
      const d = evaluateClaim(candidate({ proposedText: text }), OK);
      expect(d.outcome).toBe('SUPPRESS_SCORE_PROTECTION_VIOLATION');
    }
  });

  it('blocks a second hero score', () => {
    for (const text of ['Your pattern score is 62.', 'Your graph score improved.']) {
      const d = evaluateClaim(candidate({ proposedText: text }), OK);
      expect(d.outcome).toBe('SUPPRESS_SCORE_PROTECTION_VIOLATION');
    }
  });

  it('the gate emits a decision, never rendered user copy', () => {
    const d = evaluateClaim(candidate(), OK);
    expect(Object.keys(d)).not.toContain('text');
    expect(Object.keys(d)).not.toContain('renderedCopy');
    // Only a governed key may be returned.
    if (d.transformedCopyKey) expect(d.transformedCopyKey).toMatch(/^gate\./);
  });

  it('is pure — evaluating twice yields the same decision', () => {
    const c = candidate();
    expect(evaluateClaim(c, OK)).toEqual(evaluateClaim(c, OK));
  });
});
