/**
 * Welcome route — the promise screen a signed-out member lands on first.
 * Sign-in and sign-up are one tap away and unchanged.
 */
import { PromiseScreen } from '@/components/auth/PromiseScreen';

export default function WelcomeRoute() {
  return <PromiseScreen />;
}
