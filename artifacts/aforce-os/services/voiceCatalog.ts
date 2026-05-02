/**
 * AForce voice catalog — the four ElevenLabs voices the user can pick
 * from in Profile. These are the platform's permanent stock voices, so
 * they're available on every ElevenLabs account (free or paid) without
 * any per-account voice creation. IDs are stable.
 *
 * Why these four:
 *   - We want a coach persona that's confident and clear over a phone
 *     speaker mid-workout. Stock voices like "Adam" / "Rachel" have
 *     been tuned by the platform for narrator-grade clarity, which
 *     matches the AForce one-shot command style much better than the
 *     more conversational community voices.
 *   - Two men + two women so the user can pick the energy that lands
 *     for them: deeper / older vs younger / energetic on each side.
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
    description: 'Deep, mature — calm authority.',
    gender: 'male',
  },
  {
    id: 'TxGEqnHWrfWFTfGW9XjX',
    label: 'Josh',
    description: 'Younger, energetic — pre-game hype.',
    gender: 'male',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    label: 'Rachel',
    description: 'Calm, focused — recovery & breathwork.',
    gender: 'female',
  },
  {
    id: 'AZnzlk1QvdT5XeGgwwlbN',
    label: 'Domi',
    description: 'Strong, driven — push through the next set.',
    gender: 'female',
  },
];

/** Default voice (Adam) — used when nothing has been selected yet. */
export const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

export function findVoice(voiceId: string | null | undefined): AForceVoice | null {
  if (!voiceId) return null;
  return AFORCE_VOICES.find((v) => v.id === voiceId) ?? null;
}
