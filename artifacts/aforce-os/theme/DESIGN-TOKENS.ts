/**
 * One Breath preparation tokens (the Seal flow: MomentPreparationScreen and
 * its parts).
 *
 * These used to be a second, independent palette carrying retired values: the
 * old red #C1281B, an old blue #2F5BFF, ink #0D0D0D, bone #F5F0E8, a navy
 * "midnight" and an orange "sun" orb. The Master Brief (2026-11-05) retired
 * all of them: "Orange anywhere ... is retired", "The daytime sun orb is
 * retired", and no navy.
 *
 * The names stay so the six files that use them do not all have to change at
 * once, but every colour here now comes from the canonical tokens in
 * `afTokens.ts`. Do not add a colour literal to this file.
 */
import { af, afOrb } from './afTokens';

export const preparationTokens = {
  ink: af.canvas,
  panel: af.surface,
  bone: af.textPrimary,
  muted: af.textSecondary,
  /** Tertiary text and mono labels (the prototype's `dim`). */
  dim: af.textTertiary,
  red: af.red,
  blue: af.blue,
  onBlue: af.onBlue,
  blueHi: af.blueText,
  rule: af.divider,
  /** The One Breath orb ramp. Signal Red, never orange. */
  oneBreath: afOrb.oneBreath,
  /** The Social orb ramp. Proof Blue. */
  social: afOrb.social,
  holdMs: 1200, breathMs: 6000, quietDimMs: 8000,
  headline: { fontFamily: 'Inter_600SemiBold', fontSize: 34, lineHeight: 39, letterSpacing: -0.85 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 17, lineHeight: 25 },
  eyebrow: { fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, letterSpacing: 1.8 },
} as const;
