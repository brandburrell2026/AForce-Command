import { describe, it, expect } from 'vitest';
import { containsForbiddenResponseLanguage } from '../intelligence/responseLanguage';
import en from '../../locales/en.json';

const ns = (en as unknown as Record<string, Record<string, string>>).responseTimeline;

describe('Section 60 — responseTimeline surface copy', () => {
  it('the namespace exists', () => {
    expect(ns).toBeTruthy();
  });

  it('no string uses risk/injury/diagnosis/prevent framing', () => {
    for (const [k, v] of Object.entries(ns)) {
      expect(containsForbiddenResponseLanguage(v), `responseTimeline.${k} = ${JSON.stringify(v)}`).toBe(false);
    }
  });

  it('has every key the surface renders', () => {
    for (const k of [
      'title',
      'subtitle',
      'collecting_title',
      'collecting',
      'empty',
      'week_current',
      'week_ago',
      'week_ago_plural',
    ]) {
      expect(ns[k], k).toBeTruthy();
    }
  });
});
