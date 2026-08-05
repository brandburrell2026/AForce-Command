/**
 * RULING J (RC-2) — Weekly Report share-payload lock.
 *
 * `ReadinessInsightsV2`'s `onShare` (ported verbatim from the legacy
 * `app/weekly-report.tsx`, see that file's own header) composes the text
 * handed to the OS share sheet from `buildWeeklyReport`'s `sections` only —
 * it never reads `WeeklyReport.health` (the W3.4 canonical weekly health
 * aggregate, built from raw multi-provider records via
 * `buildWeeklyHealthAggregates`). That is a deliberate Score-Protection-
 * adjacent boundary: the share text may contain DERIVED weekly aggregates
 * (a habit-velocity count, a performance-age delta, a recovery delta) but
 * must never leak a raw biometric reading, a provider identifier
 * (whoop / oura / apple_health / garmin / …), or any record-level field
 * (externalId, deduplicationKey, device info).
 *
 * This is a LOCK, not a feature test: it builds the exact share payload
 * `onShare` builds, from a fixture state deliberately stuffed with rich,
 * multi-provider raw health data (the kind of thing that WOULD leak if a
 * future change piped `report.health` into a section's copy), and asserts
 * the composed string never contains any of it. It also pattern-scans
 * `ReadinessInsightsV2.tsx`'s own `onShare` body for a `.health` reference,
 * so a future edit that starts reading the aggregate inside the composer
 * fails this test immediately and must consciously update it (rather than
 * silently reintroducing the leak this ruling closes).
 *
 * If a legitimate future feature wants to surface a *derived* health
 * aggregate figure (e.g. "avg sleep 7.2h this week") in the share text, that
 * is fine — but it must go through a section's `value`/`params`/`findings`
 * (the same sanitized, i18n-coded path every other section uses), and this
 * test's pattern list must be updated consciously to reflect the new
 * sanctioned surface. Do not loosen this test by simply deleting a pattern.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TFunction } from 'i18next';
import type { HealthProviderId } from '@workspace/health-core';

import {
  buildWeeklyReport,
  lastCompletedWeek,
  type WeeklyReport,
  type WeeklyReportSection,
  type WeeklyReportSectionKey,
} from '@/utils/weeklyReport';
import type { AnalyticsEvent } from '@/utils/analytics/metrics';
import { sectionSummary } from '@/components/insights/weeklyReportCopy';
import { buildWeeklyHealthAggregates } from '@/services/health/weeklyHealthAggregates';
import { mkRecord, dayMidMs, FIXED_NOW, DAYS, UTC_OFFSET_MIN } from '@/services/health/weeklyHealthAggregatesFixtures';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// Verbatim copy of ReadinessInsightsV2.tsx's SHARE_SECTION_ORDER — that file
// documents it as itself a verbatim duplicate of the legacy screen's order,
// so a third copy here (test-only) follows the same established precedent
// rather than exporting a private constant purely for test access.
const SHARE_SECTION_ORDER: WeeklyReportSectionKey[] = [
  'improved',
  'attention',
  'performanceAge',
  'habitVelocity',
  'recovery',
  'topCommand',
  'nextWeekFocus',
];

// ─── Rich, adversarial, multi-provider fixture ───────────────────────────
// Deliberately distinctive raw values + all four named providers, so any
// leak into the composed share text is unmistakable (never a value that
// could coincidentally appear from an unrelated derived count).
const RICH_PROVIDER_RECORDS = [
  mkRecord({
    provider: 'whoop',
    metricType: 'provider_score',
    scoreKind: 'whoop_recovery',
    value: 62,
    observedAtMs: dayMidMs(1),
  }),
  mkRecord({
    provider: 'oura',
    metricType: 'hrv',
    hrvMethod: 'rmssd',
    value: 53.7,
    observedAtMs: dayMidMs(2),
  }),
  mkRecord({
    provider: 'apple_health',
    metricType: 'resting_heart_rate',
    value: 41,
    observedAtMs: dayMidMs(3),
    originalSource: 'com.apple.health',
  }),
  mkRecord({
    provider: 'garmin',
    metricType: 'steps',
    value: 14_321,
    observedAtMs: dayMidMs(4),
  }),
];

const RICH_PROVIDER_IDS = new Set<HealthProviderId>(['whoop', 'oura', 'apple_health', 'garmin']);

// ─── Rich, params-bearing analytics fixture (review fix) ─────────────────
// The PROHIBITED_PATTERNS scan below is only a meaningful guard if the
// composed text can actually carry INTERPOLATED runtime data — params are
// the one channel a leak could travel through. An empty `analyticsEvents`
// log leaves every section at its param-less `collecting`/`awaiting`/
// `steady` branch (see utils/weeklyReport.ts: `noWeekData` short-circuits
// habitVelocity straight to `t(base.collecting)`, no `s.params` passed),
// which made the original version of this test vacuous: a reviewer proved
// an injected leak (`JSON.stringify(input.health)` spliced into
// `habitParams` upstream in `buildWeeklyReport`) passed unnoticed because
// the composer never reached a branch that would render it.
//
// Six real, distinct active days in the report week (Mon–Sat, `dayOffset`
// 1–6 relative to `weekStartISO`'s Sunday) plus one active day the week
// before gives `activeDaysDelta = 6 - 1 = +5`, which drives BOTH:
//   - the top-level `improved` section into its findings-with-params branch
//     (`streak` >= 3 and `active_days_up`, both param-bearing), and
//   - `habitVelocity` into its `improved` branch, which — unlike its
//     `collecting` default — DOES pass `s.params` to `t()`.
// This is deliberately the same recipe the reviewing pass verified
// (6 days of `session_open` + `log_action`) so this fixture is proven,
// not merely plausible.
function atOffset(baseISO: string, dayOffset: number, hour: number): string {
  return new Date(Date.parse(baseISO) + dayOffset * DAY_MS + hour * HOUR_MS).toISOString();
}

const SHARE_NOW_ISO = new Date(FIXED_NOW).toISOString();
const SHARE_WEEK = lastCompletedWeek(SHARE_NOW_ISO);
const CURRENT_WEEK_ACTIVE_DAY_OFFSETS = [1, 2, 3, 4, 5, 6] as const;

const RICH_ANALYTICS_EVENTS: AnalyticsEvent[] = [
  ...CURRENT_WEEK_ACTIVE_DAY_OFFSETS.flatMap((dayOffset): AnalyticsEvent[] => [
    { type: 'session_open', at: atOffset(SHARE_WEEK.weekStartISO, dayOffset, 9) },
    { type: 'log_action', at: atOffset(SHARE_WEEK.weekStartISO, dayOffset, 9.25), meta: { ttlMs: 1500 } },
  ]),
  // Prior week: exactly one active day, so activeDaysDelta is unambiguously +5.
  { type: 'session_open', at: atOffset(SHARE_WEEK.priorWeekStartISO, 2, 9) },
];

/** Marker substrings that must NEVER appear in composed share text. */
const PROHIBITED_PATTERNS: RegExp[] = [
  /whoop/i,
  /oura/i,
  /apple_health/i,
  /garmin/i,
  /com\.apple\.health/i,
  /rmssd|sdnn/i, // HRV method — provider/record-level detail, not a section concept
  /\b62\b/, // whoop recovery raw value
  /\b53\.7\b/, // oura HRV raw value
  /\b41\b/, // apple_health resting HR raw value
  /\b14321\b|\b14,321\b/, // garmin steps raw value
];

/** Minimal, deterministic fake t() — returns the key (plus JSON params when present) so assertions are exact and copy-change-proof. */
const fakeT = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;

function buildRichHealthAggregate() {
  return buildWeeklyHealthAggregates({
    records: RICH_PROVIDER_RECORDS,
    activeDirectProviders: RICH_PROVIDER_IDS,
    days: DAYS,
    timezoneOffsetMin: UTC_OFFSET_MIN,
    nowMs: FIXED_NOW,
  });
}

/** Builds the report exactly as onShare's `shareReport` memo does — rich health aggregate + rich analytics, both real. */
function buildRichReport(health: ReturnType<typeof buildRichHealthAggregate>): WeeklyReport {
  return buildWeeklyReport({
    nowISO: SHARE_NOW_ISO,
    weekStartISO: SHARE_WEEK.weekStartISO,
    weekEndISO: SHARE_WEEK.weekEndISO,
    priorWeekStartISO: SHARE_WEEK.priorWeekStartISO,
    priorWeekEndISO: SHARE_WEEK.priorWeekEndISO,
    analyticsEvents: RICH_ANALYTICS_EVENTS,
    health,
  });
}

/** Reproduces onShare's exact composition (ReadinessInsightsV2.tsx:209-217). */
function composeShareText(report: WeeklyReport): string {
  const shareSections = SHARE_SECTION_ORDER.map((key) =>
    report.sections.find((s) => s.key === key),
  ).filter((s): s is WeeklyReportSection => Boolean(s));

  const lines: string[] = [fakeT('reports.shareTitle'), 'week-range', ''];
  for (const s of shareSections) {
    const title = fakeT(`reports.sections.${s.key}.title`);
    const summary = sectionSummary(fakeT, s);
    lines.push(summary ? `${title}: ${summary}` : title);
  }
  return lines.join('\n');
}

describe('RC-2 Ruling J — Weekly Report share payload never leaks raw health data', () => {
  const health = buildRichHealthAggregate();
  const report = buildRichReport(health);
  const composed = composeShareText(report);

  it('sanity: the fixture actually produced a populated, provider-attributed aggregate (the leak this test guards against is real, not vacuous)', () => {
    expect(health).toBeTruthy();
    const serialized = JSON.stringify(health);
    // The aggregate itself is EXPECTED to carry provider attribution —
    // that's its job. The guard is that it never reaches the share text.
    expect(serialized).toMatch(/whoop|oura|apple_health|garmin/i);
  });

  it('sanity: the analytics fixture actually drives real sections past their param-less default (proves this lock is not testing a vacuous, always-collecting payload)', () => {
    // habitVelocity must have left 'collecting' — it is the section the
    // review's leak-mutation targeted specifically because 'collecting' is
    // param-less and would hide an upstream params leak.
    const habitVelocity = report.sections.find((s) => s.key === 'habitVelocity');
    expect(habitVelocity?.status).toBe('improved');
    expect(habitVelocity?.params).toMatchObject({ activeDays: 6, priorActiveDays: 1 });
  });

  it('the composed share payload demonstrably contains at least one interpolated params payload — not just bare i18n keys (review fix: a payload with zero interpolation cannot prove a params-borne leak is caught)', () => {
    // Structural, not brittle: matches fakeT's own `key:{"param":...}`
    // serialization contract for ANY interpolated key, without pinning to
    // a specific key name or fixture value that would make this assertion
    // fragile to unrelated copy/fixture changes.
    expect(composed).toMatch(/:\{"[A-Za-z0-9_]+":/);
  });

  it('the composed share payload contains no raw biometric value, provider identifier, or record-level field from the rich fixture', () => {
    for (const pattern of PROHIBITED_PATTERNS) {
      expect(composed).not.toMatch(pattern);
    }
  });

  it('the composed share payload contains ONLY the derived section lines (title[: summary] per section, in order) — no stray content', () => {
    const lines = composed.split('\n');

    // Header (title, week-range, blank) + exactly one line per SHARE_SECTION_ORDER entry.
    expect(lines).toHaveLength(3 + SHARE_SECTION_ORDER.length);
    for (const key of SHARE_SECTION_ORDER) {
      expect(composed).toContain(`reports.sections.${key}.title`);
    }
  });

  it('WeeklyReport.health carries the rich aggregate (pass-through is intact) even though onShare never reads it', () => {
    expect(report.health).toBe(health);
  });
});

describe('RC-2 Ruling J — structural guard on ReadinessInsightsV2.onShare', () => {
  const SOURCE = readFileSync(
    join(__dirname, '..', 'ReadinessInsightsV2.tsx'),
    'utf8',
  );
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

  const onShareMatch = CODE.match(
    /const onShare = React\.useCallback\(\(\) => \{([\s\S]*?)\}, \[t, shareWeekRange, shareSections\]\);/,
  );

  it('onShare is found at its documented shape (fixture drifts loudly if the composer is restructured)', () => {
    expect(onShareMatch).not.toBeNull();
  });

  it('onShare\'s body never references the health aggregate directly — RULING J. If you are adding a legitimate feature that shares a derived health figure, route it through a WeeklyReportSection (value/params/findings) and consciously update this test — do not read `.health` (or `report.health`) inside this closure.', () => {
    const body = onShareMatch?.[1] ?? '';
    expect(body).not.toMatch(/\.health\b/);
    expect(body).not.toMatch(/\bhealth\./);
  });
});
