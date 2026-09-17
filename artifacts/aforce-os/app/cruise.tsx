import CruiseModeScreen from "@/screens/CruiseModeScreen";
import { EditorialCruiseLandingScreen } from '@/components/skinIntelligence/SkinIntelligenceEditorialSuite';

export default function CruiseRoute() {
  if (process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true') {
    return <EditorialCruiseLandingScreen />;
  }
  return <CruiseModeScreen />;
}
