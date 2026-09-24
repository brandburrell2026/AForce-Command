/**
 * PR-R5 — raw colours → AForce tokens (Founder Decision A5, 2026-09-23).
 *
 * Three files had introduced raw colour literals with NO entry in
 * `rawColorBaseline.json` (the VS 3.0 drift ratchet in
 * `brandTokenLiterals.lock.test.ts` treats a baseline-less file as a NEW
 * raw-colour file and fails). Decision A5 ruled that the fix is to use the
 * existing token system — not to raise the allowance and not to add invented
 * literals to the baseline:
 *
 *   - Profile SkinIA entry icon disc: `'rgba(193,40,27,0.14)'` →
 *     `withAlpha(af.red, 0.14)` — required to be BYTE-IDENTICAL output.
 *   - One Breath idle voice-wave bars: `'rgba(161,156,145,0.5)'` →
 *     `withAlpha(af.textSecondary, 0.5)` — the existing secondary-text grey
 *     through the alpha system. The bars are decorative (the container carries
 *     the accessibilityLabel "Voice capture is not enabled"; the active state is
 *     `af.red`). Composite over `af.canvas` #0D0D0D: old ≈ #57554F (2.593:1),
 *     new ≈ #5A5957 (2.773:1) — contrast did not drop.
 *   - SkinIA editorial suite: six invented literals mapped onto the existing
 *     brand palette (table pinned below).
 *
 * This suite is the regression lock for that migration: it pins the resolved
 * values (so a token re-definition that silently changes these surfaces is
 * caught here, with the mapping table as the diff) and re-scans the three
 * migrated files with the SAME regex the ratchet uses, so a re-introduced
 * literal fails here with a named file/line even before the ratchet's
 * aggregate check runs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { af, withAlpha } from '../afTokens';
import { edInk, edPositive, edStock } from '../editorialTokens';

const ROOT = join(__dirname, '..', '..'); // artifacts/aforce-os

/** Identical to RAW_COLOR_RE in brandTokenLiterals.lock.test.ts. */
const RAW_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

/** Identical to stripComments() in brandTokenLiterals.lock.test.ts. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

const MIGRATED_FILES = [
  'components/oneBreath/OneBreathScreen.tsx',
  'components/profile/ProfileScreenV2.tsx',
  'components/skinIntelligence/SkinIntelligenceEditorialSuite.tsx',
] as const;

describe('PR-R5 (A5): Profile SkinIA entry disc — withAlpha(af.red, 0.14) is byte-identical to the retired literal', () => {
  it("withAlpha(af.red, 0.14) === 'rgba(193,40,27,0.14)'", () => {
    expect(withAlpha(af.red, 0.14)).toBe('rgba(193,40,27,0.14)');
  });

  it('af.red is still the frozen brand Signal Red (#C1281B) the retired literal encoded', () => {
    expect(af.red).toBe('#C1281B');
  });

  it('ProfileScreenV2 renders the SkinIA entry disc through withAlpha(af.red, 0.14) (call-site pin)', () => {
    // The two assertions above hold regardless of what the screen does; this
    // one pins the migrated call site itself, so a later alpha drift at the
    // disc (e.g. af.redDim, or a different alpha) fails here by name.
    const src = readFileSync(join(ROOT, 'components/profile/ProfileScreenV2.tsx'), 'utf8');
    expect(src).toContain("import { af, withAlpha } from '@/theme';");
    const start = src.indexOf('const skinIAEntry = skinIAEnabled ? (');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf(') : null;', start);
    expect(end).toBeGreaterThan(start);
    const entryBlock = src.slice(start, end);
    expect(entryBlock).toContain('testID="profile-skinia-entry"');
    expect(entryBlock).toContain('backgroundColor: withAlpha(af.red, 0.14)');
  });
});

describe('PR-R5 (A5): One Breath idle wave bars — secondary-text grey through the alpha system', () => {
  it("withAlpha(af.textSecondary, 0.5) === 'rgba(166,165,161,0.5)'", () => {
    expect(withAlpha(af.textSecondary, 0.5)).toBe('rgba(166,165,161,0.5)');
  });

  it('af.textSecondary is #A6A5A1 (the value the replacement resolves through)', () => {
    expect(af.textSecondary).toBe('#A6A5A1');
  });

  it('the wave container still carries the non-listening label and the active bar is af.red (the bars stay decorative)', () => {
    const src = readFileSync(join(ROOT, 'components/oneBreath/OneBreathScreen.tsx'), 'utf8');
    expect(src).toContain('accessibilityLabel="Voice capture is not enabled"');
    expect(src).toContain('waveBarActive: { backgroundColor: af.red }');
    expect(src).toContain('backgroundColor: withAlpha(af.textSecondary, 0.5)');
  });
});

describe('PR-R5 (A5): SkinIA editorial suite — invented literals mapped onto the existing brand palette', () => {
  // Exact old → new mapping ruled under A5. Each row pins the resolved hex so a
  // later token re-definition surfaces here as a named regression.
  const MAPPING: ReadonlyArray<{ site: string; old: string; token: string; value: string; resolved: string }> = [
    { site: 'Guardian roster accent, index 1 (caution tier)', old: '#C8A84B', token: 'af.amber', value: af.amber, resolved: '#FFA01E' },
    { site: 'Guardian roster accent, index >= 2 (positive)', old: '#2DBF8A', token: 'edPositive', value: edPositive, resolved: '#1FA35A' },
    { site: 'Clutch roster accent, index 1', old: '#00C49A', token: 'af.cyan', value: af.cyan, resolved: '#00E5C8' },
    { site: 'Clutch roster accent, index 2', old: '#4ADE80', token: 'edPositive', value: edPositive, resolved: '#1FA35A' },
    { site: 'Clutch roster accent, index 3', old: '#E8E0C8', token: 'edInk.ivory', value: edInk.ivory, resolved: '#EDEAE3' },
    { site: 'clutchRow backgroundColor', old: '#141414', token: 'edStock.blackRaised', value: edStock.blackRaised, resolved: '#161512' },
  ];

  it.each(MAPPING)('$site: $old → $token resolves to $resolved', ({ value, resolved }) => {
    expect(value).toBe(resolved);
  });

  it('every retired literal is gone from the suite source (comment-stripped)', () => {
    const src = stripComments(readFileSync(join(ROOT, 'components/skinIntelligence/SkinIntelligenceEditorialSuite.tsx'), 'utf8'));
    for (const { old } of MAPPING) {
      expect(src.toUpperCase()).not.toContain(old.toUpperCase());
    }
  });

  it('the suite reads the replacement tokens at the migrated sites', () => {
    const src = readFileSync(join(ROOT, 'components/skinIntelligence/SkinIntelligenceEditorialSuite.tsx'), 'utf8');
    expect(src).toContain('index === 1 ? af.amber : edPositive');
    expect(src).toContain('const colors = [edAccent.red, af.cyan, edPositive, edInk.ivory];');
    expect(src).toContain('backgroundColor: edStock.blackRaised, borderLeftWidth: 3');
  });
});

describe('PR-R5 (A5): the three migrated files carry no raw colour literal (ratchet regex, comment-stripped)', () => {
  for (const rel of MIGRATED_FILES) {
    it(`${rel} contains no raw colour literal`, () => {
      const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
      const findings: string[] = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(RAW_COLOR_RE.source, RAW_COLOR_RE.flags);
      while ((m = re.exec(src))) {
        findings.push(`L${src.slice(0, m.index).split('\n').length}: ${m[0]}`);
      }
      if (findings.length) {
        throw new Error(
          `${rel} re-introduced raw colour — use af.* / withAlpha() / editorial tokens (Founder Decision A5, PR-R5):\n  ${findings.join('\n  ')}`,
        );
      }
      expect(findings).toEqual([]);
    });
  }

  it('self-test: the scan flags a hex and an rgba() and ignores comments', () => {
    const sample = "const a='#141414'; const b='rgba(161,156,145,0.5)';\n// #C8A84B comment\n/* rgba(1,2,3,1) */";
    const matches = stripComments(sample).match(RAW_COLOR_RE) || [];
    expect(matches).toEqual(['#141414', 'rgba(161,156,145,0.5)']);
  });
});
