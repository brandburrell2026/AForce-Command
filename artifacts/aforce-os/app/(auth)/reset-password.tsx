/**
 * Reset-password route — S2-3(B). Clerk-supported recovery
 * (reset_password_email_code); no legacy variant exists because no reset
 * flow of any kind predates this screen.
 */
import { ResetPasswordScreenV2 } from '@/components/auth/ResetPasswordScreenV2';

export default function ResetPasswordRoute() {
  return <ResetPasswordScreenV2 />;
}
