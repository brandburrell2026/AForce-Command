/**
 * sensors route — Phase 3 redesign when `spec_sensors` is on, else legacy.
 *
 * W2-N3 CONTAINMENT (stop-ship register, S2). A sensor import persists a
 * placeholder `70 / BALANCED` score row, and those rows flow into
 * `/journal/rollups` — the average score, the band time-share, the Journal
 * consistency KPI and Protocol compliance all read them. That is a fabricated
 * measurement presented as an observation, which the constitution forbids:
 * code calculates, AI explains, neither invents measurements.
 *
 * `spec_sensors` DOES NOT GATE THIS PATH — it only chooses which of the two
 * import screens renders, and BOTH call `postSensorImport`. Turning that flag
 * off swaps V2 for the legacy screen and leaves the write fully reachable, so
 * it is not a containment lever. The route itself is the only chokepoint:
 * this file is the sole mount of either screen, and those two screens are the
 * only callers of `postSensorImport`.
 *
 * So the controlled internal-TestFlight build bounces the route before either
 * screen can mount. Production is deliberately UNCHANGED — W2-N3 remains open
 * there and is a separate founder decision; this contains the cohort build
 * only. Locked by `featureFlags/__tests__/sensorImportContainment.test.ts`.
 */
import { Redirect } from 'expo-router';
import { SensorImportScreen } from '@/screens/SensorImportScreen';
import { SensorImportScreenV2 } from '@/components/sensors/SensorImportScreenV2';
import { INTERNAL_TESTFLIGHT_OVERLAY_ENABLED } from '@/featureFlags/internalTestflightOverlay';
import { useAppStore } from '@/store/useAppStore';

export default function SensorImportScreenRoute() {
  // Read the store unconditionally — hook order must not depend on the gate.
  const specSensors = useAppStore().state.featureFlags.spec_sensors;
  if (INTERNAL_TESTFLIGHT_OVERLAY_ENABLED) return <Redirect href="/modules" />;
  return specSensors ? <SensorImportScreenV2 /> : <SensorImportScreen />;
}
