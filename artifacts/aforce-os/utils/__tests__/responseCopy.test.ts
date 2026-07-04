import { describe, it, expect } from 'vitest';
import { describeResponse, categoryLabelKey } from '../intelligence/responseCopy';
import { containsForbiddenResponseLanguage } from '../intelligence/responseLanguage';
import { RESPONSE_CATEGORIES } from '../../types/adaptiveResponse';
import type { PersonalResponseEntry, ResponseOutcome } from '../../types/adaptiveResponse';
import en from '../../locales/en.json';

function entry(over: Partial<PersonalResponseEntry>): PersonalResponseEntry {
  return {
    category: 'hydration',
    status: 'insufficient',
    sampleSize: 0,
    whatWorked: null,
    confidenceAfterAction: null,
    ...over,
  };
}

describe('Section 59 — responseCopy.describeResponse', () => {
  it('maps insufficient entries to the building line with null figures (no fabrication)', () => {
    const d = describeResponse(entry({ status: 'insufficient' }));
    expect(d.lineKey).toBe('adaptiveResponse.building');
    expect(d.followedPct).toBeNull();
    expect(d.confidencePct).toBeNull();
  });

  it('maps each outcome to its line key and rounds the percentages', () => {
    const outcomes: Record<ResponseOutcome, string> = {
      improved: 'adaptiveResponse.outcome_improved',
      steady: 'adaptiveResponse.outcome_steady',
      declined: 'adaptiveResponse.outcome_declined',
      unknown: 'adaptiveResponse.outcome_unknown',
    };
    for (const outcome of Object.keys(outcomes) as ResponseOutcome[]) {
      const d = describeResponse(
        entry({
          status: 'ready',
          sampleSize: 8,
          whatWorked: { sampleSize: 8, followed: 6, followedRate: 0.75, outcome },
          confidenceAfterAction: 0.8,
        }),
      );
      expect(d.lineKey).toBe(outcomes[outcome]);
      expect(d.followedPct).toBe(75);
      expect(d.confidencePct).toBe(80);
    }
  });

  it('derives a stable category label key per category', () => {
    for (const c of RESPONSE_CATEGORIES) {
      expect(categoryLabelKey(c)).toBe(`adaptiveResponse.category_${c}`);
    }
  });
});

describe('Section 59 — every adaptiveResponse locale string is cause-and-effect only', () => {
  const ns = (en as unknown as Record<string, Record<string, string>>).adaptiveResponse;

  it('the namespace exists', () => {
    expect(ns).toBeTruthy();
  });

  it('no string uses risk/injury/diagnosis/prevent framing', () => {
    for (const [k, v] of Object.entries(ns)) {
      expect(containsForbiddenResponseLanguage(v), `adaptiveResponse.${k} = ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it('every key the copy mapper points at exists in the locale', () => {
    const referenced = [
      'building',
      'outcome_improved',
      'outcome_steady',
      'outcome_declined',
      'outcome_unknown',
      ...RESPONSE_CATEGORIES.map((c) => `category_${c}`),
    ];
    for (const k of referenced) expect(ns[k], k).toBeTruthy();
  });
});
