/**
 * The cold-launch cinematic must not announce a state AForce has not observed.
 *
 * Build 60 shipped this defect twice over. First as a hardcoded
 * `DEFAULT_SCORE = 92` behind a `readinessScore > 0` guard, which treated a
 * REAL HydroState of 0 as "not loaded" and substituted 92. Removing the
 * constant fixed the component but not the product: `app/_layout.tsx` passes
 * `engine.score`, and on a cold first launch that is the seeded
 * `defaultUserState` projection — 76 / BALANCED — for a member with no logged
 * intake at all. The fabrication moved instead of dying.
 *
 * Home already withholds that number behind the Wave-5 evidence gate. The
 * cinematic plays BEFORE Home, so without the same gate it simply announced
 * the fabrication first — and it was the very first thing a new member saw.
 *
 * Source-scanned rather than rendered: the defect lives at the CALL SITE, in
 * which value gets handed to a component that is already correct. A render
 * harness over the component would have passed against the broken build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..', '..');
const layout = readFileSync(resolve(PKG, 'app/_layout.tsx'), 'utf8');
const sequence = readFileSync(resolve(PKG, 'components/opening/OpeningSequence.tsx'), 'utf8');

/** Comments name the removed defect; a naive scan would read that as the defect. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

const layoutCode = code(layout);
const sequenceCode = code(sequence);

describe('the cinematic is gated on the same evidence as Home', () => {
  it('resolves evidence from the shared resolver, not a local rule', () => {
    // Reusing homeBaselineState means the cinematic and Home can never
    // disagree about whether this member has been observed.
    expect(layoutCode).toContain('resolveHomeEvidence');
    expect(layoutCode).toContain('countRealHistoryEntries');
  });

  it('withholds the score unless evidence is established', () => {
    expect(layoutCode).toMatch(/evidence === 'established' \? engine\.score : undefined/);
    expect(layoutCode).toContain('readinessScore={shownScore}');
  });

  it('never hands the raw engine score straight to the sequence', () => {
    // The exact Build-60 shape.
    expect(layoutCode).not.toContain('readinessScore={engine.score}');
  });

  it('costs no network — the gate reads only state the store already holds', () => {
    expect(layoutCode).not.toContain('fetchJournalRollups');
  });
});

describe('the cinematic never claims a body state it has not measured', () => {
  it('does not fall through to the READY TO PERFORM default when unevidenced', () => {
    // The component's own fallback is "READY TO PERFORM" — passing `undefined`
    // would have replaced a fabricated number with a fabricated claim.
    expect(layoutCode).toContain("t('opening.readiness_building')");
    const call = layoutCode.slice(layoutCode.indexOf('<OpeningSequence'));
    expect(call).toMatch(/evidence === 'established'[\s\S]{0,200}readinessLabel/);
  });

  it('reuses the approved baseline phrase rather than inventing a second one', () => {
    const en = JSON.parse(readFileSync(resolve(PKG, 'locales/en.json'), 'utf8'));
    expect(en.opening.readiness_building).toBe('BUILDING YOUR BASELINE');
  });
});

describe('the component contract that made the fix possible', () => {
  it('a real 0 is a real score and still renders', () => {
    // The original guard was `readinessScore > 0`, which is why a DEPLETED
    // member saw 92. Only a non-finite value may withhold the number.
    expect(sequenceCode).toContain('Number.isFinite(readinessScore)');
    expect(sequenceCode).not.toMatch(/readinessScore\s*>\s*0/);
  });

  it('carries no substitute figure to fall back to', () => {
    expect(sequenceCode).not.toMatch(/DEFAULT_SCORE\s*=/);
  });
});
