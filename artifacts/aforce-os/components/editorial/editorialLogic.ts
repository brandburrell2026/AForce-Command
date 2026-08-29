/**
 * Pure editorial-layer logic — kept free of react-native imports so the
 * foundation lock (components/__tests__/editorialFoundation.test.ts) can
 * exercise it in the node environment.
 */

/**
 * Truthful neutral: an unmeasured value renders as an em-dash, never as a
 * fabricated zero. NaN counts as unmeasured — a broken upstream must read
 * as "no reading", not as data.
 */
export function edNumberDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return String(value);
}

export type MirrorSplit = { before: string; glyph: string; after: string } | null;

/**
 * И state language: the LAST letter N in a state word renders as the
 * brand's mirrored N. Implemented with the real mirrored-N glyph (И,
 * U+0418) inside ONE Text run — never per-letter Text splitting and never
 * a transform, so the word wraps as a word (mid-word splitting is banned
 * by the accessibility ruling) and screen readers get the true word via
 * accessibilityLabel. Returns null when the word has no N — the word then
 * renders untouched (the signature is never forced).
 */
export function splitMirrorWord(word: string): MirrorSplit {
  const idx = word.toUpperCase().lastIndexOf('N');
  if (idx === -1) return null;
  const isLower = word[idx] === 'n';
  return {
    before: word.slice(0, idx),
    glyph: isLower ? 'и' : 'И',
    after: word.slice(idx + 1),
  };
}

/** Folio furniture: "02 / 07" from a 1-based index and a total. */
export function edFolioIndex(index: number, total: number): string {
  const pad = (n: number) => String(Math.max(0, Math.trunc(n))).padStart(2, '0');
  return `${pad(index)} / ${pad(total)}`;
}
