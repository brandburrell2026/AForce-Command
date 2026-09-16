/**
 * Athlete chart export — a minimal, dependency-free PDF writer.
 *
 * Phase 4 acceptance: "a full athlete chart exports to PDF with an audit
 * trail attached." The brief's §3 asks for justification before any new
 * runtime dependency, and a text-only chart does not justify one: this writes
 * a valid PDF 1.4 document with the base-14 Helvetica font, which every
 * reader supports without an embedded font programme.
 *
 * Deliberately plain. No images, no tables, no styling beyond two sizes and
 * page breaks. A chart export is evidence, not a brochure, and a format a
 * reviewer can open in anything is worth more than a prettier one.
 *
 * THE AUDIT TRAIL IS PART OF THE DOCUMENT, not a sidecar. A chart that can be
 * separated from its access log is a chart whose history can be quietly lost.
 */

export interface ChartLine {
  text: string;
  /** `heading` renders larger; `meta` renders smaller. */
  style?: "heading" | "body" | "meta";
}

const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const LINE_HEIGHT = 15;
const BODY_SIZE = 10;
const HEADING_SIZE = 14;
const META_SIZE = 8;
const MAX_CHARS_PER_LINE = 92;

/** Escape the three characters that terminate a PDF string. */
function escapePdfText(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Drop anything outside printable Latin-1.
 *
 * WinAnsiEncoding cannot represent it, and a chart is evidence: a mangled
 * glyph in a medical record is worse than an honest omission.
 */
function toLatin1(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) current = word;
    else if (current.length + 1 + word.length <= max) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function sizeFor(style: ChartLine["style"]): number {
  if (style === "heading") return HEADING_SIZE;
  if (style === "meta") return META_SIZE;
  return BODY_SIZE;
}

/** Split the document into pages of drawing operations. */
function paginate(lines: readonly ChartLine[]): string[][] {
  const usable = PAGE_HEIGHT - MARGIN * 2;
  const pages: string[][] = [];
  let page: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  for (const line of lines) {
    const size = sizeFor(line.style);
    const chars = Math.floor((MAX_CHARS_PER_LINE * BODY_SIZE) / size);
    for (const piece of wrap(toLatin1(line.text), chars)) {
      if (y - LINE_HEIGHT < PAGE_HEIGHT - MARGIN - usable) {
        pages.push(page);
        page = [];
        y = PAGE_HEIGHT - MARGIN;
      }
      page.push(
        `BT /F1 ${size} Tf ${MARGIN} ${y.toFixed(2)} Td (${escapePdfText(piece)}) Tj ET`,
      );
      y -= LINE_HEIGHT;
    }
  }
  pages.push(page);
  return pages;
}

/**
 * Render lines to a PDF document.
 *
 * Returns the raw bytes as a latin1 string so the caller can send it without
 * a Buffer dependency in the signature; every byte written here is < 256.
 */
export function renderChartPdf(lines: readonly ChartLine[]): string {
  const pages = paginate(lines);
  const objects: string[] = [];

  // 1 catalog, 2 pages tree, 3 font, then per page: content stream + page.
  const pageObjectIds = pages.map((_, i) => 4 + i * 2 + 1);
  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  pages.forEach((ops, i) => {
    const contentId = 4 + i * 2;
    const pageId = contentId + 1;
    const stream = ops.join("\n");
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    const body = objects[id];
    if (body === undefined) continue;
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  const count = objects.length;
  pdf += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id += 1) {
    const offset = offsets[id] ?? 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

export interface ChartExportInput {
  programId: string;
  athleteUserId: string;
  exportedByUserId: string;
  exportedAt: string;
  questionnaires: { forDate: string; answers: Record<string, number>; submittedAt: string }[];
  screenings: {
    cleared: boolean;
    items: Record<string, boolean>;
    notes: string | null;
    screenedByUserId: string;
    screenedAt: string;
  }[];
  /** EVERY version, not just the current text. */
  noteVersions: {
    rootId: number;
    version: number;
    amendmentReason: string | null;
    authorUserId: string;
    createdAt: string;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
  }[];
  auditTrail: {
    actorUserId: string;
    actorRole: string;
    resource: string;
    action: string;
    occurredAt: string;
  }[];
}

/** Compose the chart as lines. Separated from rendering so it is testable. */
export function buildChartLines(input: ChartExportInput): ChartLine[] {
  const lines: ChartLine[] = [
    { text: "AForce OS — Athlete chart", style: "heading" },
    { text: `Athlete ${input.athleteUserId} · Program ${input.programId}`, style: "meta" },
    { text: `Exported ${input.exportedAt} by ${input.exportedByUserId}`, style: "meta" },
    {
      text:
        "This chart records observations and staff decisions. It is not a diagnosis, and " +
        "clinical decisions remain with licensed staff.",
      style: "meta",
    },
    { text: " " },
    { text: "MORNING QUESTIONNAIRES", style: "heading" },
  ];

  if (input.questionnaires.length === 0) lines.push({ text: "None submitted." });
  for (const q of input.questionnaires) {
    const answers = Object.entries(q.answers)
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ");
    lines.push({ text: `${q.forDate} — ${answers}` });
    lines.push({ text: `submitted ${q.submittedAt}`, style: "meta" });
  }

  lines.push({ text: " " }, { text: "PRE-PRACTICE SCREENING", style: "heading" });
  if (input.screenings.length === 0) lines.push({ text: "None recorded." });
  for (const s of input.screenings) {
    lines.push({ text: `${s.screenedAt} — ${s.cleared ? "cleared" : "not cleared"} by ${s.screenedByUserId}` });
    const items = Object.entries(s.items)
      .map(([k, v]) => `${k} ${v ? "yes" : "no"}`)
      .join(" · ");
    if (items) lines.push({ text: items, style: "meta" });
    if (s.notes) lines.push({ text: s.notes });
  }

  lines.push({ text: " " }, { text: "NOTES — EVERY VERSION", style: "heading" });
  if (input.noteVersions.length === 0) lines.push({ text: "No notes filed." });
  for (const n of input.noteVersions) {
    lines.push({
      text: `Note ${n.rootId} · version ${n.version} · ${n.authorUserId} · ${n.createdAt}`,
      style: "meta",
    });
    if (n.amendmentReason) lines.push({ text: `Amendment reason: ${n.amendmentReason}` });
    if (n.subjective) lines.push({ text: `S: ${n.subjective}` });
    if (n.objective) lines.push({ text: `O: ${n.objective}` });
    if (n.assessment) lines.push({ text: `A: ${n.assessment}` });
    if (n.plan) lines.push({ text: `P: ${n.plan}` });
    lines.push({ text: " " });
  }

  lines.push({ text: "ACCESS AUDIT TRAIL", style: "heading" });
  if (input.auditTrail.length === 0) lines.push({ text: "No recorded access." });
  for (const a of input.auditTrail) {
    lines.push({
      text: `${a.occurredAt} — ${a.actorUserId} (${a.actorRole}) ${a.action} ${a.resource}`,
      style: "meta",
    });
  }

  return lines;
}
