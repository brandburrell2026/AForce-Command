/**
 * Circle/Competition — social-claim truth guards (Wave-4).
 *
 * The audited defect: the Community surfaces computed GLOBAL/CITY/STATE/TEAM
 * ranks and a "+12 spots" pill over a SAMPLE roster, and captioned them with
 * "Re-ranks live as you log intake…" — three assertions of a live competitive
 * standing that no source produces. The founder's ruling was narrow and
 * explicit: the sample cohort STAYS (a previous deletion of it was reversed),
 * what has to go is the CLAIM — no fabricated rank movement, and the sample
 * data must be captioned.
 *
 * `CircleScreenV3` / `CompetitionScreen*` are store+router-connected
 * containers this suite deliberately never mounts (the convention documented
 * in components/home/__tests__/homeScreenV2Wiring.test.ts and
 * components/health/__tests__/connectedHealthContainer.render.test.tsx); the
 * JSX-level facts are therefore source-guarded here, while the view model's
 * behaviour is proved in circleV3Presentation.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOCK_INDIVIDUALS, MOCK_USER_CONTEXT, CURRENT_USER_KEY } from '@/mocks/competitionData';

function code(...segments: string[]): string {
  return readFileSync(join(__dirname, '..', '..', '..', ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, '');
}

const CIRCLE_V3 = code('components', 'community', 'CircleScreenV3.tsx');
const COMPETITION_V1 = code('screens', 'CompetitionScreen.tsx');
const COMPETITION_V2 = code('components', 'community', 'CompetitionScreenV2.tsx');

const EN = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8'),
) as { community: { v3: Record<string, string> } };
const V3 = EN.community.v3;

describe('CircleScreenV3 — the sample cohort is captioned, never passed off as real', () => {
  it('renders the sample-data caption alongside the ranks it qualifies', () => {
    expect(CIRCLE_V3).toContain("t('community.v3.sample_note')");
  });

  it('caption names the cohort as sample data AND denies a real-people ranking', () => {
    expect(V3.sample_note).toMatch(/sample/i);
    expect(V3.sample_note).toMatch(/not a ranking against real people/i);
  });

  it('footnote no longer claims a live standing against others', () => {
    expect(V3.footnote).not.toMatch(/re-rank/i);
    expect(V3.footnote).not.toMatch(/\bspots?\b/i);
    // The honest half survives: your own score and streak really do move.
    expect(V3.footnote).toMatch(/your score and streak/i);
  });
});

describe('CircleScreenV3 — an empty roster reads as empty, not as a blank screen', () => {
  it('imports the shared AFEmptyState rather than inventing a local one', () => {
    expect(CIRCLE_V3).toMatch(/import \{[^}]*AFEmptyState[^}]*\} from '@\/components\/ui';/);
  });

  it('renders it on the falsy side of the rows-length branch', () => {
    const branch = CIRCLE_V3.slice(CIRCLE_V3.indexOf('model.rows.length > 0'));
    expect(branch).toMatch(/<AFEmptyState/);
    expect(branch.indexOf('<AFEmptyState')).toBeGreaterThan(branch.indexOf('<LeaderRow'));
  });

  it('leaves the Challenge tab (rosterless by design) without an empty state', () => {
    expect(CIRCLE_V3).toContain("model.tab === 'challenge' ? null");
  });

  it('copy promises real data instead of implying the list is still loading', () => {
    expect(V3.empty_title).toBeTruthy();
    expect(V3.empty_message).toMatch(/real data/i);
  });
});

describe('Competition screens — the movement pill never reports a non-move', () => {
  it('V1 renders the pill only for positive movement', () => {
    expect(COMPETITION_V1).toMatch(/\{me\.recentDelta > 0 && \(/);
  });

  it('V2 renders the pill only for positive movement', () => {
    expect(COMPETITION_V2).toMatch(/\{me\.recentDelta > 0 && \(/);
  });
});

describe('competitionData mocks — claim removed, founder-ruled cohort intact', () => {
  it('reports no rank movement (the banned "+12 spots" claim is gone)', () => {
    expect(MOCK_USER_CONTEXT.recentDelta).toBe(0);
  });

  it('keeps the sample cohort the founder restored in PR #712', () => {
    // Deleting or emptying this roster was explicitly reversed by the founder;
    // it is also load-bearing — competitionEngine non-null-asserts the You row.
    expect(MOCK_INDIVIDUALS.length).toBeGreaterThan(1);
    expect(MOCK_INDIVIDUALS.some((u) => u.id === CURRENT_USER_KEY)).toBe(true);
  });
});
