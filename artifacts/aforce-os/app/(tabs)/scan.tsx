/**
 * Scan route — tab entry (`href:null`, reached contextually).
 *
 * Founder ruling 2026-08-27 retired the flag-OFF legacy fallback (fifteen-twin
 * retirement), leaving this route unconditional. E6-B (founder authorization
 * 2026-08-30) introduces the Editorial seam — and does so in BOTH route files
 * identically, because a route that skipped the flag would silently keep that
 * entry point on the old composition.
 *
 * `HydrationScanScreenV2` remains the flag-OFF rollback.
 */
import { useAppStore } from '@/store/useAppStore';
import { HydrationScanScreenV2 } from '@/components/scan/HydrationScanScreenV2';
import { EditorialScanScreen } from '@/components/editorial/scan/EditorialScanScreen';

export default function ScanTabRoute() {
  const flags = useAppStore().state.featureFlags;
  return flags.editorial_scan_enabled ? <EditorialScanScreen /> : <HydrationScanScreenV2 />;
}
