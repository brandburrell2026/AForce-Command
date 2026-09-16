/**
 * sensors route — Phase 3 redesign when `spec_sensors` is on, else legacy.
 *
 * Sensor rows are provenance-only. The server writes them as
 * `NOT_COMPUTED` with an inert zero sentinel; they cannot enter score
 * rollups, protocol compliance, or readiness displays. This was the W2-N3
 * stop-ship remediation and is covered by the API-server integrity tests.
 *
 * `spec_sensors` DOES NOT GATE THIS PATH — it only chooses which of the two
 * import screens renders. Both call the same server-owned provenance writer;
 * the selected presentation cannot change the integrity contract. Locked by
 * `featureFlags/__tests__/sensorImportContainment.test.ts`.
 */
import { SensorImportScreen } from '@/screens/SensorImportScreen';
import { SensorImportScreenV2 } from '@/components/sensors/SensorImportScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function SensorImportScreenRoute() {
  const specSensors = useAppStore().state.featureFlags.spec_sensors;
  return specSensors ? <SensorImportScreenV2 /> : <SensorImportScreen />;
}
