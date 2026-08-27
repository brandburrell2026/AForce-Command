/**
 * Share route.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { SharePreviewScreenV2 } from '@/components/share/SharePreviewScreenV2';

export default function ShareRoute() {
  return <SharePreviewScreenV2 />;
}
