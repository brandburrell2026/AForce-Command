/**
 * CircleScreenV3 — certainty hierarchy + row accessibility (Wave-5).
 *
 * The audited defect was inversion: the screen said "SPORT MODE · LIVE" over a
 * SAMPLE cohort, painted four cohort-relative ranks at the same size as the
 * one real number (the member's own score) with the band accent on GLOBAL, and
 * left the sample-data qualifier as the dimmest type on the page. The loudest
 * things were the least-evidenced ones. Alongside it, each leader row was a
 * handful of unlabelled Texts in which "this is you", "verified" and the
 * movement arrow existed only as colour and glyphs.
 *
 * `CircleScreenV3` is a store-connected container this suite never mounts (the
 * convention documented in circleV3SocialClaims.test.ts); the JSX-level facts
 * are source-guarded here, while the spoken row label — the part with real
 * branching — is proved as a pure function in circleV3Presentation.test.ts.
 *
 * Style assertions resolve through the imported `afType` rather than naming
 * pixel sizes, so the lock survives a token retune and still fails the moment
 * a rank is drawn as large as the score.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afType } from '@/theme';

const PKG = join(__dirname, '..', '..', '..');
const SRC = readFileSync(join(PKG, 'components', 'community', 'CircleScreenV3.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const V3 = (
  JSON.parse(readFileSync(join(PKG, 'locales', 'en.json'), 'utf8')) as {
    community: { v3: Record<string, string> };
  }
).community.v3;

/** The body of one StyleSheet entry, comments stripped. */
function styleBlock(name: string): string {
  const start = CODE.indexOf(`${name}: {`);
  expect(start, `style "${name}" must exist`).toBeGreaterThan(-1);
  return CODE.slice(start, CODE.indexOf('},', start));
}

/** The afType step a style spreads, e.g. `...afType.body` → 17. */
function fontSizeOf(styleName: string): number {
  const m = styleBlock(styleName).match(/\.\.\.afType\.(\w+)/);
  expect(m, `style "${styleName}" must spread an afType step`).not.toBeNull();
  const step = afType[m![1] as keyof typeof afType] as { fontSize: number };
  return step.fontSize;
}

describe('CircleScreenV3 — nothing claims a live competition against real people', () => {
  it('the eyebrow over the sample cohort no longer says LIVE', () => {
    expect(V3.eyebrow).not.toMatch(/\blive\b/i);
    expect(V3.eyebrow.trim().length).toBeGreaterThan(0);
    expect(CODE).toContain("t('community.v3.eyebrow')");
  });

  it('no other Community V3 string revives the claim', () => {
    for (const [key, value] of Object.entries(V3)) {
      expect(value, `community.v3.${key}`).not.toMatch(/\blive\b/i);
    }
  });
});

describe('CircleScreenV3 — the real number outranks the sample-derived ones', () => {
  it('draws the member score larger than the four cohort ranks', () => {
    expect(fontSizeOf('scoreValue')).toBeGreaterThan(fontSizeOf('statValue'));
  });

  it('leaves the band accent to the score — a rank never wears it', () => {
    // Was `accent={you.accent}` on GLOBAL: a sample-cohort position tinted
    // like a measured state.
    expect(CODE).toMatch(/<ScoreStat[^>]*accent=\{you\.accent\}/);
    expect(CODE).not.toMatch(/<RankStat[^>]*accent=/);
    expect(styleBlock('statValue')).toContain('af.textSecondary');
  });

  it('keeps the founder comp: same five columns, same order', () => {
    const statsRow = CODE.slice(CODE.indexOf('styles.statsRow'));
    const order = [...statsRow.matchAll(/community\.v3\.stat_(\w+)/g)].map((m) => m[1]).slice(0, 5);
    expect(order).toEqual(['global', 'city', 'state', 'team', 'score']);
  });
});

describe('CircleScreenV3 — the sample-data qualifier reads as the standings caption', () => {
  it('is no longer the dimmest text on the screen', () => {
    const note = styleBlock('sampleNote');
    expect(note).toContain('af.textSecondary');
    expect(note).not.toContain('af.textTertiary');
    // The footnote stays tertiary — the caption is deliberately above it.
    expect(styleBlock('footnote')).toContain('af.textTertiary');
  });

  it('is set at least as large as the body caption it outgrew', () => {
    expect(fontSizeOf('sampleNote')).toBeGreaterThan(afType.caption.fontSize);
  });

  it('is bound to the standings by a rule, not left floating', () => {
    expect(styleBlock('sampleNote')).toMatch(/borderLeftWidth/);
  });
});

describe('CircleScreenV3 — a leader row is one announcement, not six fragments', () => {
  const row = CODE.slice(CODE.indexOf('function LeaderRow'), CODE.indexOf('const styles ='));

  it('groups the row and labels it with the composed sentence', () => {
    expect(row).toMatch(/accessible\s*\n?\s*accessibilityLabel=\{circleRowA11yLabel\(/);
  });

  it('drops the Verified badge label that a bare View discarded anyway', () => {
    // The word is spoken by the row label instead; a second accessibility
    // element inside an `accessible` group would only re-fragment the row.
    expect(row).not.toMatch(/styles\.verified\}[^>]*accessibilityLabel/);
    expect(V3.row_verified).toBeTruthy();
  });

  it('marks YOU in words, not only in green', () => {
    expect(row).toMatch(/row\.isYou \? <Text style=\{styles\.youTag\}>/);
    expect(V3.row_you).toBeTruthy();
  });

  it('gives rank movement, rank and score real phrases', () => {
    for (const key of [
      'row_rank',
      'row_score',
      'row_move_up_one',
      'row_move_up_other',
      'row_move_down_one',
      'row_move_down_other',
      'row_move_flat',
    ]) {
      expect(V3[key], `community.v3.${key}`).toBeTruthy();
    }
    expect(CODE).toContain("t('community.v3.row_move_flat')");
  });
});

describe('CircleScreenV3 — a tab change is announced, not silent', () => {
  it('announces the new scope on change only, never on mount', () => {
    expect(CODE).toContain('AccessibilityInfo.announceForAccessibility');
    // Mount (and StrictMode's replayed mount) records the tab and stays quiet.
    expect(CODE).toMatch(/announcedTabRef\.current === tab\) return;/);
    expect(CODE).toMatch(/if \(first\) return;/);
    expect(CODE).toMatch(/\}, \[tab\]\);/);
    expect(V3.tab_announce).toMatch(/\{\{tab\}\}/);
  });
});
