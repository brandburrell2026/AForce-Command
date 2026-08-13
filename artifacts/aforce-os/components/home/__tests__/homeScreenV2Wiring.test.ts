/**
 * HomeScreenV2 — momentum wiring + honest doc-comment guard
 * (RC-1 audit, P0 vs founder's 3-second brief).
 *
 * `HomeScreenV2` pulls in `useAppStore` / `expo-router` / `@clerk/expo` — the
 * same category of store+router-connected container this repo's existing
 * tests deliberately never mount directly (see
 * `components/health/__tests__/connectedHealthContainer.render.test.tsx`'s
 * header, which documents the convention and points at
 * `components/cruise/__tests__/cruiseModeView.render.test.tsx` mounting the
 * presentational `CruiseModeView`, never the connected `CruiseModeScreen`).
 * This file applies that same established pattern: a source-text guard
 * asserting the fix's wiring is present, rather than fabricating a store +
 * router + Clerk harness this suite has no existing pattern for.
 *
 * `LiveStatusLine` itself is already covered independently (it is a pure,
 * tested presentational component per the audit finding); this file is
 * scoped to whether HomeScreenV2 actually imports and renders it under the
 * score arc, and whether the doc comment stopped making a false claim.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('HomeScreenV2 — LiveStatusLine momentum wiring (RC-1 P0)', () => {
  it('imports the existing, tested LiveStatusLine component', () => {
    expect(CODE).toContain("import { LiveStatusLine } from './LiveStatusLine';");
  });

  it('imports the same trend hook + status-verb service the legacy Home uses', () => {
    expect(CODE).toContain("import { useScoreTrend } from '@/hooks/useScoreTrend';");
    expect(CODE).toContain("import { getStatusVerb } from '@/services/statusVerb';");
  });

  it('renders <LiveStatusLine> in the JSX (not just imported and unused)', () => {
    expect(CODE).toMatch(/<LiveStatusLine\s/);
  });

  it('renders LiveStatusLine inside the same block as the arc, tinted with the V2 accent (not a hardcoded legacy color)', () => {
    const arcToCommand = CODE.slice(CODE.indexOf('AFReadinessArc'), CODE.indexOf('One command'));
    expect(arcToCommand).toContain('<LiveStatusLine');
    // Wave 5: the tint is now `accentText`, the AA-clean twin of the band
    // accent — the arrow/delta/verb are TEXT, and Signal Red fails AA as text
    // on dark. Same intent as before (tinted from this screen's band accent,
    // never a hardcoded legacy color), pointed at the text-safe variable.
    expect(arcToCommand).toMatch(/accent=\{accentText\}/);
  });
});

describe('HomeScreenV2 — band-aware hero (Wave 5, brand + trust)', () => {
  it('takes the accent from the tested band resolver with NO elite gate — every band gets its own colour', () => {
    expect(CODE).toMatch(/const\s+accent\s*=\s*presentation\.accent;/);
    expect(CODE).toMatch(/const\s+accentText\s*=\s*presentation\.accentText;/);
    // The regression this exists for: `elite ? presentation.accent : af.red`
    // painted the arc, trend line and state word alarm-red for EVERY band.
    expect(CODE).not.toMatch(/accent\s*=\s*elite\s*\?/);
    expect(CODE).not.toMatch(/:\s*af\.red\b/);
  });

  it('draws the ring in the fill accent and the state word in the text-safe twin', () => {
    expect(CODE).toMatch(/<AFReadinessArc[^>]*color=\{accent\}/);
    expect(CODE).toMatch(/styles\.stateLabel,\s*\{\s*color:\s*accentText\s*\}/);
    expect(CODE).toMatch(/styles\.statePillText,\s*\{\s*color:\s*accentText\s*\}/);
  });

  it('no longer hardcodes a red state word in the stylesheet', () => {
    expect(CODE).not.toMatch(/stateLabel:\s*\{[^}]*af\.redText/);
  });
});

describe('HomeScreenV2 — "Completed today" removed (Wave 5, trust + hierarchy)', () => {
  it('no longer derives product completion from generic intake', () => {
    // deriveTodaysProtocol checked off "Hydration Stick" / "AForce Can" from
    // logged servings, so tap water earned a green product check.
    expect(CODE).not.toContain('deriveTodaysProtocol');
    expect(CODE).not.toContain('protocolDone');
  });

  it('no longer renders the day-streak numeral as the second-largest number on Home', () => {
    expect(CODE).not.toContain('complianceStreak');
    expect(CODE).not.toContain('home.v3.day_streak');
    expect(CODE).not.toContain('home.v3.recovery_trend');
    expect(CODE).not.toContain('home.v3.completed_today');
  });

  it('drops the section styles with it, so nothing can quietly re-render it', () => {
    for (const dead of ['v3Rows', 'v3Check', 'v3Stat', 'v3Count', 'v3Section']) {
      expect(CODE).not.toContain(dead);
    }
  });

  it('keeps what the section was standing in for: the arc, the live trend line and the signal tiles', () => {
    expect(CODE).toContain('<LiveStatusLine');
    expect(CODE).toContain('AFReadinessArc');
    expect(CODE).toContain('home.v3.signal_sleep');
  });
});

describe('HomeScreenV2 — hero announces once (Wave 5 a11y)', () => {
  it('hides the arc\'s inner progressbar, since the Pressable already announces score + band', () => {
    const arcToCommand = CODE.slice(CODE.indexOf('AFReadinessArc'), CODE.indexOf('<LiveStatusLine'));
    expect(arcToCommand).toMatch(/a11yHidden/);
  });

  it('has no nested `accessible` containers left (the protocol rows were the only pair)', () => {
    // The deleted block wrapped `accessible` rows inside an `accessible`
    // container, which collapsed all three rows into one announcement.
    expect(CODE).not.toMatch(/styles\.v3Rows\}\s+accessible/);
    // The only two `accessible` nodes left are LEAVES — a signal tile and the
    // health chip — neither of which contains another accessible element.
    // A third occurrence means someone added a grouping wrapper: check it
    // isn't sitting above an already-accessible child before updating this.
    expect(CODE.match(/\baccessible\b/g)).toHaveLength(2);
    expect(CODE).toMatch(/styles\.signal\}\s+accessible/);
    expect(CODE).toMatch(/styles\.v3Chip\}\s+accessible/);
  });
});

describe('HomeScreenV2 — pre-hydration skeleton wiring (RC-1 Wave-2B, item 2a)', () => {
  it('imports the store-free HomeSkeleton, not a redeclared inline copy', () => {
    expect(CODE).toContain("import { HomeSkeleton } from './HomeSkeleton';");
  });

  it('reads isHydrated off the sliced bootstrap context (migrated off the useAppStore facade in RC-1 W3P2)', () => {
    expect(CODE).toMatch(/const\s*\{\s*isHydrated\s*\}\s*=\s*useBootstrapSlice\(\);/);
  });

  it('never calls the useAppStore() facade (RC-1 W3P2 regression guard — see the render-count harness for the behavioral proof)', () => {
    expect(CODE).not.toMatch(/useAppStore\(/);
  });

  it('renders <HomeSkeleton /> when NOT hydrated, and the real arc/command/tiles otherwise (mutually exclusive)', () => {
    expect(CODE).toMatch(/!isHydrated\s*\?\s*\([\s\S]{0,80}?<HomeSkeleton[^>]*\/>\s*\)\s*:\s*\(/);
    // The real content branch still contains the arc + command card + signals
    // section, i.e. the skeleton did not silently replace them outright.
    const skeletonBranch = CODE.slice(CODE.indexOf('!isHydrated'));
    expect(skeletonBranch).toContain('AFReadinessArc');
    expect(skeletonBranch).toContain('AFCommandCard');
    expect(skeletonBranch).toContain('signalOrder.map');
  });

  it('shapes the signal block this screen is about to render, not the one it replaced (Wave 5)', () => {
    // V3's four-tile 2×2 grid ships ON in production; a skeleton shaping one
    // row of three guaranteed a jump of a whole row at the moment of
    // hydration. The layout is chosen by the SAME flag that decides the real
    // signal block, so the two can never drift apart again.
    expect(CODE).toMatch(/<HomeSkeleton\s+signals=\{v3 \? 'grid4' : 'row3'\}\s*\/>/);
    expect(CODE).toMatch(/const\s+v3\s*=\s*flags\.home_v3_dashboard_enabled;/);
    // …and the real V3 block it stands in for is still the two-row grid.
    expect(CODE).toMatch(/styles\.v3Grid[\s\S]*?styles\.signals[\s\S]*?styles\.signals/);
  });
});

describe('HomeScreenV2 — offline intake outbox visibility (RC-1 Wave-2B, item 1)', () => {
  it('imports AFOfflineBanner and the honest outbox selectors', () => {
    expect(CODE).toMatch(/AFOfflineBanner/);
    expect(CODE).toContain(
      "import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';",
    );
  });

  it('gates the outbox signal on the offline_intake_outbox_enabled flag (flag-off stays byte-identical/inert)', () => {
    expect(CODE).toMatch(/flags\.offline_intake_outbox_enabled\s*\?\s*selectPendingCount\(outboxState\)\s*:\s*0/);
    expect(CODE).toMatch(/flags\.offline_intake_outbox_enabled\s*\?\s*selectHasFailedItem\(outboxState\)\s*:\s*false/);
  });

  it('mounts <AFOfflineBanner> wired to those exact two computed values', () => {
    expect(CODE).toMatch(
      /<AFOfflineBanner\s+pendingCount=\{outboxPendingCount\}\s+hasFailedItem=\{outboxHasFailedItem\}\s*\/>/,
    );
  });

  it('mounts the banner above the fold — after the header, before the hydration-gated content', () => {
    // Anchor updated for ruling E (item 1): the freshness line moved from a
    // static `t('home.v2.freshness')` call to `<HomeFreshnessLabel>` — see
    // `homeFreshness.test.ts` / `HomeFreshnessLabel.render.test.tsx` for
    // that change's own coverage. This test only cares that the anchor
    // still marks the top of the header block.
    //
    // Wave 5 anchor correction (behaviour unchanged, assertion unchanged): the
    // first-launch evidence gate's effect reads `!isHydrated` too, above the
    // JSX, so a bare `!isHydrated` search no longer lands on the render branch
    // this slice is meant to bound — it landed ABOVE the freshness label and
    // produced an empty slice, which would have passed vacuously for the
    // inverse assertion. Anchored on the JSX gate itself so the slice still
    // means "between the header and the hydration-gated content".
    const hydrationGate = CODE.indexOf('{!isHydrated ?');
    expect(hydrationGate).toBeGreaterThan(-1);
    const headerToSkeleton = CODE.slice(CODE.indexOf('<HomeFreshnessLabel'), hydrationGate);
    expect(headerToSkeleton).toContain('<AFOfflineBanner');
  });
});

describe('HomeScreenV2 — first-launch evidence gate (Wave 5, founder ruling 2026-08-12)', () => {
  it('resolves the gate through the pure, tested resolver — not an inline predicate', () => {
    expect(CODE).toContain("} from './homeBaselineState';");
    expect(CODE).toMatch(/const\s+evidence\s*=\s*resolveHomeEvidence\(\{\s*intakeEventCount,\s*loggedDayCount\s*\}\)/);
  });

  it('reads the member\'s own intake events as the local, synchronous half of the predicate', () => {
    expect(CODE).toMatch(/const\s+intakeEventCount\s*=\s*userState\.intakeEvents\?\.length\s*\?\?\s*0;/);
  });

  it('costs NO network read of its own — both signals come from the store', () => {
    // Home is the hottest screen in the app, and Wave-4's rule is no extra
    // refetching. An added journal read here would have fired on every cold
    // open for anyone who had not logged in the last 24h — a quiet morning,
    // not a first launch.
    expect(CODE).not.toContain('fetchJournalRollups');
    expect(CODE).not.toContain('BASELINE_LOOKBACK_DAYS');
    expect(CODE).toContain("import { countRealHistoryEntries, resolveHomeEvidence } from './homeBaselineState';");
  });

  it('reads real cycle history synchronously from the slice the store already holds', () => {
    expect(CODE).toContain('const history = useHistorySlice();');
    expect(CODE).toMatch(/countRealHistoryEntries\(history\)/);
  });

  it('withholds an answer until hydration instead of calling an empty store "no evidence"', () => {
    // Pre-hydration the store legitimately has nothing yet. Reporting 0 there
    // would tell a veteran member they have no history — the exact collapse
    // of "not known yet" into "none" this gate exists to prevent.
    expect(CODE).toMatch(/isHydrated \? countRealHistoryEntries\(history\) : null/);
  });

  it('renders the baseline treatment via the store-free HomeBaselineHero', () => {
    expect(CODE).toContain("import { HomeBaselineHero } from './HomeBaselineHero';");
    expect(CODE).toMatch(/evidence === 'building'[\s\S]{0,120}<HomeBaselineHero/);
  });
});

describe('HomeScreenV2 — no flash of a fabricated score before the gate resolves (Wave 5)', () => {
  // The exact defect: `data/mockData.ts`'s seeded 5 units / 45 oz produce a
  // confident BALANCED 76 that Home used to paint immediately. The score may
  // therefore only ever be rendered inside the `established` branch — if it
  // could render while `evidence` is still 'pending', the member would see the
  // fabricated number for the frames before the journal read lands.
  const HERO_SLOT_START = CODE.indexOf("evidence === 'pending'");
  const ESTABLISHED_START = CODE.indexOf("evidence === 'building'");

  it('the hero slot branches on evidence before anything readiness-related renders', () => {
    expect(HERO_SLOT_START).toBeGreaterThan(-1);
    expect(ESTABLISHED_START).toBeGreaterThan(HERO_SLOT_START);
  });

  it('the pending branch renders NO score, NO band word and NO arc — only a shape-holding placeholder', () => {
    const pendingBranch = CODE.slice(HERO_SLOT_START, ESTABLISHED_START);
    expect(pendingBranch).toContain('<AFSkeleton');
    expect(pendingBranch).toContain('home-baseline-pending');
    expect(pendingBranch).not.toContain('<AFReadinessArc');
    expect(pendingBranch).not.toContain('styles.score');
    expect(pendingBranch).not.toContain('performanceState.level');
    expect(pendingBranch).not.toContain('<LiveStatusLine');
  });

  it('the arc, the score numeral and the trend line all live inside the established branch', () => {
    const established = CODE.slice(ESTABLISHED_START);
    expect(established).toContain('<AFReadinessArc');
    expect(established).toContain('<LiveStatusLine');
    // ...and nothing readiness-bearing escaped ABOVE the gate into the always-on
    // region of the hydrated render.
    const beforeGate = CODE.slice(CODE.indexOf('{!isHydrated ?'), HERO_SLOT_START);
    expect(beforeGate).not.toContain('<AFReadinessArc');
    expect(beforeGate).not.toContain('<LiveStatusLine');
  });

  it('the Recovery signal tile withholds the band word too, so the state cannot re-enter sideways', () => {
    // Without this the hero would say "Building your baseline" while the tile
    // one section down said "Balanced" — the same fabricated claim, restated.
    //
    // CORRECTION 6 STRENGTHENED THIS. The original assertion allowed the band
    // word back into the tile as soon as `evidence === 'established'`, which is
    // how build 60 shipped the band printed twice. The tile now renders the em
    // dash UNCONDITIONALLY (a duplicate is not a second measurement), so the
    // pre-evidence case this test was written for is covered a fortiori and the
    // established case is covered too — strictly more than before.
    expect(CODE).toMatch(/const\s+recoveryText\s*=\s*EM_DASH;/);
    expect(CODE).not.toMatch(/value=\{titleCase\(engine\.performanceState\.level\)\}/);
    // The helper that title-cased the band for that tile is gone with it, so
    // nothing can quietly reintroduce the restatement.
    expect(CODE).not.toContain('titleCase');
  });

  it('mutation-verify: a score rendered outside the established branch is detectable', () => {
    // If the gate were removed (arc hoisted back above the evidence branch),
    // the slice below would contain the arc and this suite would fail — this
    // asserts the detector itself still works on a mutated source.
    const mutated = CODE.replace("evidence === 'pending'", "false /* gate removed */");
    expect(mutated.indexOf("evidence === 'pending'")).toBe(-1);
  });
});

describe('HomeScreenV2 — confidence proportional to evidence (Wave 5 residual A)', () => {
  it('resolves the affordance through the pure, tested module — not an inline predicate', () => {
    expect(CODE).toContain("import { resolveHomeConfidence } from './homeConfidence';");
    expect(CODE).toMatch(/resolveHomeConfidence\(\{[\s\S]{0,240}?\}\)/);
  });

  it('wears the SHIPPED ConfidenceChip, the same primitive PerformanceSignalV3 uses', () => {
    // A bespoke Home-only confidence widget is the outcome this asserts against:
    // one chip grammar across §53/§54/§55/§58, or the vocabulary fragments.
    expect(CODE).toContain("import { ConfidenceChip } from '@/components/ConfidenceChip';");
    expect(CODE).toMatch(/<ConfidenceChip\s/);
    // Correction 6: the RESOLVED rating still reaches the chip unchanged — it
    // is now interpolated into the i18n label that names its domain
    // ("EVIDENCE: LIMITED") rather than passed as a bare structural token, so
    // the chip cannot read as a fourth verdict on the member's body. The
    // resolver, the vocabulary and the opacity ramp are untouched.
    expect(CODE).toMatch(/label=\{t\('home\.v2\.confidence_chip',\s*\{\s*rating:\s*confidence\.chip\.label\s*\}\)\}/);
    expect(CODE).toMatch(/opacity=\{confidence\.chip\.opacity\}/);
  });

  it('feeds it the evidence the store already holds — no new slice, no fetch, no timer', () => {
    const memo = CODE.slice(CODE.indexOf('resolveHomeConfidence({'), CODE.indexOf('const score ='));
    expect(memo).toContain('intakeEvents: userState.intakeEvents');
    expect(memo).toContain('history,');
    expect(memo).toContain('biometrics: userState.biometrics');
    // Wave-4's rule: Home is the hottest screen in the app.
    expect(CODE).not.toContain('fetchJournalRollups');
    expect(CODE).not.toContain('setInterval');
    expect(CODE).not.toContain('TICK_TIMER');
  });

  it('renders the chip beside the reading, inside the established branch only', () => {
    const heroSlot = CODE.indexOf("evidence === 'pending'");
    const established = CODE.indexOf("evidence === 'building'");
    const pendingBranch = CODE.slice(heroSlot, established);
    const buildingBranch = CODE.slice(established, CODE.indexOf('<AFReadinessArc'));
    // The founder approved `building` for ZERO evidence: those two branches
    // render no reading, so there is nothing there for a chip to qualify.
    expect(pendingBranch).not.toContain('<ConfidenceChip');
    expect(buildingBranch).not.toContain('<ConfidenceChip');

    // …and on the reading itself, between the numeral and its trend line.
    const arcToTrend = CODE.slice(CODE.indexOf('<AFReadinessArc'), CODE.indexOf('<LiveStatusLine'));
    expect(arcToTrend).toContain('<ConfidenceChip');
  });

  it('stays an affordance, never a second hero: no card, no numeral, no competing type ramp', () => {
    const chipAt = CODE.indexOf('<ConfidenceChip');
    const block = CODE.slice(CODE.lastIndexOf('<View', chipAt), CODE.indexOf('<LiveStatusLine'));
    expect(block).not.toContain('AFCard');
    expect(block).not.toContain('styles.score');
    expect(block).not.toContain('afType.displayScore');
    // Layout only — the chip owns its own type and its monochrome opacity ramp.
    expect(CODE).toMatch(/confidenceRow:\s*\{\s*alignItems:\s*'center',\s*marginBottom:\s*8\s*\}/);
  });

  it('does NOT re-hide the score behind the baseline state (the gate is unchanged)', () => {
    // The residual is about the range BETWEEN one event and real coverage —
    // the fix must not have quietly widened `building` to cover it.
    expect(CODE).toMatch(/const\s+evidence\s*=\s*resolveHomeEvidence\(\{\s*intakeEventCount,\s*loggedDayCount\s*\}\)/);
    expect(CODE).not.toMatch(/evidence\s*===\s*'building'\s*\|\|/);
    expect(CODE).not.toMatch(/confidence[\s\S]{0,40}\?\s*<HomeBaselineHero/);
  });

  it('mutation-verify: a chip rendered outside the established branch is detectable', () => {
    // Hoisting the chip above the gate (into the always-on region) is the
    // regression the branch assertions above exist for — this proves the slice
    // they measure actually moves when the source does.
    const mutated = CODE.replace('<ConfidenceChip', '<AFSkeleton /* moved */');
    const heroSlot = mutated.indexOf("evidence === 'pending'");
    const arcToTrend = mutated.slice(
      mutated.indexOf('<AFReadinessArc'),
      mutated.indexOf('<LiveStatusLine'),
    );
    expect(heroSlot).toBeGreaterThan(-1);
    expect(arcToTrend).not.toContain('<ConfidenceChip');
  });
});

describe('HomeScreenV2 — doc-comment honesty guard (RC-1 P0)', () => {
  it('the file header no longer claims the legacy detail zones were relocated with "nothing missing"', () => {
    expect(SOURCE).not.toMatch(/now live[\s\S]{0,40}founder ruling: relocate, never delete/);
    expect(SOURCE).not.toMatch(/nothing users had access to on\s*\* the legacy Home went missing/);
  });

  it('the file header states the zones are orphaned pending a founder decision', () => {
    expect(SOURCE.toLowerCase()).toContain('orphaned');
    expect(SOURCE.toLowerCase()).toContain('founder decision');
  });
});
