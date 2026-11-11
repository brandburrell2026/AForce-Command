import type { Moment, MomentType } from "@/types/moments";

export interface MomentDraft {
  title: string;
  date: string;
  time: string;
  type: MomentType;
  prepGoal: string;
  /** Explicit IANA zone for this review; stored Moment time remains an absolute instant. */
  timeZone?: string;
}
export type DraftResult =
  | { ok: true; startAtIso: string }
  | { ok: false; error: string };

/** Explicit local wall time only. Never guess a date, timezone, or intake amount. */
export function validateMomentDraft(
  draft: MomentDraft,
  nowMs = Date.now(),
): DraftResult {
  if (!draft.title.trim())
    return { ok: false, error: "Give your moment a name." };
  if (draft.title.trim().length > 160)
    return { ok: false, error: "Keep the name to 160 characters." };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !/^\d{2}:\d{2}$/.test(draft.time)
  ) {
    return {
      ok: false,
      error: "Choose a date (YYYY-MM-DD) and a 24-hour time (HH:mm).",
    };
  }
  const [year, month, day] = draft.date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [hour, minute] = draft.time.split(":").map(Number) as [number, number];
  if (draft.timeZone) {
    let format: Intl.DateTimeFormat;
    try {
      format = new Intl.DateTimeFormat("en-GB", {
        timeZone: draft.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
    } catch {
      return { ok: false, error: "Choose a valid time zone." };
    }
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    const parts = (ms: number) =>
      Object.fromEntries(
        format.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
      );
    const offsets = new Set<number>();
    for (let hours = -48; hours <= 48; hours += 6) {
      const probe = wall + hours * 3_600_000;
      const p = parts(probe);
      offsets.add(
        Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!) -
          probe,
      );
    }
    const matches = [...offsets]
      .map((offset) => wall - offset)
      .filter((ms) => {
        const p = parts(ms);
        return (
          +p.year! === year &&
          +p.month! === month &&
          +p.day! === day &&
          +p.hour! === hour &&
          +p.minute! === minute
        );
      });
    if (!matches.length)
      return {
        ok: false,
        error: "That local date or time does not exist. Choose another time.",
      };
    if (matches.length > 1)
      return {
        ok: false,
        error:
          "That time occurs twice when clocks change. Choose an unambiguous local time.",
      };
    const instant = matches[0]!;
    if (instant <= nowMs)
      return { ok: false, error: "Choose a time in the future." };
    return { ok: true, startAtIso: new Date(instant).toISOString() };
  }
  const at = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    at.getFullYear() !== year ||
    at.getMonth() !== month - 1 ||
    at.getDate() !== day ||
    at.getHours() !== hour ||
    at.getMinutes() !== minute
  ) {
    return {
      ok: false,
      error: "That local date or time does not exist. Choose another time.",
    };
  }
  // A repeated daylight-saving wall time needs a timezone-aware entry, not a guess.
  for (const delta of [-120, -60, -30, 30, 60, 120]) {
    const other = new Date(at.getTime() + delta * 60_000);
    if (
      other.getFullYear() === year &&
      other.getMonth() === month - 1 &&
      other.getDate() === day &&
      other.getHours() === hour &&
      other.getMinutes() === minute
    ) {
      return {
        ok: false,
        error:
          "That time occurs twice when clocks change. Choose an unambiguous local time.",
      };
    }
  }
  if (at.getTime() <= nowMs)
    return { ok: false, error: "Choose a time in the future." };
  return { ok: true, startAtIso: at.toISOString() };
}

/** Called only after an explicit confirmation; recommendations remain read-time projections. */
export function createConfirmedMoment(
  draft: MomentDraft,
  startAtIso: string,
): Moment {
  return {
    id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    source: "manual",
    title: draft.title.trim(),
    type: draft.type,
    importance: "high",
    startAtIso,
    prepGoal: draft.prepGoal.trim().slice(0, 500) || undefined,
    createdAtIso: new Date().toISOString(),
  };
}
