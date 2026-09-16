/**
 * Phase 8 acceptance — the coach export.
 *
 *   "a compliance reviewer reading the coach export cannot infer a medical
 *    condition from it."
 *
 * Tested the way a reviewer would read it: the whole serialized report and
 * the whole rendered document are scanned, not individual fields. A leak
 * through a field nobody thought of still fails.
 */
import { describe, expect, it } from "vitest";

import {
  INFERENCE_TERMS,
  buildAvailabilityReport,
  reportToLines,
  scanForInference,
  scanLinesForInference,
  type ReportAthleteInput,
} from "../availabilityReport";
import { renderChartPdf } from "../chartPdf";

const ATHLETES: ReportAthleteInput[] = [
  { athleteUserId: "a1", displayName: "M. Reyes", position: "RB", availability: "out" },
  { athleteUserId: "a2", displayName: "K. Walker", position: "QB", availability: "limited" },
  { athleteUserId: "a3", displayName: "T. Johnson", position: "WR", availability: "available" },
  { athleteUserId: "a4", displayName: "A. Cole", position: "LB", availability: "available" },
  { athleteUserId: "a5", displayName: "J. Okonkwo", position: "DB", availability: "unset" },
];

function report(over: Partial<{ athletes: ReportAthleteInput[] }> = {}) {
  return buildAvailabilityReport({
    programId: "prog_1",
    generatedByUserId: "user_trainer_1",
    generatedAt: "2026-09-16T21:00:00.000Z",
    athletes: over.athletes ?? ATHLETES,
  });
}

describe("the report says who is in, limited and out — and nothing more", () => {
  it("groups by status with correct counts", () => {
    const r = report();
    expect(r.counts).toEqual({ available: 2, limited: 1, out: 1, unset: 1, total: 5 });
    expect(r.out.map((a) => a.displayName)).toEqual(["M. Reyes"]);
    expect(r.available.map((a) => a.displayName)).toEqual(["A. Cole", "T. Johnson"]);
  });

  it("carries exactly four fields per athlete", () => {
    for (const group of [report().available, report().limited, report().out]) {
      for (const athlete of group) {
        expect(Object.keys(athlete)).toEqual([
          "athleteUserId",
          "displayName",
          "position",
          "availability",
        ]);
      }
    }
  });

  it("orders each group alphabetically, never by severity", () => {
    // Ordering by anything clinical would rank athletes by something the
    // coach may not see, and the pattern would be readable.
    const r = report();
    expect(r.available.map((a) => a.displayName)).toEqual(
      [...r.available.map((a) => a.displayName)].sort(),
    );
  });
});

describe("a reviewer cannot infer a condition", () => {
  it("passes its own inference scan", () => {
    expect(scanForInference(report())).toEqual([]);
  });

  it("carries no return-to-play stage, even though the live coach view may", () => {
    // Phase 6 lets a coach see a stage label on an access-controlled screen.
    // An exported PDF is forwarded, printed and filed, so it does not carry
    // one: "stage 3 of 6" says an athlete is recovering from something.
    const json = JSON.stringify(report()).toLowerCase();
    for (const term of ["stage", "return to play", "rtp", "progression", "protocol"]) {
      expect(json).not.toContain(term);
    }
  });

  it("carries no reason, note, duration or history field", () => {
    const json = JSON.stringify(report()).toLowerCase();
    for (const term of ["reason", "note", "since", "days out", "duration", "history"]) {
      expect(json).not.toContain(term);
    }
  });

  it("catches a leak introduced through any field", () => {
    // Simulating the field somebody adds later without reading the header.
    const leaky = { ...report(), footer: "M. Reyes out with a hamstring strain" } as ReturnType<
      typeof report
    >;
    const findings = scanForInference(leaky);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.map((f) => f.term)).toContain("hamstring");
  });

  it("does not fire on an athlete's own name or position", () => {
    // A surname is not a diagnosis, and a real person may be called Payne.
    const named = report({
      athletes: [
        { athleteUserId: "p1", displayName: "R. Payne", position: "OL", availability: "available" },
        { athleteUserId: "p2", displayName: "S. Stage", position: "TE", availability: "out" },
      ],
    });
    expect(scanForInference(named)).toEqual([]);
  });

  it("keeps the vocabulary list meaningful", () => {
    // Guard against the list being quietly emptied.
    expect(INFERENCE_TERMS.length).toBeGreaterThan(20);
    expect(INFERENCE_TERMS).toContain("concussion");
    expect(INFERENCE_TERMS).toContain("reason");
  });
});

describe("the rendered document", () => {
  const pdf = renderChartPdf(reportToLines(report()));

  it("is a valid PDF", () => {
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("lists every athlete under a status heading", () => {
    for (const a of ATHLETES) expect(pdf).toContain(a.displayName);
    for (const heading of ["AVAILABLE", "LIMITED", "OUT"]) expect(pdf).toContain(heading);
  });

  it("states its own limits on the page", () => {
    expect(pdf).toContain("Availability only");
    expect(pdf).toContain("nothing about why");
  });

  it("contains no clinical vocabulary anywhere in the document", () => {
    const body = pdf.toLowerCase();
    for (const term of [
      "injur", "concussion", "hamstring", "symptom", "diagnos", "treatment",
      "return to play", "reason", "assessment",
    ]) {
      expect(body).not.toContain(term);
    }
  });

  it("says None rather than omitting an empty group", () => {
    // An omitted group is readable too: a report with no OUT section at all
    // tells a reader something changed about the format, and invites a guess.
    const empty = renderChartPdf(
      reportToLines(
        buildAvailabilityReport({
          programId: "prog_1",
          generatedByUserId: "u",
          generatedAt: "2026-09-16T21:00:00.000Z",
          athletes: [ATHLETES[2]!],
        }),
      ),
    );
    expect(empty).toContain("OUT");
    expect(empty).toContain("None.");
  });
});

/**
 * The guard must not be disableable by roster data.
 *
 * The original implementation serialized the report and then deleted every
 * athlete's name, id and position from it before scanning — a DOCUMENT-WIDE
 * erasure keyed on values a roster supplies. Roster values can be one
 * character long: "P" is a punter. With one punter listed, every letter p
 * vanished from the document, "pain" and "sprain" and "protocol" no longer
 * existed to be found, and the guard returned clean on a report full of
 * clinical language.
 *
 * These tests are written against the property, not the mechanism, so they
 * keep their meaning if the implementation changes again.
 */
describe("no roster value can blind the guard", () => {
  const leak = "reported pain and sprain after contact";

  /** A leak reaches the report through a field nobody sanitized. */
  function leaky(position: string | null, displayName = "M. Reyes") {
    const r = report({
      athletes: [{ athleteUserId: "a1", displayName, position, availability: "out" }],
    }) as unknown as Record<string, unknown>;
    (r["out"] as Record<string, unknown>[])[0]!["note"] = leak;
    return r as never;
  }

  it("catches the leak with an ordinary two-letter position", () => {
    const terms = scanForInference(leaky("RB")).map((f) => f.term);
    expect(terms).toContain("pain");
    expect(terms).toContain("sprain");
  });

  it.each([
    ["a single-letter position (punter)", "P"],
    ["a single-letter position that is not in any term", "Z"],
    ["an empty position", ""],
    ["no position at all", null],
  ])("still catches it with %s", (_label, position) => {
    const terms = scanForInference(leaky(position)).map((f) => f.term);
    expect(terms).toContain("pain");
    expect(terms).toContain("sprain");
  });

  it("still catches it when an athlete's NAME is a single letter", () => {
    const terms = scanForInference(leaky("RB", "P")).map((f) => f.term);
    expect(terms).toContain("pain");
  });

  /**
   * The other half of the contract: exempting identity must still work. A
   * real person may be called Payne, or Stage, and their own name is not a
   * finding.
   */
  it.each([
    ["Payne", "pain"],
    ["A. Stage", "stage"],
    ["R. Straine", "strain"],
  ])("does not fire on an athlete called %s", (displayName) => {
    const clean = report({
      athletes: [{ athleteUserId: "a1", displayName, position: "RB", availability: "out" }],
    });
    expect(scanForInference(clean)).toEqual([]);
  });

  it("does not fire on a position that contains a term", () => {
    const clean = report({
      athletes: [{ athleteUserId: "a1", displayName: "M. Reyes", position: "Stage", availability: "out" }],
    });
    expect(scanForInference(clean)).toEqual([]);
  });
});

describe("the rendered document is scanned, not only the data", () => {
  it("passes on a clean report", () => {
    const r = report();
    expect(scanLinesForInference(r, reportToLines(r))).toEqual([]);
  });

  it("catches a line the renderer added that the data never carried", () => {
    const r = report();
    const lines = [...reportToLines(r), { text: "Note: 2 athletes in concussion protocol" }];
    const terms = scanLinesForInference(r, lines).map((f) => f.term);
    expect(terms).toContain("concussion");
    expect(terms).toContain("protocol");
  });

  it("does not fire on an athlete row for a player called Payne", () => {
    const r = report({
      athletes: [{ athleteUserId: "a1", displayName: "Payne", position: "RB", availability: "out" }],
    });
    expect(scanLinesForInference(r, reportToLines(r))).toEqual([]);
  });
});
