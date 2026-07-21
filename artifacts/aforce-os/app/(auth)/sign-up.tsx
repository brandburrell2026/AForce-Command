/**
 * Sign-up route — Phase 3 brand reskin when `spec_auth` is on, else legacy.
 * Clerk sign-up + OAuth flow is unchanged in both.
 */
import { SignUpLegacy } from '@/components/auth/SignUpLegacy';
import { SignUpScreenV2 } from '@/components/auth/SignUpScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function SignUpRoute() {
  return useAppStore().state.featureFlags.spec_auth ? <SignUpScreenV2 /> : <SignUpLegacy />;
}
