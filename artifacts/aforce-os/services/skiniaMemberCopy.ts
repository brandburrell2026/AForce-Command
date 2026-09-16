import type { SkinIAInternalObservation } from './skiniaObservationPipeline';
import { SKINIA_PHASE1_NON_RESULT } from './skiniaPhase1Policy';

const copy: Record<SkinIAInternalObservation['observation'], string> = {
  VISIBLE_DRYNESS: 'Your skin appears drier than your recent baseline.',
  VISIBLE_FLAKING: 'We’re seeing visible surface flaking compared with your recent scans.',
  VISIBLE_REDNESS: 'We’re noticing visible redness in today’s scan.',
  VISIBLE_SURFACE_SHINE: 'Your skin appears shinier than your recent baseline.',
  VISIBLE_TEXTURE: 'We’re seeing a change in visible skin texture compared with your recent baseline.',
};

export function skinIAMemberObservationCopy(observation: SkinIAInternalObservation): string {
  return copy[observation.observation];
}

export function skinIAMemberNonResultCopy(): typeof SKINIA_PHASE1_NON_RESULT {
  return SKINIA_PHASE1_NON_RESULT;
}
