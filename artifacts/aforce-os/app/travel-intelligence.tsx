import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useFeatureFlags } from "@/store/useAppStore";
import { travelPilotAvailable } from "@/featureFlags/flags";
import { TravelIntelligenceScreen } from "@/components/travel/TravelIntelligenceScreen";
export default function TravelIntelligenceRoute() {
  const flags = useFeatureFlags(),
    auth = useAuth();
  if (!travelPilotAvailable(flags)) return <Redirect href="/" />;
  if (!auth.isLoaded) return null;
  if (!auth.userId) return <Redirect href="/(auth)/sign-in" />;
  return <TravelIntelligenceScreen key={auth.userId} />;
}
