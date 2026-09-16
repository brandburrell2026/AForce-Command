/**
 * Availability report — the coach handoff.
 *
 * Phase 8 of `docs/TRAINER-DASHBOARD-BRIEF.md`. The acceptance bar is the
 * strictest on the whole surface:
 *
 *   "a compliance reviewer reading the coach export cannot infer a medical
 *    condition from it."
 *
 * That is a harder test than "contains no medical field". A report can leak a
 * condition through shape as easily as through content, so three decisions
 * follow from it:
 *
 *   1. NO REASON, EVER, IN ANY FORM. Not a note, not a status reason, not a
 *      free-text field a trainer could type into. The report is built upward
 *      from four values per athlete and there is no field for prose.
 *
 *   2. NO RETURN-TO-PLAY STAGE. Phase 6 lets a coach see a stage label in the
 *      live, access-controlled view. This export does not carry it. "Stage 3
 *      of 6 of a return protocol" tells a reviewer an athlete is recovering
 *      from something, and an exported PDF travels further than a screen —
 *      it is forwarded, printed and filed. Same person, different artefact,
 *      different bar.
 *
 *   3. NO DURATION, NO HISTORY, NO TREND. "Out for 19 days" is a clinical
 *      signal wearing a calendar's clothes. The report is a snapshot of
 *      today, which is what a coach needs to plan a session.
 *
 * `scanForInference` is the guard that keeps all three honest, and it runs in
 * the route as well as in the tests: a report that trips it is not sent.
 */

export type ReportAvailability = "available" | "limited" | "out" | "unset";

export interface ReportAthleteInput {
  athleteUserId: string;
  displayName: string;
  position: string | null;
  availability: ReportAvailability;
}

/** One line of the report. Four fields, no prose. */
export interface ReportAthlete {
  athleteUserId: string;
  displayName: string;
  position: string | null;
  availability: ReportAvailability;
}

export interface AvailabilityReport {
  programId: string;
  generatedAt: string;
  generatedByUserId: string;
  counts: { available: number; limited: number; out: number; unset: number; total: number };
  available: ReportAthlete[];
  limited: ReportAthlete[];
  out: ReportAthlete[];
  unset: ReportAthlete[];
}

/** Build the report. Constructed upward; nothing is deleted from a fuller shape. */
export function buildAvailabilityReport(args: {
  programId: string;
  generatedByUserId: string;
  generatedAt: string;
  athletes: readonly ReportAthleteInput[];
}): AvailabilityReport {
  const line = (a: ReportAthleteInput): ReportAthlete => ({
    athleteUserId: a.athleteUserId,
    displayName: a.displayName,
    position: a.position,
    availability: a.availability,
  });

  const byStatus = (status: ReportAvailability): ReportAthlete[] =>
    args.athletes
      .filter((a) => a.availability === status)
      .map(line)
      // Alphabetical inside a group. Ordering by anything else — score,
      // recency, severity — would rank athletes by something the coach is
      // not entitled to see, and a reader would notice the pattern.
      .sort((x, y) => x.displayName.localeCompare(y.displayName));

  const available = byStatus("available");
  const limited = byStatus("limited");
  const out = byStatus("out");
  const unset = byStatus("unset");

  return {
    programId: args.programId,
    generatedAt: args.generatedAt,
    generatedByUserId: args.generatedByUserId,
    counts: {
      available: available.length,
      limited: limited.length,
      out: out.length,
      unset: unset.length,
      total: args.athletes.length,
    },
    available,
    limited,
    out,
    unset,
  };
}

/**
 * Words and shapes a coach-facing artefact must never contain.
 *
 * Two kinds of entry: clinical vocabulary, and the words a well-meaning
 * engineer reaches for when adding "just a bit of context" to a report.
 */
export const INFERENCE_TERMS = [
  // Clinical vocabulary
  "injur", "concussion", "strain", "sprain", "hamstring", "acl", "symptom",
  "diagnos", "rehab", "treatment", "medical", "illness", "sick", "pain",
  "soreness", "dehydrat", "heat stroke", "protocol", "cleared",
  // Recovery shape
  "return to play", "rtp", "stage", "progression", "sign-off", "signoff",
  // Reason-shaped fields
  "reason", "note", "assessment", "diagnosis", "condition",
  // Duration, which is a clinical signal in a calendar's clothing
  "days out", "since", "duration", "expected back",
] as const;

export interface InferenceFinding {
  term: string;
  where: string;
}

/**
 * The three keys whose VALUES are identity rather than information.
 *
 * A surname is not a diagnosis and a real person may well be called Payne, so
 * these values are not scanned. Their KEY NAMES still are, along with every
 * other key and value in the document — the guard must keep catching a field
 * added later by someone who did not read this file.
 */
const IDENTITY_KEYS = new Set(["displayName", "athleteUserId", "position"]);

/**
 * Collect everything in the report that is not an identity value.
 *
 * WHY A WALK AND NOT A REDACTED STRING. This used to serialize the whole
 * report and then delete every exempt value from it with
 * `haystack.split(value).join(" ")`. That is a DOCUMENT-WIDE erasure keyed on
 * roster data, and roster data can be one character long: "P" is a punter. An
 * athlete listed at position P erased every letter p from the document, so
 * "pain", "sprain" and "protocol" no longer existed to be found and the guard
 * returned clean on a report full of clinical language. A single-letter name
 * or a two-letter id does the same thing, and nothing about the report says
 * the guard has been switched off.
 *
 * Scoping the exemption to the field it belongs to removes the mechanism
 * entirely. An identity value is never scanned, and it also never redacts
 * anything else. A minimum-length rule would have papered over the same bug;
 * this makes the length irrelevant.
 */
function scannableText(value: unknown, key: string | null, out: string[]): void {
  if (key !== null) out.push(key);
  if (key !== null && IDENTITY_KEYS.has(key)) return;

  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) scannableText(item, null, out);
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      scannableText(v, k, out);
    }
    return;
  }
  out.push(String(value));
}

/**
 * Scan a report for anything a reviewer could infer a condition from.
 *
 * Covers every field, including one added later, because the walk does not
 * know or care what the fields are called — only which three carry identity.
 */
export function scanForInference(report: AvailabilityReport): InferenceFinding[] {
  const parts: string[] = [];
  scannableText(report, null, parts);
  const haystack = parts.join(" ").toLowerCase();

  const findings: InferenceFinding[] = [];
  for (const term of INFERENCE_TERMS) {
    if (haystack.includes(term)) findings.push({ term, where: "report" });
  }
  return findings;
}

/**
 * Scan the RENDERED lines — the artefact that actually gets forwarded.
 *
 * `scanForInference` proves the data is clean. This proves the rendering did
 * not add anything: a heading, a footer, a helpful caption. Athlete rows are
 * reconstructed from identity and skipped by exact match, so a player called
 * Payne is still not a finding, and anything the renderer emits that is not
 * one of those rows is scanned in full with no erasure.
 */
export function scanLinesForInference(
  report: AvailabilityReport,
  lines: readonly { text: string }[],
): InferenceFinding[] {
  const identityRows = new Set<string>();
  for (const group of [report.available, report.limited, report.out, report.unset]) {
    for (const a of group) {
      identityRows.add(a.position ? `${a.displayName} · ${a.position}` : a.displayName);
    }
  }

  const findings: InferenceFinding[] = [];
  for (const line of lines) {
    if (identityRows.has(line.text)) continue;
    const text = line.text.toLowerCase();
    for (const term of INFERENCE_TERMS) {
      if (text.includes(term)) findings.push({ term, where: "rendered_line" });
    }
  }
  return findings;
}

/** Report lines for the PDF renderer. Same content, no extra facts. */
export function reportToLines(report: AvailabilityReport): { text: string; style?: "heading" | "body" | "meta" }[] {
  const lines: { text: string; style?: "heading" | "body" | "meta" }[] = [
    { text: "Availability report", style: "heading" },
    { text: `Program ${report.programId}`, style: "meta" },
    { text: `Generated ${report.generatedAt}`, style: "meta" },
    {
      text:
        "Availability only. This report states who is available, limited or out today, " +
        "and nothing about why.",
      style: "meta",
    },
    { text: " " },
    {
      text: `Available ${report.counts.available} · Limited ${report.counts.limited} · Out ${report.counts.out} · Not set ${report.counts.unset}`,
    },
    { text: " " },
  ];

  const section = (title: string, group: ReportAthlete[]) => {
    lines.push({ text: title, style: "heading" });
    if (group.length === 0) {
      lines.push({ text: "None." });
      return;
    }
    for (const a of group) {
      lines.push({ text: a.position ? `${a.displayName} · ${a.position}` : a.displayName });
    }
    lines.push({ text: " " });
  };

  section("AVAILABLE", report.available);
  section("LIMITED", report.limited);
  section("OUT", report.out);
  if (report.unset.length > 0) section("NOT SET", report.unset);

  return lines;
}
