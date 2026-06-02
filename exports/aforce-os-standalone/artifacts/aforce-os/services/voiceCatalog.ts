/**
 * AForce Coach voice catalog.
 *
 * The four signature AForce coaches. Each coach drives labels,
 * notifications, overlays, and command identity across the OS. The
 * ElevenLabs voice IDs are kept stable from the previous catalog so
 * the existing streaming pipeline keeps working without re-binding —
 * the coach identity is purely a re-label on top.
 *
 * Coach roster (per AForce OS Master Update Spec):
 *   - Coach Rock  — Julius Burrell. Commanding, identity-driven,
 *                   faith-based. Push mode authority.
 *   - Coach BB    — Brandon Burrell. Precision, data, execution.
 *                   Technical authority.
 *   - Coach Surge — High energy, explosive, celebratory.
 *                   Push and ignite.
 *   - Coach Sage  — Calm, recovery-focused, grounded.
 *                   Reset and breathe.
 *
 * NOTE on ElevenLabs IDs: These IDs are temporary holds — the four
 * stock ElevenLabs voices that previously powered Adam/Charlie/
 * Matilda/Sarah now back the four coaches so the demo continues to
 * speak. The signature AForce coach voices replace them in a later
 * pass alongside the full Voice Engine refresh.
 */

export type VoiceGender = 'male' | 'female';

/** Coach archetype — drives orb intensity, command cadence, copy tone. */
export type CoachArchetype = 'push' | 'precision' | 'ignite' | 'recovery';

export interface AForceVoice {
  /** Stable coach id used across labels, notifications, and persistence. */
  id: string;
  /** ElevenLabs voice_id used on the API for streamed playback. */
  voiceId: string;
  /** Display name in the picker — always rendered prefixed with "Coach". */
  label: string;
  /** Persona archetype — read by command/overlay code. */
  archetype: CoachArchetype;
  /** Short coach-vibe description shown under the name in the picker. */
  description: string;
  gender: VoiceGender;
}

export const AFORCE_VOICES: AForceVoice[] = [
  {
    id: 'rock',
    voiceId: 'pNInz6obpgDQGcFmaJgB',
    label: 'Rock',
    archetype: 'push',
    description: 'Commanding, identity-driven — push mode authority.',
    gender: 'male',
  },
  {
    id: 'bb',
    voiceId: 'IKne3meq5aSn9XLyUdCD',
    label: 'BB',
    archetype: 'precision',
    description: 'Precision, data, execution — technical authority.',
    gender: 'male',
  },
  {
    id: 'surge',
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    label: 'Surge',
    archetype: 'ignite',
    description: 'High energy, explosive, celebratory — push and ignite.',
    gender: 'female',
  },
  {
    id: 'sage',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    label: 'Sage',
    archetype: 'recovery',
    description: 'Calm, recovery-focused, grounded — reset and breathe.',
    gender: 'female',
  },
];

/** Default coach (Rock) — used when nothing has been selected yet. */
export const DEFAULT_VOICE_ID = 'rock';

/** Resolve a coach by either its stable id ('rock') or its ElevenLabs voiceId. */
export function findVoice(voiceId: string | null | undefined): AForceVoice | null {
  if (!voiceId) return null;
  return (
    AFORCE_VOICES.find((v) => v.id === voiceId) ??
    AFORCE_VOICES.find((v) => v.voiceId === voiceId) ??
    null
  );
}

/** Resolve the ElevenLabs streaming id for a coach id (or pass-through if already an EL id). */
export function elevenLabsIdFor(coachOrVoiceId: string | null | undefined): string | null {
  const coach = findVoice(coachOrVoiceId);
  return coach ? coach.voiceId : null;
}
