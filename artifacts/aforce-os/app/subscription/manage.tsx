/**
 * Manage Subscription route — Phase 3 redesign when `spec_manageSub` is on, else
 * legacy. The Stripe Customer Portal + entitlement refresh live in the screen.
 */
import ManageSubscriptionScreen from '@/screens/ManageSubscriptionScreen';
import { ManageSubscriptionScreenV2 } from '@/components/subscription/ManageSubscriptionScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function ManageSubscriptionRoute() {
  return useAppStore().state.featureFlags.spec_manageSub ? <ManageSubscriptionScreenV2 /> : <ManageSubscriptionScreen />;
}
