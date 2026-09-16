/**
 * SkinIA Visual Check — approved containment contracts for a future
 * controlled TestFlight workflow. These contracts accept no visual input and
 * contain no capture, persistence, comparison, or analysis implementation.
 */

export type SkinIAQualityState =
  | 'UNKNOWN'
  | 'CAPTURE_QUALITY_INSUFFICIENT';

export type SkinIABaselineState =
  | 'UNKNOWN'
  | 'NOT_ENOUGH_INFORMATION'
  | 'NO_COMPARABLE_BASELINE';

export type SkinIAQualityGateContract = Readonly<{
  scope: 'DEVICE_LOCAL_FUTURE_INTERFACE';
  state: SkinIAQualityState;
  rawImagePolicy: 'EPHEMERAL_ONLY_NEVER_PERSIST';
  nextAction: 'DO_NOT_PRODUCE_OBSERVATION';
}>;

export type SkinIABaselineContract = Readonly<{
  scope: 'DEVICE_LOCAL_FUTURE_INTERFACE';
  state: SkinIABaselineState;
  rawImagePolicy: 'EPHEMERAL_ONLY_NEVER_PERSIST';
  comparisonPolicy: 'PERSONAL_BASELINE_ONLY';
  nextAction: 'DO_NOT_PRODUCE_OBSERVATION';
}>;

/**
 * Safe defaults until future validation and capture-lifecycle work is complete.
 * This function deliberately takes no image, identifier, device, or member data.
 */
export function unknownQualityGate(): SkinIAQualityGateContract {
  return Object.freeze({
    scope: 'DEVICE_LOCAL_FUTURE_INTERFACE',
    state: 'UNKNOWN',
    rawImagePolicy: 'EPHEMERAL_ONLY_NEVER_PERSIST',
    nextAction: 'DO_NOT_PRODUCE_OBSERVATION',
  });
}

/** A missing or unsuitable baseline must never be substituted with a result. */
export function unavailableBaseline(reason: 'NOT_ENOUGH_INFORMATION' | 'NO_COMPARABLE_BASELINE'): SkinIABaselineContract {
  return Object.freeze({
    scope: 'DEVICE_LOCAL_FUTURE_INTERFACE',
    state: reason,
    rawImagePolicy: 'EPHEMERAL_ONLY_NEVER_PERSIST',
    comparisonPolicy: 'PERSONAL_BASELINE_ONLY',
    nextAction: 'DO_NOT_PRODUCE_OBSERVATION',
  });
}
