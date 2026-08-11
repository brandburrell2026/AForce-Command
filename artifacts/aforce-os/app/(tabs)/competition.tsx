/**
 * Circle tab (tab label "Circle" per RC-L1; route name stays `competition`
 * for deep-link stability) — three-way switch, newest first: the V3 Circle
 * screen (`circle_v3_dashboard_enabled`, founder comps 2026-08-11), else the
 * Phase 3 redesign (`spec_community`), else the untouched legacy screen.
 * Flipping a flag is the go-live switch.
 */
import CompetitionScreen from '@/screens/CompetitionScreen';
import { CompetitionScreenV2 } from '@/components/community/CompetitionScreenV2';
import { CircleScreenV3 } from '@/components/community/CircleScreenV3';
import { useAppStore } from '@/store/useAppStore';

export default function CommunityRoute() {
  const flags = useAppStore().state.featureFlags;
  if (flags.circle_v3_dashboard_enabled) return <CircleScreenV3 />;
  return flags.spec_community ? <CompetitionScreenV2 /> : <CompetitionScreen />;
}
