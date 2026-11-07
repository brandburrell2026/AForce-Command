import type { MomentDraft } from "./momentDraft";
import { suggestMomentDraft } from "./oneBreathDraft";

/** Member-pasted confirmation → existing editable draft. No inbox, booking,
 * alcohol inference, location lookup, raw-body persistence or automatic save.
 * Only explicitly labelled fields are candidates; ambiguity stays editable. */
export function suggestReservationDraft(text: string): MomentDraft {
  const draft: MomentDraft = {
    title: "",
    date: "",
    time: "",
    type: "personal",
    prepGoal: "",
  };
  if (text.length > 4000) return draft;
  const fields = [
    ...text.matchAll(
      /^\s*(restaurant|venue|event|date|time)\s*:\s*([^\r\n]+)$/gim,
    ),
  ];
  const unique = (labels: string[]) => [
    ...new Set(
      fields
        .filter((m) => labels.includes(m[1]!.toLowerCase()))
        .map((m) => m[2]!.trim()),
    ),
  ];
  const titles = unique(["restaurant", "venue", "event"]);
  if (titles.length === 1 && titles[0]!.length <= 160) draft.title = titles[0]!;
  // A provider's status or timezone is not permission to guess a local time.
  if (
    /\b(cancelled|canceled|rescheduled|unconfirmed|tentative|utc|gmt|[ecmp][sd]t|bst|cest?|eest?|ist|jst|aedt?|aest|nz[sd]t|timezone|time zone|eastern|central|mountain|pacific)\b|[+-]\d{2}:?\d{2}|\b(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z_]+(?:\/[A-Za-z_]+)?\b/i.test(
      text,
    )
  )
    return draft;
  const dates = unique(["date"]);
  const times = unique(["time"]);
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  if (dates.length === 1) {
    const date = dates[0]!;
    if (/^20\d{2}-\d{2}-\d{2}$/.test(date)) draft.date = date;
    else {
      const match =
        /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})$/i.exec(
          date,
        );
      if (match)
        draft.date = `${match[3]}-${String(months.indexOf(match[1]!.toLowerCase()) + 1).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
    }
  }
  if (times.length === 1) {
    const time = times[0]!;
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) draft.time = time;
    else if (
      /^(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)$/i.test(time)
    )
      draft.time = suggestMomentDraft(time).time;
  }
  return draft; // Existing validateMomentDraft still owns date/time validity.
}
