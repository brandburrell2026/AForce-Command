/**
 * Weekly Report — shared localization helpers.
 *
 * Extracted from `app/weekly-report.tsx` so the legacy report and the E2 elite
 * editorial (`EliteWeeklyEditorial`) render the SAME honest, localized copy from
 * the SAME `reports.*` i18n block — one source of truth, no drift. Pure mapping
 * from a `WeeklyReportSection` (status + coded findings + params) to localized
 * strings; it never fabricates a value.
 */
import type { TFunction } from 'i18next';
import type { WeeklyReportSection } from '@/utils/weeklyReport';

/** Localized status chip label ("Improved" / "Collecting…" / "Awaiting data" …). */
export function statusLabel(t: TFunction, section: WeeklyReportSection): string {
  return t(`reports.status.${section.status}`);
}

/** Localized one-line summary for a section — identical logic for legacy + elite. */
export function sectionSummary(t: TFunction, s: WeeklyReportSection): string {
  const base = `reports.sections.${s.key}`;
  switch (s.key) {
    case 'improved':
      return s.status === 'improved'
        ? (s.findings ?? []).map((f) => t(`reports.findings.${f.code}`, f.params)).join(' ')
        : t(`${base}.collecting`);
    case 'attention':
      if (s.status === 'attention') {
        return (s.findings ?? []).map((f) => t(`reports.findings.${f.code}`, f.params)).join(' ');
      }
      return s.status === 'steady' ? t(`${base}.steady`) : t(`${base}.collecting`);
    case 'performanceAge':
      if (s.status === 'improved') return t(`${base}.younger`, s.params);
      if (s.status === 'attention') return t(`${base}.older`, s.params);
      if (s.status === 'steady') return t(`${base}.steady`);
      return t(`${base}.collecting`);
    case 'habitVelocity':
      if (s.status === 'improved') return t(`${base}.improved`, s.params);
      if (s.status === 'attention') return t(`${base}.attention`, s.params);
      if (s.status === 'steady') return t(`${base}.steady`, s.params);
      return t(`${base}.collecting`);
    case 'recovery':
      if (s.status === 'improved') return t(`${base}.up`, s.params);
      if (s.status === 'attention') return t(`${base}.down`, s.params);
      if (s.status === 'steady') return t(`${base}.steady`);
      return t(`${base}.collecting`);
    case 'topCommand':
      return s.status === 'awaiting' ? t(`${base}.awaiting`) : t(`${base}.detail`, s.params);
    case 'nextWeekFocus': {
      const focus = String(s.params.focus ?? 'maintain');
      return t(`${base}.${focus}`);
    }
    default:
      return '';
  }
}
