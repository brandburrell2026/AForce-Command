/**
 * AForce voice catalog — the four ElevenLabs voices the user can pick
 * from in Profile. These are platform "premade" voices (the always-free
 * stock catalog) so they're available on every ElevenLabs account
 * without needing a paid Voice Library subscription. IDs are stable.
 *
 * Why these four:
 *   - We want a coach persona that's confident and clear over a phone
 *     speaker mid-workout. Premade voices are tuned by the platform for
 *     narrator-grade clarity, which matches the AForce one-shot command
 *     style much better than the more conversational community voices.
 *   - Two men + two women so the user can pick the energy that lands
 *     for them: dominant/firm vs deep/energetic on the male side,
 *     mature/reassuring vs knowledgeable/professional on the female side.
 *   - Picked from the user's verified ElevenLabs account inventory so
 *     the picker never hits a 404 or a paid_plan_required upstream.
 */

export type VoiceGender = 'male' | 'female';

export interface AForceVoice {
  /** ElevenLabs voice_id used on the API. */
  id: string;
  /** Friendly display name in the picker. */
  label: string;
  /** Short coach-vibe description shown under the name. */
  description: string;
  gender: VoiceGender;
}

export const AFORCE_VOICES: AForceVoice[] = [
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    label: 'Adam',
    description: 'Dominant, firm — push mode authority.',
    gender: 'male',
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    label: 'Charlie',
    description: 'Deep, confident, energetic — pre-game hype.',
    gender: 'male',
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    label: 'Sarah',
    description: 'Mature, reassuring, confident — recovery & breathwork.',
    gender: 'female',
  },
  {
    id: 'XrExE9yKIg1WjnnlVkGX',
    label: 'Matilda',
    description: 'Knowledgeable, professional — focused coach.',
    gender: 'female',
  },
];

/** Default voice (Adam) — used when nothing has been selected yet. */
export const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

export function findVoice(voiceId: string | null | undefined): AForceVoice | null {
  if (!voiceId) return null;
  return AFORCE_VOICES.find((v) => v.id === voiceId) ?? null;
}
