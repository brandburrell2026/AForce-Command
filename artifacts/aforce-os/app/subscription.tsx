/**
 * Subscription route — Phase 3 redesign when `spec_subscription` is on, else
 * legacy. The Stripe checkout + entitlement state machine lives in the screen.
 */
import SubscriptionScreen from '@/screens/SubscriptionScreen';
import { SubscriptionScreenV2 } from '@/components/subscription/SubscriptionScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function SubscriptionRoute() {
  return useAppStore().state.featureFlags.spec_subscription ? <SubscriptionScreenV2 /> : <SubscriptionScreen />;
}
