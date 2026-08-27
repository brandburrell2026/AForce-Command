/**
 * Onboarding route — writes ProfileIdentity + unit preferences.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { OnboardingScreenV2 } from '@/components/onboarding/OnboardingScreenV2';

export default function OnboardingRoute() {
  return <OnboardingScreenV2 />;
}
