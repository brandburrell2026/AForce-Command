/**
 * Onboarding route — Phase 3 redesign when `spec_onboarding` is on, else the
 * preserved legacy flow. Both write ProfileIdentity + unit preferences.
 */
import { OnboardingLegacy } from '@/components/onboarding/OnboardingLegacy';
import { OnboardingScreenV2 } from '@/components/onboarding/OnboardingScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function OnboardingRoute() {
  return useAppStore().state.featureFlags.spec_onboarding ? <OnboardingScreenV2 /> : <OnboardingLegacy />;
}
