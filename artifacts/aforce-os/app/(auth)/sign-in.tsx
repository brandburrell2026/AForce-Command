/**
 * Sign-in route. Clerk sign-in flow unchanged.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { SignInScreenV2 } from '@/components/auth/SignInScreenV2';

export default function SignInRoute() {
  return <SignInScreenV2 />;
}
