/**
 * Legal & transportation safety service.
 *
 * Maps an impairment level (and the BAC midpoint that produced it) to a
 * `TransportationSafetyPrompt` the UI can render. Returns i18n KEYS, not
 * localized strings — the caller renders them through `t()`.
 *
 * SAFETY:
 *   The system NEVER tells a user they are "safe to drive". When
 *   impairment is LOW/ELEVATED the prompt is hidden entirely (the user
 *   gets the standard Social Mode coaching). At MODERATE and above the
 *   prompt escalates and always includes the
 *   `social.not_legal_medical` disclaimer key.
 */

import type {
  BACEstimate,
  ImpairmentRiskLevel,
  ImpairmentRiskState,
  TransportationSafetyPrompt,
} from '../types/socialMode';

/**
 * Standard mapping of estimated peak BAC midpoint to impairment band.
 * Matches the spec's 5-state escalation. Bands are intentionally
 * conservative on the low end (anything ≥ 0.05 is at least MODERATE).
 */
export function impairmentFromBAC(bac: BACEstimate): ImpairmentRiskState {
  const mid = (bac.rangeLow + bac.rangeHigh) / 2;
  let level: ImpairmentRiskLevel;
  if (mid >= 0.12) level = 'CRITICAL';
  else if (mid >= 0.08) level = 'HIGH';
  else if (mid >= 0.05) level = 'MODERATE';
  else if (mid >= 0.03) level = 'ELEVATED';
  else level = 'LOW';
  return { level, bacMidpoint: Math.round(mid * 1000) / 1000 };
}

export function transportationPromptFor(impairment: ImpairmentRiskLevel): TransportationSafetyPrompt {
  switch (impairment) {
    case 'CRITICAL':
      return {
        show: true,
        severity: 'critical',
        titleKey: 'social.safety_do_not_drive',
        bodyKey: 'social.safety_critical_body',
        disclaimerKey: 'social.not_legal_medical',
        stopDrinking: true,
      };
    case 'HIGH':
      return {
        show: true,
        severity: 'warning',
        titleKey: 'social.safety_do_not_drive',
        bodyKey: 'social.safety_high_body',
        disclaimerKey: 'social.not_legal_medical',
        stopDrinking: true,
      };
    case 'MODERATE':
      return {
        show: true,
        severity: 'caution',
        titleKey: 'social.safety_use_rideshare',
        bodyKey: 'social.safety_moderate_body',
        disclaimerKey: 'social.not_legal_medical',
        stopDrinking: false,
      };
    case 'ELEVATED':
    case 'LOW':
    default:
      return {
        show: false,
        severity: 'info',
        titleKey: 'social.safety_use_rideshare',
        bodyKey: 'social.safety_moderate_body',
        disclaimerKey: 'social.not_legal_medical',
        stopDrinking: false,
      };
  }
}
