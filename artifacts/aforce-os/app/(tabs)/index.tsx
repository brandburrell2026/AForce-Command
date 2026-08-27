/**
 * Home — AForce OS Hydration Control System.
 *
 * Renders the Phase 2 redesign (`HomeScreenV2`) unconditionally.
 * Founder ruling 2026-08-27: the lazy-loaded legacy Home fallback is
 * retired (fifteen-twin retirement). The RC-1 phantom-6th-tab guard
 * (`homeTabsRouteManifest.test.ts`) remains — it protects the route
 * manifest, not the twin.
 */
import { HomeScreenV2 } from '@/components/home/HomeScreenV2';

export default function HomeScreen() {
  return <HomeScreenV2 />;
}
