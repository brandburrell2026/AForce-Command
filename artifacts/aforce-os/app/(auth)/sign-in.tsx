/**
 * Sign-in route — Phase 3 brand reskin when `spec_auth` is on, else legacy.
 * Clerk sign-in flow is unchanged in both.
 */
import { SignInLegacy } from '@/components/auth/SignInLegacy';
import { SignInScreenV2 } from '@/components/auth/SignInScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function SignInRoute() {
  return useAppStore().state.featureFlags.spec_auth ? <SignInScreenV2 /> : <SignInLegacy />;
}
