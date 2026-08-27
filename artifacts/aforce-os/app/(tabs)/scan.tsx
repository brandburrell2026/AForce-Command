/**
 * Scan tab route. (Tab is `href:null` — reached contextually.)
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { HydrationScanScreenV2 } from '@/components/scan/HydrationScanScreenV2';

export default function ScanTabRoute() {
  return <HydrationScanScreenV2 />;
}
