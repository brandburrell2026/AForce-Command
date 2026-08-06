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
import { Spacing, Radii, Shadows } from './spacing';

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
  red: Colors.accent.primary, //          #C1281B — AForce Signal Red (FILLS only)
  onRed: '#FFFFFF', //                    text/icons on af.red (AA-verified)
  // Signal Red is too dark for TEXT/icons on the dark surfaces (fails WCAG AA:
  // ~3.1:1). redText is a lightened Signal Red for red text/icon color ONLY —
  // AA-clean on canvas/surface/surfaceRaised (5.30/4.98/4.68:1). Fills, borders,
  // dots and pill backgrounds keep `red`. Brand fill red stays frozen #C1281B.
  redText: '#E4564A', //                  red text/icons on dark surfaces (AA)
  redDim: 'rgba(193,40,27,0.16)', //      red atmosphere / selected background
  redHairline: 'rgba(193,40,27,0.34)', // progress + ambient rings

  // Guardian — #8B5CF6 (rgb 139,92,246). RATIFIED as a named af.* brand token
  // per founder Ruling E (RC-2, 2026-08-05): the value already shipped as the
  // Guardian tier/feature accent (subscription plan cards, Profile's Guardian
  // flag rows + phase card, Store's Guardian flavor tint, flavor/product data)
  // via a repeated raw literal at 8+ call sites — this gives it one source of
  // truth instead. Bound to the pre-existing `Colors.guardian.primary` so
  // there is still a single canonical definition, matching the
  // `red: Colors.accent.primary` pattern above. NOT a semantic status color
  // (see green/amber/cyan below) — like `red`, it names a specific brand
  // feature (Guardian), not a hydration state.
  guardian: Colors.guardian.primary, //   #8B5CF6 — Guardian tier/feature accent
  // The three alpha variants below replace call-site `${'#8B5CF6'}XX` hex-
  // suffix concatenation hacks BYTE-FOR-BYTE (RC-2 Ruling E requires
  // byte-identical rendered color — no new dim/hairline design here, just
  // the three distinct alphas that had already shipped, precomputed so nothing
  // renders differently). Each decimal is chosen so the RN/CSS color parser's
  // Math.round(alpha*255) reproduces the exact original hex-suffix byte:
  //   guardianDim       0.1020 -> round(26.01) = 26 (0x1A) — icon-tint bg
  //   guardianTint      0.1333 -> round(33.99) = 34 (0x22) — selected bg
  //   guardianHairline  0.3333 -> round(84.99) = 85 (0x55) — border
  guardianDim: 'rgba(139,92,246,0.1020)', //      icon-tint background (was `${'#8B5CF6'}1A`)
  guardianTint: 'rgba(139,92,246,0.1333)', //     selected/active background (was `${'#8B5CF6'}22`)
  guardianHairline: 'rgba(139,92,246,0.3333)', // border emphasis (was `${'#8B5CF6'}55`)

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
  // Bold counterpart to `tab` — small tracked/emphasized inline labels (trend
  // arrows, verbs, deltas) that need Inter Bold rather than Medium at the
  // same micro scale. Added for LiveStatusLine's af.* migration (RC-1
  // Wave-1 r2, item 5) since no existing afType entry covers bold at 11px.
  microLabel: { fontFamily: Typography.fonts.bold, fontSize: 11, lineHeight: 14 },
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

// ─── Opacity scale (spec §3.1) ───────────────────────────────────────────────
// Canonical alphas for translucent fills/borders/atmospheres. These replace the
// call-site `${color}NN` hex-suffix concatenation anti-pattern: instead of
// `${af.green}55`, write `withAlpha(af.green, afAlpha.a34)`. Numeric alphas are
// not color literals, so they are outside the raw-color drift ratchet.
export const afAlpha = {
  a06: 0.06,
  a08: 0.08,
  a12: 0.12,
  a16: 0.16,
  a24: 0.24,
  a34: 0.34,
  a50: 0.5,
  a67: 0.67,
} as const;

/**
 * withAlpha(hexColor, alpha) → 'rgba(r,g,b,alpha)'.
 *
 * STRICT, PREDICTABLE INPUT CONTRACT (fails loudly on misuse — inputs are
 * compile-time token constants, so a throw only ever fires in dev/test):
 *   - `hexColor` MUST be a solid `#RGB` or `#RRGGBB` hex literal (a theme
 *     token). An already-translucent `rgba()`, an `#RRGGBBAA`, a named color,
 *     or any non-string throws a TypeError — this helper adds alpha to an
 *     opaque color, it does not re-alpha an existing one.
 *   - `alpha` MUST be a finite number in the inclusive range [0, 1]. Anything
 *     else (NaN, Infinity, <0, >1, non-number) throws a RangeError. Out-of-range
 *     is NOT clamped: silent degradation would hide the bug.
 */
export function withAlpha(hexColor: string, alpha: number): string {
  if (
    typeof hexColor !== 'string' ||
    !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexColor)
  ) {
    throw new TypeError(
      `withAlpha: expected a solid #RGB or #RRGGBB hex color, received ${JSON.stringify(hexColor)}`,
    );
  }
  if (typeof alpha !== 'number' || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError(
      `withAlpha: alpha must be a finite number in [0,1], received ${JSON.stringify(alpha)}`,
    );
  }
  let h = hexColor.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Elevation (spec §3.3) ───────────────────────────────────────────────────
// Directly-spreadable RN ViewStyle fragments that pair a surface + hairline
// border + a NEUTRAL (black) cross-platform shadow. Every key below is a valid
// RN ViewStyle property on BOTH platforms: `backgroundColor` / `borderColor` /
// `borderWidth` are universal; the spread `Shadows.card` supplies iOS
// `shadow{Color,Offset,Opacity,Radius}` AND Android `elevation`, so a raised
// recipe casts a shadow on both. `flat` is intentionally shadowless (surface +
// hairline only). Usage: `<View style={afElev.raised} />`.
export const afElev = {
  flat: {
    backgroundColor: af.surface,
    borderColor: af.divider,
    borderWidth: afLayout.hairline,
  },
  raised: {
    backgroundColor: af.surfaceRaised,
    borderColor: af.border,
    borderWidth: afLayout.hairline,
    ...Shadows.card,
  },
  sheet: {
    backgroundColor: af.canvasElevated,
    borderColor: af.borderStrong,
    borderWidth: afLayout.hairline,
    ...Shadows.card,
  },
  modal: {
    backgroundColor: af.surface,
    borderColor: af.borderStrong,
    borderWidth: afLayout.hairline,
    ...Shadows.card,
  },
} as const;

// ─── Motion (spec §12) ───────────────────────────────────────────────────────
// Plain data — durations in ms, translate in pt, easing as cubic-bezier tuples.
// Every motion MUST have a reduced/static alternative at the call site (§11/§12);
// these tokens describe the animated register only.
//
// ─── The six named patterns (RC-1 Wave-2A motion-language proposal) ─────────
// Every animated surface in the app is an instance of ONE of these six. Two
// rules are non-negotiable and apply to every pattern below without
// exception: (1) a `useReducedMotion` gate with a static alternative — never
// Reanimated's per-call `reduceMotion` option alone, so the whole app reads
// one signal (see `hooks/useReducedMotion.ts`); (2) `cancelAnimation` in the
// effect's cleanup for anything driven by `withRepeat`, so no shared value
// keeps animating on the UI thread past unmount.
//
//   1. ENTER    — a surface (sheet, overlay, card) arriving on screen.
//                 opacity 0→1 (+ short translateY) at `durations.standard`
//                 or `.entrance`, `easing.standardOut`. Reference:
//                 components/ScoreBreakdownSheet.tsx (sheet rise-in).
//   2. EXIT     — the same surface leaving. Faster than its own enter
//                 (`durations.fast`/`.selection`), no bounce, native easing
//                 (`Easing.in`) — never `standardOut` in reverse. Reference:
//                 components/DataBehindThisSheet.tsx (dismiss fade).
//   3. EMPHASIZE — a momentary call-out on an already-visible element: a
//                 press-scale, a value pop, a selection tone change.
//                 `durations.fast` + `scale.pressed`, or a spring for a
//                 tactile release. Reference:
//                 components/ui/AFMotionPressable.tsx (press-scale).
//   4. TRANSITION — content swapping in place (a step, a tab, a re-keyed
//                 card) without the container itself entering/exiting.
//                 `durations.standard`/`.slow` cross-fade + short rise.
//                 Reference: components/voiceCheckIn/VoiceCheckInOverlay.tsx
//                 (`Fade`, step-to-step).
//   5. PROGRESS  — a value filling toward a target: a bar, a ring, a
//                 count-up. Duration scales with the value change rather
//                 than a fixed token; `easing.standardOut` or
//                 `Easing.out(Easing.cubic)`. Reference:
//                 components/ui/AFReadinessArc.tsx (score ring fill).
//   6. CELEBRATE — a hero, low-frequency moment (cycle complete, a
//                 milestone). The only tier allowed to run longer than
//                 `durations.slow` and to compose multiple springs/ripples.
//                 `durations.cinematic` for the reveal beat. Reference:
//                 components/CycleSuccessOverlay.tsx (ripple + count-up).
//
// A `withRepeat` ambient loop (a pulse, a breathing ring, a Ken-Burns pan) is
// not a seventh pattern — it is PROGRESS or EMPHASIZE running unbounded, and
// is held to the same two non-negotiable rules above. Reference for the
// gate+cleanup shape: WhoopSnapshotCard's connection-dot gate.
export const afMotion = {
  durations: {
    fast: 120, //        120ms — press-scale, tab dot; the quickest register
    selection: 150, //   120–180ms — tone/opacity change, no bounce
    standard: 220, //    220ms — the default UI transition
    entrance: 260, //    220–320ms — opacity + short translate, ease-out
    sheet: 300, //       native sheet spring
    slow: 360, //        360ms — larger content transitions
    cinematic: 700, //   550–800ms — hero reveals (arc draw-in, count-up window)
    pulse: 3200, //      recovery pulse — extremely subtle ring scale/opacity
  },
  entranceTranslateY: 10, // 8–12pt entrance rise
  // Press-scale for interactive surfaces (E3). rest = 1; pressed compresses
  // slightly. A static (reduced-motion) surface simply stays at `rest`.
  scale: {
    rest: 1,
    pressed: 0.97,
  },
  easing: {
    standardOut: [0.22, 1, 0.36, 1] as const, //   ease-out
    standardInOut: [0.4, 0, 0.2, 1] as const, //    symmetric
  },
  // The dominant sheet/card entrance spring (RC-1 Wave-2A §3): the exact
  // { damping, stiffness } pair independently repeated at 5 of the 15
  // withSpring call sites audited (DataBehindThisSheet, ScoreBreakdownSheet,
  // OnboardingOverlay, SocialModeSheet, ScanAICoachCard — all a translateY
  // sheet/card rise-in paired with an opacity ENTER). Springs are more
  // perceptually sensitive than a duration number, so only EXACT-config call
  // sites were migrated onto this token — near matches are left as
  // deliberately-tuned bespoke springs (see PR body for the full holdout
  // list + rationale).
  springs: {
    standard: { damping: 18, stiffness: 220 },
  },
} as const;

/**
 * Dynamic-type clamp for LARGE DISPLAY numerals only (P-C). Body/label text keeps
 * the OS's full Dynamic-Type scaling for accessibility; the oversized display
 * numbers (readiness score, weekly average, metric values) are clamped so extreme
 * text sizes can't blow out the ring / hero layout. Pass as
 * `maxFontSizeMultiplier` on those Text nodes; never apply to body copy.
 */
export const AF_MAX_DISPLAY_FONT_SCALE = 1.35;

export type AfColorToken = keyof typeof af;
export type AfTypeToken = keyof typeof afType;
