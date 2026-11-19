/**
 * Hydration · History bars (prototype: Week / Month). Pure functions.
 *
 * Bars show what was logged each day against the starting target. A day with
 * nothing recorded draws no bar and is not flagged as missed. Nothing here
 * changes intake, the target or a score.
 */
export type HistoryRange = 'Week' | 'Month';

export interface HistoryDayInput {
  /** YYYY-MM-DD, the server's day key. */
  date: string;
  /** Ounces at the end of that day; null when nothing was recorded. */
  oz: number | null;
}

export interface HistoryBar {
  date: string;
  /** Narrow weekday letter for the Week view; '' in the Month view. */
  label: string;
  oz: number | null;
  /** 0–1 of the chart height. */
  height: number;
  isToday: boolean;
  metTarget: boolean;
}

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function parseDay(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function historyBars(
  days: readonly HistoryDayInput[],
  targetOz: number,
  todayKey: string,
  todayOz: number,
  range: HistoryRange,
): HistoryBar[] {
  const want = range === 'Week' ? 7 : 30;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-want);
  const values = sorted.map((d) => (d.date === todayKey ? todayOz : d.oz));
  const target = Number.isFinite(targetOz) && targetOz > 0 ? targetOz : 0;
  // The tallest bar or the target line, whichever is higher, fills the chart.
  const top = Math.max(target * 1.15, ...values.map((v) => (v != null && Number.isFinite(v) ? v : 0)), 1);
  return sorted.map((d, i) => {
    const raw = values[i];
    const oz = raw != null && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
    const parsed = parseDay(d.date);
    return {
      date: d.date,
      label: range === 'Week' && parsed ? LETTERS[parsed.getDay()]! : '',
      oz,
      height: oz == null ? 0 : Math.max(0.04, Math.min(1, oz / top)),
      isToday: d.date === todayKey,
      metTarget: oz != null && target > 0 && oz >= target,
    };
  });
}

/** Where the dashed target line sits, 0–1 from the bottom. */
export function historyTargetLine(bars: readonly HistoryBar[], targetOz: number): number {
  const top = Math.max(targetOz * 1.15, ...bars.map((b) => b.oz ?? 0), 1);
  return targetOz > 0 ? Math.min(1, targetOz / top) : 0;
}

export function dayKey(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
