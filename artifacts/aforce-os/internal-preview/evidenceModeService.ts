/**
 * NO-c native-evidence enabler — evidence-mode service.
 *
 * The ONLY path the internal control uses to change authorization. It composes the
 * SANCTIONED access APIs (`enable/disableNightOutForInternalPreview`) with the
 * store's `setFeatureFlags`, gated by the internal-build check. The UI never calls
 * `setFeatureFlags` (or mutates the flag) directly. Fails closed outside the
 * authorized internal build. Pure logic (deps injected) → unit-testable.
 */
import type { FeatureFlags } from '@/types';
import {
  enableNightOutForInternalPreview,
  disableNightOutForInternalPreview,
  isNightOutEnabled,
  nightOutInternalPreviewContext,
} from '@/services/nightOut/access';
import { isInternalEvidenceBuild, type InternalBuildInputs } from './internalGate';

export interface EvidenceModeDeps {
  flags: FeatureFlags;
  setFeatureFlags: (f: FeatureFlags) => void;
  build: InternalBuildInputs;
}

/** Enable Night Out for internal-preview evidence. Returns false (no-op) if ineligible. */
export function enableEvidenceMode(deps: EvidenceModeDeps): boolean {
  if (!isInternalEvidenceBuild(deps.build)) return false; // fail closed
  deps.setFeatureFlags(enableNightOutForInternalPreview(deps.flags));
  return true;
}

/** Disable it again (sanctioned reset). Returns false (no-op) if ineligible. */
export function disableEvidenceMode(deps: EvidenceModeDeps): boolean {
  if (!isInternalEvidenceBuild(deps.build)) return false; // fail closed
  deps.setFeatureFlags(disableNightOutForInternalPreview(deps.flags));
  return true;
}

/**
 * Whether the sanctioned Night Out access check currently passes — the gate the
 * control uses before offering navigation to `/night-out` (which itself re-checks).
 */
export function evidenceAccessGranted(
  flags: Pick<FeatureFlags, 'night_out_enabled'>,
  demoMode: boolean,
): boolean {
  return isNightOutEnabled(flags, nightOutInternalPreviewContext(demoMode));
}
