/**
 * Sign-up route. Clerk sign-up + OAuth flow unchanged.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { SignUpScreenV2 } from '@/components/auth/SignUpScreenV2';

export default function SignUpRoute() {
  return <SignUpScreenV2 />;
}
