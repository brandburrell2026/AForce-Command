/**
 * SOAP note templates and the draft rules behind the entry screen.
 *
 * The 60-second target is a device measurement and is not tested here. What
 * IS tested is the property the target depends on: a template fills the
 * scaffolding in one tap, and scaffolding alone can never be filed as a note.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  NOTE_TEMPLATES,
  draftFromTemplate,
  hasContent,
  templateById,
  toSubmission,
} from "../trainerNoteTemplates";

const screen = readFileSync(
  join(__dirname, "..", "..", "screens", "TrainerNoteEntryScreen.tsx"),
  "utf8",
);
const screenCode = screen.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("templates prompt, they do not conclude", () => {
  it("offers a blank option first", () => {
    expect(NOTE_TEMPLATES[0]!.id).toBe("blank");
    expect(draftFromTemplate(NOTE_TEMPLATES[0]!)).toEqual({
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
    });
  });

  it("never pre-writes an assessment", () => {
    // A template that states a conclusion is the system making a clinical
    // statement. Every non-blank assessment must end as an open prompt.
    for (const t of NOTE_TEMPLATES) {
      if (t.id === "blank") continue;
      expect(t.assessment.trim().endsWith(":")).toBe(true);
    }
  });

  it("uses no diagnostic or predictive language", () => {
    const banned = [
      "diagnos", "dehydrated", "heat stroke", "injury", "predict", "risk of",
      "cleared to play", "medical eval",
    ];
    for (const t of NOTE_TEMPLATES) {
      const text = `${t.label} ${t.subjective} ${t.objective} ${t.assessment} ${t.plan}`.toLowerCase();
      for (const word of banned) expect(text).not.toContain(word);
    }
  });

  it("resolves by id and fails closed on an unknown one", () => {
    expect(templateById("heat_check")?.label).toBe("Heat check");
    expect(templateById("nope")).toBeNull();
  });
});

describe("scaffolding is never filed as content", () => {
  const template = templateById("soft_tissue")!;

  it("an untouched draft has no content", () => {
    expect(hasContent(draftFromTemplate(template), template)).toBe(false);
  });

  it("typing into any one field makes it fileable", () => {
    const draft = draftFromTemplate(template);
    draft.objective = `${template.objective}mild tenderness, full range of motion`;
    expect(hasContent(draft, template)).toBe(true);
  });

  it("submits untouched fields as null rather than as prompts", () => {
    const draft = draftFromTemplate(template);
    draft.subjective = `${template.subjective}tightness after sprints`;
    const payload = toSubmission(draft, template);
    expect(payload.subjective).toBe("Athlete reports: tightness after sprints");
    expect(payload.objective).toBeNull();
    expect(payload.assessment).toBeNull();
    expect(payload.plan).toBeNull();
  });

  it("treats whitespace-only input as empty", () => {
    const blank = templateById("blank")!;
    const draft = { subjective: "   ", objective: "", assessment: "", plan: "  " };
    expect(hasContent(draft, blank)).toBe(false);
    expect(toSubmission(draft, blank)).toEqual({
      subjective: null,
      objective: null,
      assessment: null,
      plan: null,
    });
  });
});

describe("the entry screen", () => {
  it("is one screen with all four SOAP fields and a template row", () => {
    expect(screenCode).toContain("NOTE_TEMPLATES");
    for (const label of ["S — SUBJECTIVE", "O — OBJECTIVE", "A — ASSESSMENT", "P — PLAN"]) {
      expect(screen).toContain(label);
    }
  });

  it("requires a reason before an amendment can be filed", () => {
    expect(screenCode).toContain("amendingNoteId");
    expect(screenCode).toContain("reason.trim().length > 0");
    expect(screen).toContain("AMENDMENT REASON — REQUIRED");
  });

  it("says the earlier version is kept, so amending does not read as editing", () => {
    expect(screen).toContain("The earlier version is kept");
  });

  it("carries the recommendation attribution", () => {
    expect(screen).toContain("clinical decision remains with licensed staff");
  });

  it("keeps controls at the 44pt minimum and uses no raw colour literals", () => {
    expect(screenCode).toContain("afLayout.controlMinHeight");
    expect(screenCode).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
