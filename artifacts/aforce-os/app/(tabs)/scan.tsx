/**
 * Scan tab route — renders the Phase 3 redesign when `spec_scan` is on, else the
 * untouched legacy HydroScan screen. (Tab is `href:null` — reached contextually.)
 */
import HydrationScanScreen from '@/screens/HydrationScanScreen';
import { HydrationScanScreenV2 } from '@/components/scan/HydrationScanScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function ScanTabRoute() {
  const specScan = useAppStore().state.featureFlags.spec_scan;
  return specScan ? <HydrationScanScreenV2 /> : <HydrationScanScreen />;
}
