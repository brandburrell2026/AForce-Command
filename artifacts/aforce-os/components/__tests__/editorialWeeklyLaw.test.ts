/**
 * Editorial Weekly — The Feature — E5 law lock (founder decisions 2026-08-30).
 *
 * Planted BEFORE the implementation. Weekly is the FIRST surface in the
 * migration to turn the stock to paper, so this file carries two jobs the
 * earlier E-steps did not need: it pins the paper register itself, and it pins
 * the producers a paper migration could silently strand.
 *
 * FOUNDER DECISIONS ENFORCED HERE:
 *  D1 HUE      — Soursop Green measures 2.48:1 on paper. `edPositive` is BANNED
 *                on this surface; positive reads through weight, rule and
 *                position only. (The contrast gap that hid this is closed in
 *                editorialFoundation.test.ts, which now measures edPositive on
 *                BOTH stocks.)
 *  D2 FURNITURE— the real date range, never a week number and never an issue
 *                number (E2's R1 continues to govern issue furniture).
 *  D3 SHARE    — no share affordance. WeeklyReportV3 has none; E5 does not add
 *                one. A share surface would be new and privacy-bearing.
 *  D4 SEAM     — a FOUR-way seam. Nothing is retired: V3, ReadinessInsightsV2
 *                and WeeklyReportLegacy all remain reachable branches.
 *  D5 SCOPE    — the analytics-failure asymmetry is NOT fixed here. It is a
 *                defect on the LIVE V3 surface and belongs to its own lane, so
 *                that the fix is not buried behind a flag that is false.
 *  D6 STALE    — per-source honesty (degraded row + em dashes). NO global stale
 *                banner; `lastRefreshStale` is deliberately NOT threaded here.
 *
 *  + PARITY (the E3/E4 P0 class), paper-stock ink resolution, honest absence,
 *    resolver reuse, Reduce Motion, demo isolation and DR-013 authority.
 *
 * Lives in components/__tests__/ deliberately: a components/editorial/__tests__/
 * directory matches NO vitest glob and would silently never run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';
import { featureDateRange } from '../editorial/weekly/editorialWeeklyPresentation';

const AOS = join(__dirname, '..', '..');
const ED_WEEKLY = join(AOS, 'components', 'editorial', 'weekly');
const read = (p: string) => readFileSync(p, 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const sources = () => walk(ED_WEEKLY).map((f) => ({ file: relative(AOS, f), src: strip(read(f)) }));
const screen = () => strip(read(join(ED_WEEKLY, 'EditorialWeeklyScreen.tsx')));
/** The screen WITHOUT its import block. Six "keeps X" locks were satisfiable
 *  by the import line alone — a migration could import a symbol and never use
 *  it and every one of them stayed green. */
const body = () => screen().replace(/^\s*import[\s\S]*?from\s+'[^']+';\s*$/gm, '');
const route = () => strip(read(join(AOS, 'app', 'weekly-report.tsx')));
const v3 = () => strip(read(join(AOS, 'components', 'insights', 'WeeklyReportV3.tsx')));

// ————————————————————————————————————————————————— flag + seam

describe('FLAG + FOUR-WAY SEAM (D4 — retire nothing)', () => {
  it('editorial_weekly_enabled is OFF in production and ON in the demo profile', () => {
    expect(DEFAULT_FLAGS.editorial_weekly_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.editorial_weekly_enabled).toBe(true);
  });

  it('the three earlier go-live flags are NOT touched by this lane', () => {
    expect(DEFAULT_FLAGS.editorial_home_enabled).toBe(false);
    expect(DEFAULT_FLAGS.editorial_moments_enabled).toBe(false);
    expect(DEFAULT_FLAGS.editorial_protocol_enabled).toBe(false);
  });

  it('the weekly flags that were already live keep their production values', () => {
    // E5 adds a branch ABOVE these; it does not change what ships today.
    expect(DEFAULT_FLAGS.weekly_v3_dashboard_enabled).toBe(true);
    expect(DEFAULT_FLAGS.spec_weekly_report).toBe(true);
    expect(DEFAULT_FLAGS.elite_weekly_report_enabled).toBe(false);
  });

  it('the route dispatches four presentations, editorial first and legacy last', () => {
    const src = route();
    // All four branches must still be REACHABLE — D4 retires nothing.
    for (const branch of [
      'editorial_weekly_enabled',
      'weekly_v3_dashboard_enabled',
      'spec_weekly_report',
    ]) {
      expect(src, `${branch} must gate a branch`).toContain(branch);
    }
    for (const component of [
      'EditorialWeeklyScreen',
      'WeeklyReportV3',
      'ReadinessInsightsV2',
      'WeeklyReportLegacy',
    ]) {
      expect(src, `${component} must remain a reachable branch`).toContain(component);
    }
    // Ordering: the editorial gate is consulted BEFORE the V3 gate, otherwise
    // V3's `true` default would shadow the new branch exactly the way it
    // already shadows spec_weekly_report.
    expect(src.indexOf('editorial_weekly_enabled')).toBeLessThan(
      src.indexOf('weekly_v3_dashboard_enabled'),
    );
  });
});

// ————————————————————————————————————————————————— D1 hue

describe('D1 — no positive hue on paper (Soursop is 2.48:1 there)', () => {
  it('the weekly layer never imports or references edPositive', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — edPositive is unreadable on paper stock`).not.toMatch(/edPositive/);
    }
  });

  it('the weekly layer never reaches for the af-layer green/amber status hues either', () => {
    // V3 paints its PA delta and next-focus banner with af.green. Those are the
    // exact carriers D1 removes; a paper screen must not re-import them.
    for (const { file, src } of sources()) {
      expect(src, `${file} — status hue must not carry meaning on paper`).not.toMatch(
        /\baf\.green\b|\baf\.amber\b/,
      );
    }
  });

  it('positive movement is still SAID and SHOWN, not merely coloured', () => {
    // Removing the hue must not remove the meaning. Both halves are pinned:
    // the spoken sentence AND the sighted direction glyph. Checking only the
    // a11y key names left the visible half completely unlocked.
    const src = body();
    expect(src).toMatch(/pa_row_a11y_moved/);
    expect(src).toMatch(/pa_row_a11y_current/);
    // The sighted carrier: a direction glyph chosen by the sign of the delta.
    expect(src, 'the direction must be visible without colour').toMatch(
      /paDelta <= 0 \? '▼' : '▲'/,
    );
    // …and the provisional qualifier must be folded INTO the grouped label,
    // because a grouped node's label replaces its children.
    expect(src).toMatch(/provisional \? t\('reports\.v3\.pa_provisional'\)/);
  });
});

// ————————————————————————————————————————————————— D2 furniture

describe('D2 — real date range; no week number, no issue number', () => {
  it('featureDateRange renders a real, uppercased range from the reported window', () => {
    expect(featureDateRange('2026-08-02', '2026-08-08', 'en-US')).toBe('AUG 2 – AUG 8');
  });

  it('spans months and years without inventing a label', () => {
    expect(featureDateRange('2026-08-30', '2026-09-05', 'en-US')).toBe('AUG 30 – SEP 5');
    expect(featureDateRange('2026-12-27', '2027-01-02', 'en-US')).toBe('DEC 27 – JAN 2');
  });

  it('returns null rather than a fabricated range when the window is unparseable', () => {
    expect(featureDateRange('not-a-date', '2026-08-08', 'en-US')).toBeNull();
    expect(featureDateRange('2026-08-02', '', 'en-US')).toBeNull();
  });

  it('the surface generates no issue number and no week number (R1 still governs)', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — R1 bans issue furniture`).not.toMatch(/ISSUE|issueNumber/);
      expect(src, `${file} — D2 chose the date range over a week number`).not.toMatch(
        /weekNumber|isoWeekNumber|WEEK \{|getWeekNumber/,
      );
    }
  });
});

// ————————————————————————————————————————————————— D3 share

describe('D3 — no share affordance', () => {
  it('the weekly editorial layer contains no share path', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — D3 adds no share surface`).not.toMatch(
        /openShareSheet|shareToSocial|buildShareItem|Share\b/,
      );
    }
  });

  it('and the live V3 surface it mirrors still has none either (nothing was moved)', () => {
    expect(v3()).not.toMatch(/openShareSheet/);
  });
});

// ————————————————————————————————————————————————— PARITY

describe('PARITY — no V3 behaviour is stranded (the E3/E4 P0 class)', () => {
  const s = () => screen();

  it('calls usePerformanceAge — the hook that WRITES the ledger snapshot series', () => {
    // This screen is not a pure reader. usePerformanceAge appends one
    // idempotent Performance Age event per day; for a member whose only visit
    // is this screen, dropping it stops the series accruing altogether.
    expect(body(), 'imported but never called is the same as dropped').toMatch(/usePerformanceAge\(\)/);
  });

  it('reads the command ledger — the sole feed for the Performance Age chart', () => {
    // The single most dangerous line to drop: NO test anywhere pinned this on
    // V3, so losing it leaves the whole suite green while the chart silently
    // degrades to its collecting posture.
    const src = body();
    expect(src).toMatch(/ledgerToPerformanceAgeSnapshots\(\s*getCommandLedgerState\(\)\.events\s*\)/);
  });

  it('keeps BOTH remaining sources and the single-fetch retry idiom', () => {
    const src = body();
    expect(src.match(/getAnalyticsSnapshot\(/g)?.length ?? 0).toBe(1);
    expect(src.match(/fetchJournalRollups\(/g)?.length ?? 0).toBe(1);
    // One loader, re-run by a nonce — never a second divergent fetch path.
    expect(src).toMatch(/reloadNonce/);
    expect(src).toMatch(/setReloadNonce\(\s*\(n\)\s*=>\s*n \+ 1\s*\)/);
  });

  it('keeps the loader dependency array that prevents a rebuild loop', () => {
    // `pa` is a fresh object each render; keying on its stable fields is what
    // stops the effect from re-running forever.
    expect(s()).toMatch(/\[fixture, pa\.result\.performanceAge, pa\.result\.status, reloadNonce\]/);
  });

  it('keeps BOTH guards on the load announcement (iOS-only, once-only)', () => {
    const src = s();
    expect(src).toMatch(/Platform\.OS !== 'ios'/);
    expect(src).toMatch(/wasLoadingRef/);
    expect(src).toMatch(/announceForAccessibility/);
  });

  it('keeps the loading state announceable as one progressbar, not many blocks', () => {
    const src = s();
    expect(src).toMatch(/accessibilityRole="progressbar"/);
    expect(src).toMatch(/accessibilityLiveRegion="polite"/);
    expect(src).toMatch(/loading_a11y/);
  });

  it('keeps the degraded row WITH a working retry (D6 per-source honesty)', () => {
    const src = s();
    expect(src).toMatch(/rollups_unavailable/);
    expect(src).toMatch(/reports\.v3\.retry/);
    // The retry must actually re-run the ONE loader. A control that renders
    // but bumps nothing is worse than no control: it promises a recovery the
    // screen never attempts.
    expect(src).toMatch(/onPress=\{\(\) => setReloadNonce\(\(n\) => n \+ 1\)\}/);
    // …and the row appears only when a source actually failed.
    expect(src).toMatch(/\{rollupsUnavailable \?/);
  });

  it('keeps the Performance Age disclaimer wherever the age is shown', () => {
    expect(body(), 'the disclosure must be RENDERED, not merely imported').toMatch(/\{PERFORMANCE_AGE_DISCLAIMER\}/);
  });

  it('keeps the fixture short-circuit so the gallery performs no I/O', () => {
    const src = s();
    expect(src).toMatch(/if \(fixture\) return;/);
    expect(src).toMatch(/fixture \? buildWeeklyV3Model\(fixture\) : null/);
  });

  it('keeps the guarded back idiom (Weekly is a PUSHED route, unlike Protocol)', () => {
    // EdReturn owns the guard; the screen must actually mount it.
    expect(body(), 'EdReturn must be MOUNTED, not just imported').toMatch(/<EdReturn/);
    const ret = strip(read(join(AOS, 'components', 'editorial', 'moments', 'EdReturn.tsx')));
    expect(ret).toMatch(/canGoBack\(\)\s*\?\s*router\.back\(\)\s*:\s*router\.replace/);
  });
});

// ————————————————————————————————————————————————— paper register

describe('PAPER — the first surface to turn the stock', () => {
  it('the screen owns a paper EdSurface', () => {
    expect(screen()).toMatch(/<EdSurface\s+stock="paper"/);
  });

  it('resolves ink for PAPER explicitly, never through useEdInk', () => {
    // E2's P1: useEdInk() reads the context ABOVE the surface the screen owns,
    // so a screen that mounts its own EdSurface must resolve ink directly.
    // On paper this inverts the E2 bug into ivory-on-paper — invisible.
    const src = screen();
    expect(src).toMatch(/edInkFor\('paper'\)/);
    expect(src, 'useEdInk() would resolve the ink of the surface ABOVE this one').not.toMatch(
      /useEdInk\(/,
    );
  });

  it('every weekly component that paints ink resolves it for paper, not black', () => {
    for (const { file, src } of sources()) {
      if (!/edInkFor\(/.test(src)) continue;
      expect(src, `${file} — this screen's stock is paper`).not.toMatch(/edInkFor\('black'\)/);
    }
  });

  it('overrides the app-wide LIGHT status bar, which is illegible on paper', () => {
    // app/_layout.tsx sets <StatusBar style="light" /> globally. Correct on the
    // black stock; on paper the system glyphs land at ~1.3:1.
    const src = body();
    expect(src.match(/<StatusBar style="dark" \/>/g)?.length ?? 0).toBe(2);
  });

  it('the paper background comes from the token, never a literal', () => {
    expect(screen()).toMatch(/edStock\.paper/);
  });

  it('restates the stock on the AFScreen shell, which paints af.canvas over it', () => {
    // THE E5 P0. AFScreen unconditionally paints `af.canvas` (#0D0D0D) on its
    // own root View (components/ui/AFScreen.tsx:46,60). Nested inside a paper
    // EdSurface it covers the entire sheet, and paper ink (#1A1815) on #0D0D0D
    // is ~1.1:1 — the whole Feature renders black with invisible text. The
    // shell must therefore receive the stock explicitly via `style`, which
    // AFScreen applies AFTER its own background.
    const src = screen();
    expect(src).toMatch(/<AFScreen[^>]*\sstyle=\{styles\.canvas\}/);
    expect(src).toMatch(/canvas: \{ backgroundColor: edStock\.paper \}/);
    // Both branches — the loading shell renders AFScreen too.
    expect(src.match(/<AFScreen/g)?.length ?? 0).toBe(
      src.match(/style=\{styles\.canvas\}/g)?.length ?? 0,
    );
  });

  it('mounts no af-layer component built for the dark canvas', () => {
    // AFInlineErrorRow (af.surface #141420) and WeeklyReportSkeleton (af.*
    // shimmer) are dark-canvas components; on paper they land as dark blocks
    // in the middle of the sheet. The spec's own anatomy asks for the
    // couldn't-load line as "editorial matter-of-fact body" instead.
    for (const { file, src } of sources()) {
      expect(src, `${file} — dark-canvas component on paper stock`).not.toMatch(
        /AFInlineErrorRow|WeeklyReportSkeleton|AFCard|AFTopBar/,
      );
    }
  });

  it('the retry control meets the interactive target floor and is labelled', () => {
    const src = screen();
    expect(src).toMatch(/retryTarget/);
    expect(src).toMatch(/minHeight: edRhythm\.minTarget/);
    expect(src).toMatch(/accessibilityRole="button"/);
  });

  it('bars grow from the baseline — the spacer is rendered BEFORE the fill', () => {
    // In a column the fill must come SECOND, or every bar hangs from the top
    // and the chart reads inverted. This pins the ORDER, not the presence.
    //
    // Matched against whitespace-collapsed source: the real JSX is indented
    // ~24 columns deep, so a character-windowed regex over the raw text
    // silently matches nothing and the assertion passes vacuously.
    const flat = screen().replace(/\s+/g, ' ');

    const paTrack = /styles\.paBarTrack.*?<\/View>/.exec(flat)?.[0] ?? '';
    expect(paTrack, 'PA bar track must be found at all').not.toBe('');
    expect(paTrack, 'PA bar: spacer must precede the fill').toMatch(
      /1 - paAxis\.fractions\[i\]!.*?styles\.paBar/,
    );

    const tl = /styles\.timelineTrack.*?<\/View>/.exec(flat)?.[0] ?? '';
    expect(tl, 'timeline track must be found at all').not.toBe('');
    expect(tl, 'timeline: spacer must precede the fill').toMatch(
      /1 - Math\.min\(100, d\.score\).*?styles\.timelineFill/,
    );
    // And a HIGH score must produce a TALL bar: the fill takes the score
    // fraction itself, never its complement.
    expect(tl, 'the fill must take the score, not 1 − score').toMatch(
      /styles\.timelineFill.*?flex: Math\.max\(0\.1, Math\.min\(100, d\.score\) \/ 100\)/,
    );
  });
});

// ————————————————————————————————————————————————— honest absence

describe('HONEST ABSENCE — a dash is a claim about our data, a zero about the member', () => {
  it('rollup-fed pull numbers become NULL — not 0 — when the fetch failed', () => {
    const src = screen();
    // The distinction is the whole point: a 0 is a claim about the member's
    // week, null is a claim about our data. EdNumber turns null into the em
    // dash and speaks "no reading" (locked in editorialFoundation.test.ts).
    expect(src).toMatch(/daysTrackedValue = rollupsUnavailable \? null : model\.daysTracked/);
    expect(src).toMatch(/weeklyWinsValue = rollupsUnavailable \? null : model\.weeklyWins/);
    // A measured zero must NOT be laundered into an absence.
    expect(src, 'a measured zero is data and must print as 0').not.toMatch(
      /model\.(daysTracked|weeklyWins) === 0 \? null/,
    );
  });

  it('the composite hydration-days line has no denominator to fake', () => {
    // `3/7` cannot be expressed as a single EdNumber, so this one value keeps
    // the literal dash — and takes it when the fetch failed OR when there is
    // genuinely no tracked day to divide by.
    expect(screen()).toMatch(/rollupsUnavailable \|\| model\.daysTracked === 0\s*\?\s*'—'/);
  });

  it('recovery keeps its collecting posture — it never earns a number', () => {
    // Scoped to the recovery block. The unscoped form matched
    // `reports.v3.collecting` in the HABIT block and passed even with the
    // recovery row deleted outright.
    const flat = screen().replace(/\s+/g, ' ');
    const block = /editorial-weekly-recovery[\s\S]*?<\/View>/.exec(flat)?.[0] ?? '';
    expect(block, 'the recovery row must exist').not.toBe('');
    expect(block).toMatch(/reports\.v3\.tile_recovery/);
    expect(block).toMatch(/reports\.v3\.collecting/);
    expect(block, 'recovery has no persisted series anywhere in the app').not.toMatch(/\{[^}]*\bmodel\.[a-z]/i);
  });

  it('the Performance Age block is omitted entirely without a real current age', () => {
    expect(screen()).toMatch(/currentAge != null/);
  });

  it('bars render only with a real ≥2-point series AND a resolved axis', () => {
    const src = screen();
    expect(src).toMatch(/bars\.length >= 2 && paAxis/);
    expect(src).toMatch(/pa_collecting/);
  });

  it('the timeline is omitted rather than drawn empty', () => {
    expect(screen()).toMatch(/timeline\.length > 0/);
  });

  it('the timeline speaks a formatted date, never a raw ISO string', () => {
    // `d.date` is "2026-08-04"; spoken verbatim a screen reader reads the
    // digits where a sighted reader sees "TUE".
    const src = body();
    expect(src).toMatch(/date: featureShortDate\(d\.date/);
    expect(src, 'the raw ISO string must not be the spoken value').not.toMatch(
      /date: d\.date,/,
    );
  });
});

// ————————————————————————————————————————————————— resolver reuse

describe('RESOLVER REUSE — the honest-data rules stay enforced, never re-derived', () => {
  it('the model comes from buildWeeklyV3Model, not a second weekly model', () => {
    const src = screen();
    expect(src).toMatch(/buildWeeklyV3Model/);
    expect(src, 'no parallel weekly model may exist').not.toMatch(/function build\w*Weekly\w*Model/);
  });

  it('the bar axis comes from performanceAgeBarAxis, not a local min/max', () => {
    const src = screen();
    expect(src).toMatch(/performanceAgeBarAxis/);
    expect(src, 'the ≥10-year domain is what stops a 1-year week looking dramatic').not.toMatch(
      /Math\.min\(\.\.\.|Math\.max\(\.\.\./,
    );
  });

  it('sections are read through getWeeklyReportSection', () => {
    expect(screen()).toMatch(/getWeeklyReportSection/);
  });

  it('the presentation module adds furniture only — it computes no metric', () => {
    const src = strip(read(join(ED_WEEKLY, 'editorialWeeklyPresentation.ts')));
    for (const banned of [/\bscore\b/i, /\bpercent/i, /\bratio\b/i, /\baverage\b/i]) {
      expect(src, 'E5 introduces no derived metric').not.toMatch(banned);
    }
  });
});

// ————————————————————————————————————————————————— D5 / D6 scope guards

describe('D5 + D6 — the scope boundary holds', () => {
  it('D5 — E5 adds no second analytics path and does not diverge from V3', () => {
    // D5 is a SCOPE decision, not an invariant: the analytics-failure
    // asymmetry is a defect on the live surface and the founder authorized a
    // separate lane to fix it. This lock therefore pins what E5 owes —
    // exactly one analytics read, no competing fetch path — and deliberately
    // does NOT pin V3's current shape, which would fail that very lane.
    const src = screen();
    expect(src.match(/getAnalyticsSnapshot\(/g)?.length ?? 0).toBe(1);
    expect(src, 'no second, divergent loader').not.toMatch(/useEffect\([\s\S]*getAnalyticsSnapshot[\s\S]*getAnalyticsSnapshot/);
  });

  it('D6 — no global stale banner; lastRefreshStale is not threaded here', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — D6 chose per-source honesty`).not.toMatch(/lastRefreshStale/);
      expect(src, `${file} — no second freshness system`).not.toMatch(/stale_notice/);
    }
  });

  it('E5 changes no scoring, threshold or provider behaviour', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file}`).not.toMatch(/scoringEngine|statusColor|hydroStateModel/);
    }
  });
});

// ————————————————————————————————————————————————— authority

describe('COMMAND AUTHORITY — the Feature reports, it never prescribes (DR-013)', () => {
  it('renders no dose, volume or unit of its own', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — Moments/Weekly may not author a hydration action`).not.toMatch(
        /\boz\b|\bml\b|\bmL\b|ozTarget|ozConsumed/,
      );
    }
  });

  it('the one instruction it carries is the canonical next-week focus, not its own', () => {
    const src = screen();
    expect(src).toMatch(/nextWeekFocus|next_focus/);
    expect(src).toMatch(/sectionSummary/);
  });
});

// ————————————————————————————————————————————————— motion + isolation

describe('REDUCE MOTION + DEMO ISOLATION', () => {
  it('the stock turn and settle run through the shared motion hooks', () => {
    const src = screen();
    expect(src).toMatch(/useEdSettle\(\)/);
  });

  it('no weekly component hand-rolls an Animated timing outside the shared hooks', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — motion belongs to instruments.tsx`).not.toMatch(
        /Animated\.(timing|spring|loop)\(/,
      );
    }
  });

  it('production code never imports the demo layer', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file}`).not.toMatch(/from '@\/demo|from '\.\.\/\.\.\/\.\.\/demo/);
    }
  });
});

// ————————————————————————————————————————————————— a11y

describe('A11Y — the standing rules carry forward onto paper', () => {
  it('the feature statement is a header landmark', () => {
    expect(screen()).toMatch(/accessibilityRole="header"/);
  });

  it('pull numbers delegate their a11y group to EdNumber rather than nesting a second one', () => {
    // EdNumber already composes an accessible group (value + caption, plus the
    // "no reading" label when unmeasured). Wrapping it in a SECOND accessible
    // node would flatten that group and swallow the caption, so the layout
    // wrapper must stay non-accessible and must pass the unit through as the
    // caption EdNumber speaks.
    const src = strip(read(join(ED_WEEKLY, 'EdFeatureNumbers.tsx')));
    expect(src).toMatch(/<EdNumber[\s\S]*caption=\{n\.label\}/);
    expect(src, 'a nested accessible node would flatten EdNumber’s group').not.toMatch(
      /<View[^>]*\saccessible\b/,
    );
  });

  it('every screen-level grouped row still carries its own composed label', () => {
    const src = screen();
    // Each evidence row is label + value + caption in sibling Text nodes;
    // ungrouped, VoiceOver reads three unrelated fragments.
    // Named, not counted: a >= threshold below the real number lets groups be
    // deleted silently. Each row that speaks as a unit is pinned by its testID.
    for (const id of [
      'editorial-weekly-recovery',
      'editorial-weekly-hydration-days',
      'editorial-weekly-habit',
      'editorial-weekly-timeline-',
    ]) {
      expect(src, `${id} must exist`).toContain(id);
    }
    expect(src.match(/accessibilityLabel=/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it('no weekly component hand-rolls a font cap or a raw size', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — only the house boundary may cap scaling`).not.toMatch(
        /maxFontSizeMultiplier=\{[0-9]/,
      );
      if (/\.tsx$/.test(file)) {
        expect(src, `${file} — sizes come from edType`).not.toMatch(/fontSize\s*:/);
        expect(src, `${file} — colors come from editorialTokens`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      }
    }
  });
});
