/**
 * Circle V3 — SAMPLE-COHORT DISCLOSURE LOCK (Wave-5 tail, Residual B).
 *
 * The residual the final audit named: "LIVE" was gone and a sample caption
 * existed, but the roster "still renders with the visual grammar of a real
 * leaderboard; nothing on the surface tells a member the names are synthetic".
 * Concretely — a sample row had the same avatar, name, subtitle, score column
 * and movement arrow as the member's own row, five of the invented profiles
 * wore a Verified badge (a credential — social proof for a person who does not
 * exist), and the only thing separating "you" from "Jordan A." was a green
 * tint plus a caption above the list that a member may never read.
 *
 * The founder's constraint is what makes this a DISCLOSURE fix and not a
 * deletion: ruling #712 restored this cohort after a substitution was
 * reversed, and it stays sample-by-design until /v1/competition exists. So
 * this suite locks BOTH halves at once:
 *   1. the cohort constants are still there and still populated (#712 intact —
 *      nobody "fixed" this by emptying the roster), and
 *   2. every sample row is marked as sample, carries no verification
 *      credential, and nothing on the screen claims live participation.
 *
 * `CircleScreenV3` is a store-connected container this suite never mounts (the
 * convention documented in circleV3SocialClaims.test.ts) — JSX-level facts are
 * source-guarded, the row model is proved as a pure function.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildSnapshot } from '@/services/competitionEngine';
import {
  MOCK_CITIES,
  MOCK_INDIVIDUALS,
  MOCK_STATES,
  MOCK_TEAMS,
  CURRENT_USER_KEY,
} from '@/mocks/competitionData';
import {
  buildCircleV3Model,
  circleRowA11yLabel,
  type CircleRowA11yStrings,
  type CircleTab,
  type CircleV3RowView,
} from '../circleV3Presentation';

const PKG = join(__dirname, '..', '..', '..');
const SRC = readFileSync(join(PKG, 'components', 'community', 'CircleScreenV3.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const V3 = (
  JSON.parse(readFileSync(join(PKG, 'locales', 'en.json'), 'utf8')) as {
    community: { v3: Record<string, string> };
  }
).community.v3;

/** Tabs that actually render a roster (Challenge is rosterless by design). */
const ROSTER_TABS: CircleTab[] = ['rank', 'cities', 'friends'];

function rowsFor(tab: CircleTab): CircleV3RowView[] {
  return buildCircleV3Model({
    snapshot: buildSnapshot({
      liveUserScore: 92,
      liveCompliance: 0.9,
      liveConsistency: 96,
      liveStateLabel: 'PEAK',
    }),
    cityOverride: null,
    hydrationDaysThisWeek: 5,
    tab,
  }).rows;
}

/** Every row a member can reach on this screen. */
function everyRow(): CircleV3RowView[] {
  return ROSTER_TABS.flatMap(rowsFor);
}

/**
 * THE LOCK'S PREDICATE, extracted so the mutation test below can aim the exact
 * same check at a deliberately-broken input. Returns the offenders, so a
 * failure names them instead of just reporting `false`.
 */
function credentialedSampleRows(rows: CircleV3RowView[]): string[] {
  return rows.filter((r) => r.isSample && r.verified).map((r) => r.name);
}

describe('founder ruling #712 — the sample cohort is still here, still populated', () => {
  it('keeps every cohort constant non-empty (this was never fixable by deletion)', () => {
    // A previous substitution of this cohort was explicitly REVERSED by the
    // founder. Disclosure is the remedy; emptying any of these is a violation
    // of the ruling, not a fix for it.
    expect(MOCK_INDIVIDUALS.length).toBeGreaterThan(1);
    expect(MOCK_CITIES.length).toBeGreaterThan(0);
    expect(MOCK_STATES.length).toBeGreaterThan(0);
    expect(MOCK_TEAMS.length).toBeGreaterThan(0);
    expect(MOCK_INDIVIDUALS.some((u) => u.id === CURRENT_USER_KEY)).toBe(true);
  });

  it('keeps the approved comp roster itself, not just some roster', () => {
    // Named profiles from the founder's Community comp (2026-08-12). Swapping
    // them for anonymous placeholders is the substitution #712 reversed.
    const names = MOCK_INDIVIDUALS.map((u) => u.name);
    for (const name of ['Jordan A.', 'Alicia R.', 'Marcus K.']) {
      expect(names, `comp roster must still contain ${name}`).toContain(name);
    }
  });

  it('leaves the roster data untouched — the fix is presentation, not redaction', () => {
    // The five `verified: true` entries are the founder's data and stay in the
    // mock. What changed is that the view model will not render them.
    expect(MOCK_INDIVIDUALS.filter((u) => u.verified === true).length).toBeGreaterThan(0);
  });
});

describe('a sample row is distinguishable from the member’s own row', () => {
  it('marks every non-member row on every roster tab as sample', () => {
    for (const tab of ROSTER_TABS) {
      const rows = rowsFor(tab);
      expect(rows.length, `${tab} must render rows`).toBeGreaterThan(0);
      for (const row of rows) {
        if (row.isYou && tab !== 'cities') continue; // the member's own real row
        expect(row.isSample, `${tab}: "${row.name}" must be marked sample`).toBe(true);
      }
    }
  });

  it('never marks the member’s own person-row as sample — it is real and stays real', () => {
    for (const tab of ['rank', 'friends'] as CircleTab[]) {
      const you = rowsFor(tab).find((r) => r.isYou)!;
      expect(you, `${tab} must contain the member's row`).toBeTruthy();
      expect(you.isSample).toBe(false);
    }
  });

  it('marks even YOUR city as sample — the participant count is invented too', () => {
    const rows = rowsFor('cities');
    const yourCity = rows.find((r) => r.isYou)!;
    expect(yourCity).toBeTruthy();
    expect(yourCity.isSample).toBe(true);
    // "4,128 athletes" is the screen's most direct participation claim.
    expect(rows.every((r) => r.isSample)).toBe(true);
  });

  it('renders the tag on the row, visually and to a screen reader', () => {
    expect(CODE).toMatch(/row\.isSample \? <Text style=\{styles\.sampleTag\}>\{sampleLabel\}<\/Text>/);
    expect(CODE).toContain("t('community.v3.row_sample')");
    expect(CODE).toContain("sample: t('community.v3.row_sample_a11y')");
    expect(V3.row_sample).toBeTruthy();
    expect(V3.row_sample_a11y).toMatch(/sample/i);
    expect(V3.row_sample_a11y).toMatch(/not a real member/i);
  });

  it('keeps the member’s row dominant — the sample tag is neutral, the YOU tag is not', () => {
    const sampleTag = CODE.slice(CODE.indexOf('sampleTag: {'));
    const tagBody = sampleTag.slice(0, sampleTag.indexOf('},'));
    // Neutral text/line tokens only: no band accent, so a sample tag can never
    // read as a status and can never out-shout the member's green YOU tag.
    expect(tagBody).toContain('af.textTertiary');
    expect(tagBody).not.toMatch(/af\.(green|red|amber|cyan|guardian)/);
    expect(CODE).toMatch(/youTag: \{[\s\S]*?af\.green/);
  });

  it('speaks the provenance next to the name, not buried at the end', () => {
    const S = strings();
    const sample = rowsFor('rank').find((r) => r.isSample)!;
    const label = circleRowA11yLabel(sample, 'Miami, FL', S);
    expect(label).toContain(`${sample.name}, ${S.sample}`);
  });
});

describe('no sample row carries a verification / credential affordance', () => {
  it('renders no verified badge over any sample row, on any tab', () => {
    expect(credentialedSampleRows(everyRow())).toEqual([]);
  });

  it('never speaks "Verified" over a sample row either', () => {
    const S = strings();
    for (const row of everyRow()) {
      if (!row.isSample) continue;
      expect(circleRowA11yLabel(row, 'x', S)).not.toContain(S.verified);
    }
  });

  it('leaves the badge wired for real members, gated on the row model', () => {
    // Not deleted: when /v1/competition supplies real members, a true badge is
    // a true claim. The gate is `verified`, which the model forces false for
    // sample rows — see circleV3Presentation.individualRow.
    expect(CODE).toMatch(/\{row\.verified \? \(/);
  });

  /**
   * MUTATION TEST for the lock directly above — the most important one in this
   * file, because a credential on an invented person is the single strongest
   * "this is a real member" signal the screen can emit.
   *
   * A green assertion over already-correct data proves nothing about whether
   * the assertion can fail. This reconstructs the PRE-FIX behaviour (the
   * roster's `verified` passed straight through to the row) on the real rows
   * and requires the predicate to catch it.
   */
  it('MUTATION: the lock fails when verification is let through to sample rows', () => {
    const preFix = everyRow().map((row) => ({
      ...row,
      verified:
        row.verified ||
        MOCK_INDIVIDUALS.some((u) => u.name === row.name && u.verified === true),
    }));
    const caught = credentialedSampleRows(preFix);
    expect(caught.length).toBeGreaterThan(0);
    expect(caught).toContain('Jordan A.');
    // And the a11y half of the lock would have caught it too.
    const S = strings();
    const mutant = preFix.find((r) => r.name === 'Jordan A.')!;
    expect(circleRowA11yLabel(mutant, 'Miami, FL', S)).toContain(S.verified);
  });
});

describe('nothing on the screen claims live participation', () => {
  it('no Community V3 string says "live"', () => {
    for (const [key, value] of Object.entries(V3)) {
      expect(value, `community.v3.${key}`).not.toMatch(/\blive\b/i);
    }
  });

  it('no Community V3 string claims real people, real members, or real competition', () => {
    // The caption's own denial ("Not a ranking against real people") is the one
    // legitimate use of the phrase — it is the disclaimer, not the claim.
    const DENIALS = new Set(['sample_note', 'row_sample_a11y']);
    for (const [key, value] of Object.entries(V3)) {
      if (DENIALS.has(key)) continue;
      expect(value, `community.v3.${key}`).not.toMatch(/real (people|members|athletes)/i);
      expect(value, `community.v3.${key}`).not.toMatch(/\bcompeting against\b/i);
    }
  });

  it('keeps the standings caption that qualifies the whole list', () => {
    // Row-level disclosure is additive to the caption, never a replacement.
    expect(CODE).toContain("t('community.v3.sample_note')");
    expect(V3.sample_note).toMatch(/sample/i);
  });
});

describe('the Wave-5 accessibility work in this file survives', () => {
  it('keeps role=tab inside role=tablist, with hitSlop on the pills', () => {
    expect(CODE).toContain('accessibilityRole="tablist"');
    expect(CODE).toContain('accessibilityRole="tab"');
    expect(CODE).toMatch(/hitSlop=\{\{ top: 4, bottom: 4, left: 2, right: 2 \}\}/);
  });

  it('keeps each row announcing as ONE element, tag included', () => {
    const row = CODE.slice(CODE.indexOf('function LeaderRow'), CODE.indexOf('const styles ='));
    expect(row).toMatch(/accessible\s*\n?\s*accessibilityLabel=\{circleRowA11yLabel\(/);
    // The new tag is a plain Text inside that group — it must NOT introduce a
    // second a11y element, which would re-fragment the row the Wave-5 pass
    // collapsed. Its words reach the reader through the composed label.
    expect(row).not.toMatch(/styles\.sampleTag\}[^>]*accessibilityLabel/);
    expect(row).not.toMatch(/styles\.sampleTag\}[^>]*accessible/);
  });

  it('keeps "you" perceivable without colour', () => {
    expect(CODE).toMatch(/row\.isYou \? <Text style=\{styles\.youTag\}>/);
  });
});

/** The en.json phrasing, inlined — the presentation module is i18n-free. */
function strings(): CircleRowA11yStrings {
  return {
    rank: (n) => V3.row_rank.replace('{{n}}', String(n)),
    you: V3.row_you,
    sample: V3.row_sample_a11y,
    verified: V3.row_verified,
    score: (n) => V3.row_score.replace('{{n}}', String(n)),
    moveUp: (n) => V3.row_move_up_other.replace('{{count}}', String(n)),
    moveDown: (n) => V3.row_move_down_other.replace('{{count}}', String(n)),
    moveFlat: V3.row_move_flat,
  };
}
