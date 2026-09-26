import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..', '..', '..', 'docs', 'skinia');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('SkinIA validation package', () => {
  it('cannot represent templates or build success as completed validation', () => {
    const index = read('PHASE1-VALIDATION-PACKAGE.md');
    const gate = read('validation/REVIEW-AND-RELEASE-GATE.md');
    expect(index).toContain('PENDING — ACCURACY EVIDENCE NOT COLLECTED');
    expect(index).toContain('Build 99');
    expect(index).toContain('OBSERVATIONS_NOT_ADMITTED');
    expect(index).toContain('changes required before');
    expect(index).toContain('unit tests are engineering checks, not validation.');
    expect(gate).toContain('Current decision: `BLOCKED`');
    expect(gate).toContain('§25.3 owner separately decides');
  });

  it('covers the authorized matrix without retaining raw images', () => {
    const protocol = read('validation/CAPTURE-AND-REVIEW-PROTOCOL.md');
    const record = read('validation/EVIDENCE-RECORD-TEMPLATE.md');
    for (const dimension of [
      'iPhone', 'Android', 'indoor', 'outdoor', 'warm', 'cool', 'low',
      'Fitzpatrick I–VI', 'repeatability', 'false positives',
      'false negatives', 'confidence', 'auto-exposure', 'auto-white-balance',
    ]) {
      expect((protocol + record).toLowerCase()).toContain(dimension.toLowerCase());
    }
    for (const label of [
      'VISIBLE_DRYNESS', 'VISIBLE_FLAKING', 'VISIBLE_REDNESS',
      'VISIBLE_SURFACE_SHINE', 'VISIBLE_TEXTURE',
    ]) expect(record).toContain(label);
    expect(protocol).toContain('Do not save a captured frame or screenshot');
    expect(record).toContain('no validation evidence');
  });
});
