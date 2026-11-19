/**
 * Hydration · History bars (prototype: Week / Month). Pure functions.
 *
 * Week is the calendar week that holds today, Sunday to Saturday, so the days
 * still to come are on the chart as empty slots, as in the prototype. Month is
 * the last 30 days. A day with nothing recorded draws a short empty stub and is
 * not flagged as missed. Nothing here changes intake, the target or a score.
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
  /** A Moment falls on this day. */
  hasMoment: boolean;
}

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function dayKey(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The dates the chart covers, oldest first. */
export function historyDates(today: Date, range: HistoryRange): Date[] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (range === 'Week') {
    const sunday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay());
    return Array.from({ length: 7 }, (_, i) => new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i));
  }
  return Array.from({ length: 30 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() - 29 + i));
}

export function historyBars(
  days: readonly HistoryDayInput[],
  targetOz: number,
  today: Date,
  todayOz: number,
  range: HistoryRange,
  momentDays: ReadonlySet<string> = new Set(),
): HistoryBar[] {
  const byDate = new Map(days.map((d) => [d.date, d.oz] as const));
  const todayKey = dayKey(today);
  const dates = historyDates(today, range);
  const values = dates.map((d) => {
    const key = dayKey(d);
    if (key === todayKey) return todayOz;
    if (key > todayKey) return null; // still to come
    return byDate.get(key) ?? null;
  });
  const target = Number.isFinite(targetOz) && targetOz > 0 ? targetOz : 0;
  // The tallest bar or the target line, whichever is higher, fills the chart.
  const top = Math.max(target * 1.15, ...values.map((v) => (v != null && Number.isFinite(v) ? v : 0)), 1);
  return dates.map((d, i) => {
    const key = dayKey(d);
    const raw = values[i];
    const oz = raw != null && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
    return {
      date: key,
      label: range === 'Week' ? LETTERS[d.getDay()]! : '',
      oz,
      height: oz == null ? 0 : Math.max(0.04, Math.min(1, oz / top)),
      isToday: key === todayKey,
      metTarget: oz != null && target > 0 && oz >= target,
      hasMoment: momentDays.has(key),
    };
  });
}

/** Where the dashed target line sits, 0–1 from the bottom. */
export function historyTargetLine(bars: readonly HistoryBar[], targetOz: number): number {
  const top = Math.max(targetOz * 1.15, ...bars.map((b) => b.oz ?? 0), 1);
  return targetOz > 0 ? Math.min(1, targetOz / top) : 0;
}
