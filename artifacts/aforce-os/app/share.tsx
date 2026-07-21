/**
 * Share route — renders the Phase 3 redesign when `spec_share` is on, else the
 * untouched legacy screen. Flipping the flag is the go-live switch.
 */
import SharePreviewScreen from '../screens/SharePreviewScreen';
import { SharePreviewScreenV2 } from '@/components/share/SharePreviewScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function ShareRoute() {
  const specShare = useAppStore().state.featureFlags.spec_share;
  return specShare ? <SharePreviewScreenV2 /> : <SharePreviewScreen />;
}
