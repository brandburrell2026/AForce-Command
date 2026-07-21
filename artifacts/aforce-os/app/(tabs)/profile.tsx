/**
 * Profile tab — Phase 3 reskin when `spec_profile` is on, else legacy. Same
 * data + settings logic (Clerk, entitlements, wearable connect, unit prefs, and
 * the dev/flag admin console) — colors only. Flipping the flag is the go-live switch.
 */
import { ProfileLegacy } from '@/components/profile/ProfileLegacy';
import { ProfileScreenV2 } from '@/components/profile/ProfileScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function ProfileRoute() {
  return useAppStore().state.featureFlags.spec_profile ? <ProfileScreenV2 /> : <ProfileLegacy />;
}
