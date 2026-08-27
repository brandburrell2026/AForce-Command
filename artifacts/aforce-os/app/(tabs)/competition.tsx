/**
 * Circle tab (tab label "Circle" per RC-L1; route name stays `competition`
 * for deep-link stability) — the V3 Circle screen
 * (`circle_v3_dashboard_enabled`, founder comps 2026-08-11), with the Phase 3
 * redesign as its remaining rollback.
 * Founder ruling 2026-08-27: the untouched legacy CompetitionScreen (the
 * third layer) is retired (fifteen-twin retirement); V2 stays — it is the
 * live V3 fallback, not a twin.
 */
import { CompetitionScreenV2 } from '@/components/community/CompetitionScreenV2';
import { CircleScreenV3 } from '@/components/community/CircleScreenV3';
import { useAppStore } from '@/store/useAppStore';

export default function CommunityRoute() {
  const flags = useAppStore().state.featureFlags;
  return flags.circle_v3_dashboard_enabled ? <CircleScreenV3 /> : <CompetitionScreenV2 />;
}
