/**
 * The export must not lose an athlete.
 *
 * The encoder dropped every character WinAnsiEncoding could not represent,
 * on the reasoning that an honest omission beats a mangled glyph. That is
 * right about glyphs and wrong about names, because what was omitted was the
 * person: "L. Dončić" rendered as "L. Doni" — a different, plausible name —
 * and "M. 中村" rendered as an empty line. A trainer scanning the OUT list of
 * a coach export does not notice a row that is not there.
 *
 * These assert the property, not the substitution character.
 */
import { describe, expect, it } from "vitest";

import { latin1Loss, renderChartPdf, toLatin1 } from "../chartPdf";

describe("names survive the Latin-1 encoder", () => {
  it.each([
    ["L. Dončić", "L. Doncic"],
    ["M. Müller", "M. Müller"], // ü is Latin-1 outright; kept as itself
    ["J. Okonkwo", "J. Okonkwo"],
    ["N. Ærø", "N. Ærø"],
    ["S. Žižek", "S. Zizek"],
    ["A. Nuñez", "A. Nuñez"],
  ])("renders %s recognisably", (input, expected) => {
    expect(toLatin1(input)).toBe(expected);
  });

  it("never returns an empty string for a non-empty name", () => {
    for (const name of ["M. 中村", "А. Петров", "م. الأحمد", "요. 김"]) {
      const rendered = toLatin1(name);
      expect(rendered.trim().length, name).toBeGreaterThan(0);
    }
  });

  it("substitutes rather than deletes, so the row is still countable", () => {
    // Two unrepresentable characters in, two placeholders out.
    expect(toLatin1("M. 中村")).toBe("M. ??");
  });

  it("reports the loss so a caller can say so", () => {
    expect(latin1Loss("M. 中村")).toBe(true);
    expect(latin1Loss("L. Dončić")).toBe(false);
    expect(latin1Loss("M. Reyes")).toBe(false);
  });

  /**
   * The failure that started this: an athlete who is out, and absent from the
   * document a coach reads.
   */
  it("keeps every athlete in the rendered document", () => {
    const roster = ["M. Reyes", "L. Dončić", "M. 中村", "K. Walker"];
    const pdf = renderChartPdf([
      { text: "Out", style: "heading" },
      ...roster.map((name) => ({ text: name })),
    ]);

    // One text-drawing operation per athlete, plus the heading.
    const drawn = pdf.match(/Tj/g) ?? [];
    expect(drawn.length).toBe(roster.length + 1);

    expect(pdf).toContain("(L. Doncic) Tj");
    expect(pdf).toContain("(M. Reyes) Tj");
    expect(pdf).toContain("(M. ??) Tj");
  });

  it("still escapes the characters that would terminate a PDF string", () => {
    const pdf = renderChartPdf([{ text: "O'Brien (left) \\ right" }]);
    expect(pdf).toContain("O'Brien \\(left\\) \\\\ right");
  });

  it("emits only bytes a latin1 buffer can hold", () => {
    const pdf = renderChartPdf([{ text: "M. 中村 · Dončić · 🙂" }]);
    for (const ch of pdf) {
      expect(ch.codePointAt(0)!, `0x${ch.codePointAt(0)!.toString(16)}`).toBeLessThan(256);
    }
  });
});
