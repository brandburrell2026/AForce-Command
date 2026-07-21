/**
 * sensors route — Phase 3 redesign when `spec_sensors` is on, else legacy.
 */
import { SensorImportScreen } from '@/screens/SensorImportScreen';
import { SensorImportScreenV2 } from '@/components/sensors/SensorImportScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function SensorImportScreenRoute() {
  return useAppStore().state.featureFlags.spec_sensors ? <SensorImportScreenV2 /> : <SensorImportScreen />;
}
