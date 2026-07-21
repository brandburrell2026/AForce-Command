/**
 * Cart route — Phase 3 redesign when `spec_cart` is on, else legacy. The Stripe
 * one-time checkout (verify-before-clear) lives in the screen and is unchanged.
 */
import CartScreen from '@/screens/CartScreen';
import { CartScreenV2 } from '@/components/cart/CartScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function CartRoute() {
  return useAppStore().state.featureFlags.spec_cart ? <CartScreenV2 /> : <CartScreen />;
}
