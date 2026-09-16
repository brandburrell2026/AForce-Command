/**
 * SOAP note templates.
 *
 * The brief's Phase 4 target is "a note takes under 60 seconds to file from a
 * phone". Typing four paragraphs on a phone does not hit that, so the entry
 * screen opens from a template and the trainer edits rather than composes.
 *
 * Every template is a PROMPT, not a conclusion. The objective and assessment
 * fields are left for the human: a template that pre-writes an assessment is
 * a system making a clinical statement, which §2.2 forbids. Prompts end with
 * a colon so a half-finished note reads as unfinished rather than as an
 * assertion nobody made.
 *
 * No diagnostic or predictive language anywhere here, and a test asserts it.
 */

export interface NoteTemplate {
  id: string;
  label: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  },
  {
    id: "soft_tissue",
    label: "Soft tissue",
    subjective: "Athlete reports: ",
    objective: "Observed: ",
    assessment: "Staff assessment: ",
    plan: "Plan: recheck ",
  },
  {
    id: "hydration_follow_up",
    label: "Hydration follow-up",
    subjective: "Athlete reports: ",
    objective: "Intake since last check: ",
    assessment: "Staff assessment: ",
    plan: "Plan: fluids and recheck at ",
  },
  {
    id: "heat_check",
    label: "Heat check",
    subjective: "Athlete reports: ",
    objective: "Conditions and observed state: ",
    assessment: "Staff assessment: ",
    plan: "Plan: cooling and recheck in ",
  },
  {
    id: "return_check",
    label: "Return check",
    subjective: "Athlete reports: ",
    objective: "Tolerance observed during: ",
    assessment: "Staff assessment: ",
    plan: "Plan: next stage when ",
  },
] as const;

export function templateById(id: string): NoteTemplate | null {
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? null;
}

export interface SoapDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export function draftFromTemplate(template: NoteTemplate): SoapDraft {
  return {
    subjective: template.subjective,
    objective: template.objective,
    assessment: template.assessment,
    plan: template.plan,
  };
}

/**
 * Is the draft worth filing?
 *
 * A draft that still holds nothing but its prompts is not a note. Comparing
 * against the template rather than checking for non-empty strings is what
 * stops "Athlete reports: " being filed as content.
 */
export function hasContent(draft: SoapDraft, template: NoteTemplate): boolean {
  const pairs: [keyof SoapDraft, string][] = [
    ["subjective", template.subjective],
    ["objective", template.objective],
    ["assessment", template.assessment],
    ["plan", template.plan],
  ];
  return pairs.some(([field, prompt]) => draft[field].trim().length > prompt.trim().length);
}

/** Trim prompts back out so an untouched field is sent as null, not as scaffolding. */
export function toSubmission(
  draft: SoapDraft,
  template: NoteTemplate,
): { subjective: string | null; objective: string | null; assessment: string | null; plan: string | null } {
  const clean = (value: string, prompt: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (trimmed === prompt.trim()) return null;
    return trimmed;
  };
  return {
    subjective: clean(draft.subjective, template.subjective),
    objective: clean(draft.objective, template.objective),
    assessment: clean(draft.assessment, template.assessment),
    plan: clean(draft.plan, template.plan),
  };
}
