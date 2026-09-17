/**
 * Home — AForce OS primary editorial surface.
 *
 * Renders the Editorial OS "Cover" composition when `editorial_home_enabled`
 * is on (E2, founder ruling 2026-08-29), else the Phase 2 redesign
 * (`HomeScreenV2`) — the live rollback fallback, byte-untouched by E2.
 * Founder ruling 2026-08-27 retired the legacy Home twin; the RC-1
 * phantom-6th-tab guard (`homeTabsRouteManifest.test.ts`) remains — it
 * protects the route manifest, not the twin.
 */
import { EditorialHomeScreen } from '@/components/editorial/home/EditorialHomeScreen';
import { HomeScreenV2 } from '@/components/home/HomeScreenV2';
import { SkinIntelligenceHomeScreen } from '@/components/skinIntelligence/SkinIntelligenceEditorialSuite';
import { useFeatureFlags } from '@/store/useAppStore';

export default function HomeScreen() {
  const flags = useFeatureFlags();
  // The approved Skin Intelligence Figma system is the first screen in the
  // controlled internal build. Public binaries retain the established Home
  // seam until a separate production release is approved.
  if (
    process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true'
    && flags.advanced_visual_intelligence_enabled
  ) {
    return <SkinIntelligenceHomeScreen />;
  }
  return flags.editorial_home_enabled ? <EditorialHomeScreen /> : <HomeScreenV2 />;
}
