/**
 * EDITORIAL TRUTH & PARITY LAWS (P1/P2).
 *
 * Activating the five Editorial flags swaps whole screens. These laws pin the
 * four defects that audit found, each of which would have reached a partner:
 *
 *   SCAN     — the swap DELETED two capabilities app-wide. HydrationScanScreenV2
 *              holds the app's ONLY navigation to /urine-check and its ONLY
 *              mount of AddDrinkModal; the editorial screen mounted neither, so
 *              turning the flag on removed the Urine Hydration Check and manual
 *              drink logging entirely. It also rendered the service's failure
 *              line "Try manual search or rescan." with no manual search.
 *   PROTOCOL — the store seeds a synthetic baseline entry with a manufactured
 *              yesterday timestamp; both protocol screens listed it unfiltered
 *              under "Recent activity" as though the member had done it.
 *   WEEKLY   — the masthead named the LAST COMPLETED week while days-tracked and
 *              hydration-days were computed over the trailing 7 days ENDING
 *              TODAY: two populations under one label.
 *   MOMENTS  — "Today has 1 moments", and a static per-type string claiming
 *              "Your hydration and recovery patterns suggest…" to a member whose
 *              patterns AForce has never seen.
 *
 * These are SOURCE + DATA laws rather than render tests because `app/**` and
 * `components/editorial/**` match no vitest include glob — a law beside those
 * files would silently never run. `components/__tests__/**` IS matched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(AOS, ...p), 'utf8');

const EDITORIAL_SCAN = read('components', 'editorial', 'scan', 'EditorialScanScreen.tsx');
const LEGACY_SCAN = read('components', 'scan', 'HydrationScanScreenV2.tsx');
const EDITORIAL_PROTOCOL = read('components', 'editorial', 'protocol', 'EditorialProtocolScreen.tsx');
const LEGACY_PROTOCOL = read('components', 'protocol', 'ProtocolScreenV2.tsx');
const EDITORIAL_WEEKLY = read('components', 'editorial', 'weekly', 'EditorialWeeklyScreen.tsx');
const EDITORIAL_MOMENTS = read('components', 'editorial', 'moments', 'EditorialMomentsScreen.tsx');
const FLAGS = read('featureFlags', 'flags.ts');
const SENSORS_ROUTE = read('app', 'sensors.tsx');
const EN = JSON.parse(read('locales', 'en.json')) as Record<string, never>;

describe('SCAN PARITY — the swap may change presentation, never remove capability', () => {
  it('the editorial screen reaches /urine-check, which nothing else in the app does', () => {
    // Proven by the audit: HydrationScanScreenV2:943 was the ONLY router.push
    // to /urine-check anywhere. If the editorial screen does not offer it, the
    // flag deletes the Urine Hydration Check from the product.
    // Asserted on the NAVIGATION CALL, not the bare path. A first draft used
    // toContain('/urine-check') and passed against a mutation that deleted the
    // router.push — because the path still appeared in a source comment.
    const NAV = /router\.push\(\s*'\/urine-check'/;
    expect(LEGACY_SCAN).toMatch(NAV);
    expect(EDITORIAL_SCAN, 'editorial Scan must NAVIGATE to /urine-check').toMatch(NAV);
  });

  it('the editorial screen MOUNTS AddDrinkModal, the only manual-logging path', () => {
    // AddDrinkModal is the sole way to log a drink that is neither water nor a
    // scanned/AForce product. One mount existed, on the legacy screen.
    // Word-bounded: /<AddDrinkModal/ also matches <AddDrinkModalREMOVED, so a
    // rename-to-disable mutation slipped straight through the first draft.
    const MOUNT = /<AddDrinkModal[\s/>]/;
    expect(LEGACY_SCAN).toMatch(MOUNT);
    expect(EDITORIAL_SCAN, 'editorial Scan must mount AddDrinkModal').toMatch(MOUNT);
  });

  it('and actually opens it — a mount with no trigger is still a deleted feature', () => {
    // The difference between "rendered" and "reachable". Without a setter call
    // the modal can never become visible.
    expect(EDITORIAL_SCAN).toMatch(/setAddDrinkOpen\(true\)/);
  });

  it('THE FAILURE COPY IS NOT A DEAD PROMISE', () => {
    // hydrationScanService's failure line offers "manual search". AddDrinkModal
    // IS that search (it carries its own query field), so the sentence is only
    // honest while the modal is reachable FROM THE FAILURE STATE.
    const service = read('services', 'hydrationScanService.ts');
    expect(service).toMatch(/manual search/i);
    expect(EDITORIAL_SCAN).toContain('ed-scan-failure-add-drink');
  });
});

describe('PROTOCOL TRUTH — seeded data is not member activity', () => {
  it('the synthetic baseline entry is flagged at the source', () => {
    const helpers = read('store', 'app', 'helpers.ts');
    expect(helpers).toMatch(/isSynthetic: true/);
    expect(helpers).toMatch(/synthetic-baseline/);
  });

  it('EDITORIAL Protocol filters it out of "Recent activity"', () => {
    expect(EDITORIAL_PROTOCOL).toMatch(/isSynthetic !== true/);
    // The rendered list must be the filtered one, not the raw history.
    expect(EDITORIAL_PROTOCOL).toMatch(/observedHistory\.slice\(0, 5\)/);
    expect(EDITORIAL_PROTOCOL).not.toMatch(/\{history\.slice\(0, 5\)/);
  });

  it('and so does the LEGACY screen — the same defect shipped on both', () => {
    expect(LEGACY_PROTOCOL).toMatch(/isSynthetic !== true/);
    expect(LEGACY_PROTOCOL).toMatch(/observedHistory\.slice\(0, 5\)/);
  });

  it('legitimate observed history is preserved, not blanket-hidden', () => {
    // The filter must exclude ONLY synthetic entries. A filter that dropped
    // real history would "fix" the defect by deleting the feature.
    for (const src of [EDITORIAL_PROTOCOL, LEGACY_PROTOCOL]) {
      expect(src).toMatch(/history\.filter\(\(h\) => h\.isSynthetic !== true\)/);
    }
  });
});

describe('WEEKLY TRUTH — one label, one population', () => {
  it('the rollups population is narrowed to the period the masthead names', () => {
    // The masthead is built from model.week (lastCompletedWeek). The pull
    // numbers must be computed over that same window.
    expect(EDITORIAL_WEEKLY).toMatch(/lastCompletedWeek\(nowISO\)/);
    expect(EDITORIAL_WEEKLY).toMatch(/r\.date >= weekStartDay && r\.date <= weekEndDay/);
    expect(EDITORIAL_WEEKLY).toMatch(/rollups: periodRollups/);
  });

  it('the fetch window is wide enough to CONTAIN the stated week', () => {
    // The last completed week starts at most 13 days back, so a 7-day fetch
    // could not cover it — the filter would silently yield a partial week.
    const m = /fetchJournalRollups\((\d+)\)/.exec(EDITORIAL_WEEKLY);
    expect(m, 'fetchJournalRollups call not found').not.toBeNull();
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(14);
  });

  it('MISSING OBSERVATIONS STAY MISSING, NEVER ZERO', () => {
    // A zero would be a claim about the member's week; the dash is a claim
    // about our data, which is the only true one.
    expect(EDITORIAL_WEEKLY).toMatch(/rollupsUnavailable \? null : model\.daysTracked/);
    expect(EDITORIAL_WEEKLY).toMatch(/rollupsUnavailable \? null : model\.weeklyWins/);
  });
});

describe('MOMENTS TRUTH — grammar, and no borrowed personalization', () => {
  const moments = (EN as unknown as { moments: Record<string, string> }).moments;

  it('"1 moment" — never "1 moments"', () => {
    expect(moments['overview_summary_one']).toBe('Today has {{total}} moment.');
    expect(moments['overview_summary_other']).toBe('Today has {{total}} moments.');
    expect(moments['overview_summary_one']).not.toMatch(/moments\./);
  });

  it('the screen passes `count`, which is what i18next pluralizes on', () => {
    // Adding _one/_other is inert without it: i18next selects the plural form
    // from `count` specifically, not from an arbitrary interpolation variable.
    expect(EDITORIAL_MOMENTS).toMatch(/count: summary\.total/);
  });

  it('STATIC PER-TYPE COPY DOES NOT CLAIM A PERSONAL FINDING', () => {
    // `summaryKey` is `moments.evidence.summary_${type}` — chosen by event
    // type, identical for every member, computed from nothing. It may give
    // general guidance; it may not report the member's own patterns back to
    // them as though AForce had observed them.
    const CLAIMS_PERSONAL_LEARNING =
      /\byour\b[^.]*\b(pattern|patterns|history|data|readings?|baseline|trend)\b/i;
    const evidence = (moments as unknown as { evidence: Record<string, string> }).evidence;
    for (const [key, copy] of Object.entries(evidence)) {
      expect(copy, `moments.evidence.${key} claims a personal finding`)
        .not.toMatch(CLAIMS_PERSONAL_LEARNING);
    }
  });
});

describe('GATES THAT MUST NOT MOVE', () => {
  it('editorial activation cannot widen the Calendar Legal/Privacy gate', () => {
    expect(FLAGS).toMatch(/moments_calendar_enabled: false/);
    // The editorial moments flag's own contract says it does not widen it.
    expect(FLAGS).toMatch(/does not widen the\s*\n?\s*\/\/\s*moments_enabled or moments_calendar_enabled gates/);
  });

  it('SENSORS CONTAINMENT SURVIVES — W2-N3 stays unreachable in the cohort build', () => {
    // The gate is a BUILD-TIME constant, so no flag change can reach it. This
    // law fails if the Editorial lane disturbs the route.
    expect(SENSORS_ROUTE).toMatch(/if\s*\(\s*INTERNAL_TESTFLIGHT_OVERLAY_ENABLED\s*\)\s*return/);
    const gateAt = SENSORS_ROUTE.search(/if\s*\(\s*INTERNAL_TESTFLIGHT_OVERLAY_ENABLED\s*\)\s*return/);
    expect(gateAt).toBeLessThan(SENSORS_ROUTE.indexOf('<SensorImportScreenV2'));
  });

  it('production Editorial defaults remain OFF', () => {
    for (const flag of [
      'editorial_home_enabled', 'editorial_moments_enabled', 'editorial_protocol_enabled',
      'editorial_weekly_enabled', 'editorial_scan_enabled',
    ]) {
      expect(FLAGS, `${flag} must ship false`).toMatch(new RegExp(`${flag}: false`));
    }
  });
});
