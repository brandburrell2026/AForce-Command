/**
 * af.* — AForce OS premium-redesign semantic tokens (spec §3, §12).
 *
 * The redesign spec defines an `af.*` semantic token namespace. This module is
 * that namespace, built to the spec's STRUCTURE but bound to AForce's FROZEN
 * brand values — never the spec's off-brand literals — per the founder ruling
 * (2026-07-20):
 *
 *   - Red is Signal Red **#C1281B** (`Colors.accent.primary`), NOT the spec's
 *     #E41E2B. Brand v2.2.0 is frozen; the spec's red is treated as an error.
 *   - Canvas is brand Cinematic Black **#0D0D0D** (`Colors.background.primary`),
 *     NOT the spec's #050506. The deeper focused-mode field (#050506) stays owned
 *     by `recoveryCoachTokens.ts` for the full-screen command surface.
 *   - Semantic status colors bind to the existing brand state palette
 *     (PEAK/RECOVERING/BALANCED), NOT the spec's #38C46A/#F2A93B/#62B7C8.
 *
 * Everything that has a home in the existing token layer (`Colors`, `Typography`,
 * `Spacing`, `Radii`) REFERENCES it, so there is one source of truth and no
 * drift. Net-new values (surface ramp lifts, text greys, motion) are literals
 * here, chosen to satisfy the spec's WCAG 2.2 AA contrast floor (§11) — pinned
 * by `__tests__/afTokens.test.ts`.
 *
 * This module is intentionally free of any react-native / reanimated import so
 * it stays pure and unit-testable (motion is expressed as plain numbers +
 * cubic-bezier tuples; consumers map them to Reanimated/Easing at the edge).
 *
 * NOTHING consumes these tokens yet — F1 is the foundation only. Screens opt in
 * during their own flag-gated redesign PRs (S1–S5).
 */
import { Colors } from './colors';
import { Typography } from './typography';
import { Spacing, Radii } from './spacing';

// ─── Color (spec §3.1) ───────────────────────────────────────────────────────
// Surfaces ascend in lightness: canvas (root) → surface (cards) → raised
// (elevated/selected) → pressed. Anchored at the brand Cinematic Black.
export const af = {
  // Surfaces
  canvas: Colors.background.primary, //   #0D0D0D — brand Cinematic Black, app root
  canvasElevated: '#101018', //           subtle alternate page plane
  surface: '#141420', //                  cards, sheets, grouped content
  surfaceRaised: '#1A1B22', //            elevated / selected interactive surface
  surfacePressed: '#212230', //           pressed state
  canvasFocused: '#050506', //            deeper focused-mode field (Recovery Coach)

  // Text — warm-white family (matches the `bone`/#F4F2ED editorial register).
  textPrimary: '#F4F2ED', //              primary text + large values
  textSecondary: '#A6A5A1', //            supporting copy
  // Micro-labels + inactive labels. The spec's #727378 computes ~4.3:1 on the
  // canvas — below its own §11 AA 4.5:1 floor — so it is bumped to #85868C
  // (~5:1), matching the prior fix in recoveryCoachTokens.ts. a11y > exact hex.
  textTertiary: '#85868C',
  textDisabled: 'rgba(244,242,237,0.34)',

  // Lines
  divider: 'rgba(255,255,255,0.10)', //   hairlines
  border: 'rgba(255,255,255,0.16)', //    controls + card edges
  borderStrong: 'rgba(255,255,255,0.26)', // focus / high-emphasis outline

  // Brand red — FROZEN #C1281B (rgb 193,40,27). Primary action, live state,
  // critical accent. Distinct from the DEPLETED state red (#FF2800), which is
  // owned by the off-limits statusColor.ts.
  red: Colors.accent.primary, //          #C1281B — AForce Signal Red
  onRed: '#FFFFFF', //                    text/icons on af.red (AA-verified)
  redDim: 'rgba(193,40,27,0.16)', //      red atmosphere / selected background
  redHairline: 'rgba(193,40,27,0.34)', // progress + ambient rings

  // Semantic status — bound to the brand state palette. Pair every use with
  // text/icon/shape, never color alone (spec §3.1).
  green: Colors.states.PEAK.primary, //      #1FA35A — verified positive / connected
  amber: Colors.states.RECOVERING.primary, // #FFA01E — caution / pending
  cyan: Colors.states.BALANCED.primary, //    #00E5C8 — informational sensor
} as const;

// ─── Typography (spec §3.2) ──────────────────────────────────────────────────
// Ready-to-spread RN text-style fragments (family + size + line height, plus
// tracking where the spec calls for it). Scores/timers use the tabular mono
// face; editorial heroes use Archivo Black; everything else is Inter.
export const afType = {
  displayScore: { fontFamily: Typography.roles.metric, fontSize: 76, lineHeight: 80 },
  displayHero: { fontFamily: Typography.roles.display, fontSize: 44, lineHeight: 48 },
  title1: { fontFamily: Typography.fonts.semibold, fontSize: 32, lineHeight: 38 },
  title2: { fontFamily: Typography.fonts.semibold, fontSize: 26, lineHeight: 32 },
  title3: { fontFamily: Typography.fonts.semibold, fontSize: 21, lineHeight: 27 },
  body: { fontFamily: Typography.fonts.regular, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: Typography.fonts.semibold, fontSize: 17, lineHeight: 24 },
  secondary: { fontFamily: Typography.fonts.regular, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: Typography.fonts.regular, fontSize: 13, lineHeight: 18 },
  // Tracked uppercase micro-label. Spec tracking 0.14–0.18em ≈ 1.6px at 11px.
  eyebrow: { fontFamily: Typography.roles.eyebrow, fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
  tab: { fontFamily: Typography.fonts.medium, fontSize: 11, lineHeight: 14 },
} as const;

// ─── Layout: spacing, radius, sizing (spec §3.3, §4.3) ───────────────────────
// Spacing steps reference the shared 4pt scale so there is one source of truth.
export const afLayout = {
  screenPaddingX: Spacing[6], //          24 — standard phone horizontal padding
  screenPaddingXCompact: Spacing[5], //   20 — compact width (≤320pt)
  cardPadding: Spacing[5], //             20 — card internal padding (min)
  cardPaddingLarge: Spacing[6], //        24 — card internal padding (max)
  cardGap: Spacing[3], //                 12 — gap between cards
  sectionGap: Spacing[8], //              32 — gap between sections
  buttonHeight: Spacing[14], //           56 — primary button height
  controlMinHeight: 44, //                minimum touch target (iOS)
  radiusCard: 18, //                      standard card radius (spec §3.3)
  radiusHero: Radii['2xl'], //            24 — hero / focused card radius
  radiusButton: 16, //                    button radius (14–16 range)
  radiusPill: Radii.full, //              9999 — compact filters / statuses only
  hairline: 1, //                         1pt borders
  maxContentWidth: 640, //                tablet operational column max width
} as const;

// ─── Motion (spec §12) ───────────────────────────────────────────────────────
// Plain data — durations in ms, translate in pt, easing as cubic-bezier tuples.
// Every motion MUST have a reduced/static alternative at the call site (§11/§12);
// these tokens describe the animated register only.
export const afMotion = {
  durations: {
    selection: 150, //   120–180ms — tone/opacity change, no bounce
    entrance: 260, //    220–320ms — opacity + short translate, ease-out
    sheet: 300, //       native sheet spring
    pulse: 3200, //      recovery pulse — extremely subtle ring scale/opacity
  },
  entranceTranslateY: 10, // 8–12pt entrance rise
  easing: {
    standardOut: [0.22, 1, 0.36, 1] as const, //   ease-out
    standardInOut: [0.4, 0, 0.2, 1] as const, //    symmetric
  },
} as const;

export type AfColorToken = keyof typeof af;
export type AfTypeToken = keyof typeof afType;
