/**
 * Community tab — renders the Phase 3 redesign when `spec_community` is on,
 * else the untouched legacy screen. Route name stays `competition` (deep-link
 * stable); tab label stays "Community". Flipping the flag is the go-live switch.
 */
import CompetitionScreen from '@/screens/CompetitionScreen';
import { CompetitionScreenV2 } from '@/components/community/CompetitionScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function CommunityRoute() {
  const specCommunity = useAppStore().state.featureFlags.spec_community;
  return specCommunity ? <CompetitionScreenV2 /> : <CompetitionScreen />;
}
