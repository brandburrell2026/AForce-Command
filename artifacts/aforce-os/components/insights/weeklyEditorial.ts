/**
 * Elite Weekly Report (E2) — pure editorial view-model.
 *
 * PRESENTATION ONLY. Takes the already-built, honest `WeeklyReport` (from the
 * deterministic `utils/weeklyReport.ts`) and decides the editorial *order* and a
 * per-section *tone* for styling. It never computes a metric, never invents a
 * trend, and never upgrades a `collecting`/`awaiting` section into a win — those
 * map to explicit calibrating/awaiting tones so the screen renders an intentional
 * "still gathering data" state rather than a fabricated one (Score-Protection).
 *
 * Extracted from the component (like `homePresentation.ts` / `afPrimitives.logic.ts`)
 * so the ordering + honesty mapping are unit-testable in the node vitest env.
 */
import type {
  WeeklyReport,
  WeeklyReportSection,
  WeeklyReportSectionKey,
  WeeklyReportStatus,
} from '@/utils/weeklyReport';

export type EditorialTone = 'win' | 'watch' | 'neutral' | 'calibrating' | 'awaiting';

export interface EditorialSection {
  key: WeeklyReportSectionKey;
  status: WeeklyReportStatus;
  tone: EditorialTone;
  /** True when this section is an honest "no real data yet" state (never faked). */
  isHonestState: boolean;
  /** True for Performance Age — the screen pairs it with the non-medical disclaimer + Beta tag. */
  isPerformanceAge: boolean;
}

/** Map an honest section status to an editorial tone. Never invents a win. */
export function toneForStatus(status: WeeklyReportStatus): EditorialTone {
  switch (status) {
    case 'improved':
      return 'win';
    case 'attention':
      return 'watch';
    case 'steady':
      return 'neutral';
    case 'collecting':
      return 'calibrating';
    case 'awaiting':
      return 'awaiting';
    default:
      return 'neutral';
  }
}

/** Editorial read order: the story (wins → watch) then the metrics, focus last. */
export const EDITORIAL_ORDER: WeeklyReportSectionKey[] = [
  'improved',
  'attention',
  'performanceAge',
  'recovery',
  'habitVelocity',
  'topCommand',
  'nextWeekFocus',
];

const HONEST = new Set<WeeklyReportStatus>(['collecting', 'awaiting']);

/** Order + tone the report's sections for the editorial layout. Pure. */
export function buildEditorialSections(report: WeeklyReport): EditorialSection[] {
  const byKey = new Map<WeeklyReportSectionKey, WeeklyReportSection>();
  for (const s of report.sections) byKey.set(s.key, s);
  const out: EditorialSection[] = [];
  for (const key of EDITORIAL_ORDER) {
    const s = byKey.get(key);
    if (!s) continue;
    out.push({
      key,
      status: s.status,
      tone: toneForStatus(s.status),
      isHonestState: HONEST.has(s.status),
      isPerformanceAge: key === 'performanceAge',
    });
  }
  return out;
}
