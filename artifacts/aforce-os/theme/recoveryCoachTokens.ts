/**
 * RECOVERY COACH TOKENS — the spec's semantic `af.*` design tokens for the
 * full-screen Recovery Coach mode, centralized so no raw color is scattered
 * through the screen (spec §3).
 *
 * `red` resolves to the canonical AForce Signal Red (`Colors.accent.primary`,
 * #C1281B) per brand v2.2.0 and the spec's own instruction to replace its
 * temporary #FF2B1C with the approved brand red before release. This is
 * deliberately NOT the DEPLETED state red (#FF2800), which is owned by the
 * off-limits statusColor.ts and carries a "depleted" meaning. The dim/hairline
 * atmospheric reds are that same Signal Red at low alpha (rgb 193,40,27).
 *
 * The near-black canvas/surface values are the spec's focused-mode field — a
 * touch deeper than the brand's Cinematic Black to read as a private command
 * surface. Kept here as tokens, not inlined, so a later brand pass can retune
 * them in one place.
 */
import { Colors } from './colors';

export const RecoveryCoachTokens = {
  canvas: '#050506', //          root background
  surface: '#0D0E10', //         sheets + expanded details
  surfaceRaised: '#141518', //   elevated interactive surface
  textPrimary: '#F4F2ED', //     command, timer, button text
  textSecondary: '#A6A5A1', //   instructions + status
  textTertiary: '#727378', //    micro-labels + inactive detail
  divider: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.16)',
  red: Colors.accent.primary, //          #C1281B — AForce Signal Red (spec af.red, resolved)
  redDim: 'rgba(193,40,27,0.16)', //      pulse atmosphere (Signal Red @ 0.16)
  redHairline: 'rgba(193,40,27,0.34)', // pulse ring (Signal Red @ 0.34)
} as const;

export type RecoveryCoachToken = keyof typeof RecoveryCoachTokens;
