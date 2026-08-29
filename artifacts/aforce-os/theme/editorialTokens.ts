/**
 * AFORCE EDITORIAL OS — foundation tokens (E1, founder sign-off 2026-08-29).
 *
 * The visual constitution is the approved "AForce Editorial OS Specification
 * v1" (docs/aforce-editorial-os-spec-v1.html): B — Cinematic Black is the
 * core OS stock; A — Paper is the Feature register; the four C signatures
 * (pressure field, И state language, node spine, paper-within-black stock
 * turn) are canon with their usage law. This module is ADDITIVE — nothing in
 * af.* / Colors / Typography changes, and no production surface consumes
 * these tokens until its own E-step PR is accepted (locked by
 * components/__tests__/editorialFoundation.test.ts's isolation sweep).
 *
 * afType RULING (approved in principle with Editorial OS v1): the deck's
 * display voice — Inter, sentence case, tight tracking — is the target.
 * Micro-caps/mono are reserved for furniture, metadata, evidence and
 * instrumentation. No indiscriminate all-caps; no luxury-serif
 * substitution. Weight note: the deck's own display weight is Inter 700 —
 * E1 deliberately loads NO new font assets.
 *
 * Accessibility outranks visual fidelity (founder ruling): every role here
 * scales with Dynamic Type (nothing in the editorial layer may set
 * allowFontScaling={false}); tracked micro roles keep ≥9pt floors; the
 * contrast pairs below are WCAG-checked by the foundation lock.
 */
import { Colors } from './colors';
import { Typography } from './typography';

/** Stocks — the two grounds. Never mixed on one screen outside the stock turn. */
export const edStock = {
  /** B core — the OS ground. Same value as the brand Cinematic Black. */
  black: '#0D0D0D',
  /** A Feature register — the deck's working paper. */
  paper: '#E4E0D8',
  /** Slightly lifted paper for plates on paper (deck slide texture). */
  paperRaised: '#EBE8E1',
  /** Slightly lifted black for plates on black (scan viewfinder). */
  blackRaised: '#161512',
} as const;

/** Inks — statement + quiet voices per stock. */
export const edInk = {
  /** Primary copy on black. */
  ivory: '#EDEAE3',
  /** Primary copy on paper. */
  black: '#1A1815',
  /** Furniture/captions/quiet statements on black (AA on #0D0D0D). */
  quietOnBlack: '#8D897F',
  /** Furniture/captions/quiet statements on paper (AA on #E4E0D8). */
  quietOnPaper: '#66625A',
  /** De-emphasized/disabled on black — decorative only, never sole carrier. */
  dimOnBlack: '#57534A',
} as const;

/** Accents — exactly two, with fixed meanings. */
export const edAccent = {
  /**
   * Identity + emphasis: the red word, kickers, eyebrows, live nodes, the И.
   * Single-sourced from the frozen brand Signal Red.
   */
  red: Colors.accent.primary,
  /**
   * The committed/clear state ONLY (deck semantics: "Lock in." /
   * "membership" / "national stage"). Rare by rule; never the sole carrier
   * of state.
   */
  lockIn: '#4A5FD0',
} as const;

/** Rules — hairlines replace cards. */
export const edRule = {
  onBlack: '#2B2925',
  onPaper: '#C7C2B6',
} as const;

/** Verified positive marks (checklist ticks) reuse the brand PEAK green. */
export const edPositive = Colors.states.PEAK.primary;

/**
 * Rhythm — the editorial layer composes on the existing 4pt Spacing scale;
 * these are the semantic beats the reference screens use.
 */
export const edRhythm = {
  /** Gap under furniture rows (masthead → content). */
  afterFurniture: 12,
  /** Gap around statements. */
  aroundStatement: 16,
  /** Hairline block margin. */
  aroundRule: 14,
  /** Minimum interactive target (pt) — the accessibility floor. */
  minTarget: 44,
} as const;

type EdTypeRole = {
  fontFamily: string;
  fontSize: number;
  lineHeight?: number;
  fontWeight?: '400' | '500' | '600' | '700';
  letterSpacing?: number;
};

/**
 * edType — the approved editorial type roles. Statements are Inter 700,
 * sentence case, tightly tracked (tracking here is absolute pt at the
 * role's size ≈ −2%, numerals −4%). caption/micro are the ONLY roles a
 * consumer may render in caps, and they carry the mono furniture voice.
 */
export const edType: Record<string, EdTypeRole> = {
  /** Oversized display statement (covers). */
  display: { fontFamily: Typography.fonts.bold, fontSize: 44, lineHeight: 48, letterSpacing: -0.9 },
  /** Screen statement. */
  statement: { fontFamily: Typography.fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  /** The command line — the one action's voice. */
  command: { fontFamily: Typography.fonts.bold, fontSize: 22, lineHeight: 25, letterSpacing: -0.35 },
  /** Confirm line ("I'm ready."). */
  confirm: { fontFamily: Typography.fonts.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.2 },
  /** Editorial numeral — hero (the pressure field's 69). */
  numberHero: { fontFamily: Typography.fonts.bold, fontSize: 68, lineHeight: 68, letterSpacing: -2.7 },
  /** Editorial numeral — feature pull-stats. */
  numberFeature: { fontFamily: Typography.fonts.bold, fontSize: 44, lineHeight: 44, letterSpacing: -1.7 },
  /** Body copy. */
  body: { fontFamily: Typography.fonts.regular, fontSize: 16, lineHeight: 25 },
  /** Quiet body (explanations on quiet ink). */
  bodySmall: { fontFamily: Typography.fonts.regular, fontSize: 14, lineHeight: 21 },
  /** Furniture caption — tracked mono; the larger of the two caps voices. */
  caption: { fontFamily: Typography.roles.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.7 },
  /** Furniture micro — folios, pills, node states. Floor of the system. */
  micro: { fontFamily: Typography.roles.mono, fontSize: 9, lineHeight: 13, letterSpacing: 1.8 },
  /** Live/tabular data (signals, fit rows). */
  data: { fontFamily: Typography.roles.metric, fontSize: 12, lineHeight: 17, letterSpacing: 0.6 },
} as const;

export type EdStockName = 'black' | 'paper';

/** Ink resolution for a stock — primitives use this instead of per-prop plumbing. */
export function edInkFor(stock: EdStockName): { primary: string; quiet: string; rule: string; raised: string } {
  return stock === 'paper'
    ? { primary: edInk.black, quiet: edInk.quietOnPaper, rule: edRule.onPaper, raised: edStock.paperRaised }
    : { primary: edInk.ivory, quiet: edInk.quietOnBlack, rule: edRule.onBlack, raised: edStock.blackRaised };
}
