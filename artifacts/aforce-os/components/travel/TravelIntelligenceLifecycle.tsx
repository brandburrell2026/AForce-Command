import React from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTravelIntelligence } from "@/hooks/useTravelIntelligence";
import {
  travelDeviceId,
  travelOwnerHash,
} from "@/services/travel/intelligenceNotifications";
import { reconcileIntelligenceReminders } from "@/services/travel/intelligenceReminders";
import { API_BASE } from "@/lib/apiBase";
export function TravelIntelligenceLifecycle({ enabled }: { enabled: boolean }) {
  const travel = useTravelIntelligence(enabled),
    auth = useAuth(),
    router = useRouter(),
    client = useQueryClient();
  const current = React.useRef<string | null | undefined>(auth.userId);
  current.current = auth.userId;
  const syncRef = React.useRef(travel.sync);
  syncRef.current = travel.sync;
  React.useEffect(() => {
    if (!enabled || !travel.owner || !travel.query.data?.sync) return;
    const refresh = () => {
      if (AppState.currentState === "active")
        void syncRef.current().catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled, travel.owner, travel.query.data?.sync]);
  React.useEffect(() => {
    void reconcileIntelligenceReminders(
      enabled ? travel.owner : null,
      travel.query.data?.trips ?? [],
      enabled && !!travel.query.data?.reminders,
    ).catch(() => undefined);
  }, [enabled, travel.owner, travel.query.data]);
  React.useEffect(() => {
    const owner = auth.userId;
    if (!owner || !enabled) return;
    let stopped = false,
      token: string | null = null;
    void auth.getToken().then((t) => {
      token = t;
    });
    let unsubscribe: (() => void) | undefined;
    const init = async () => {
      if (Platform.OS === "web") return;
      const N = await import("expo-notifications");
      const open = async (
        response: import("expo-notifications").NotificationResponse,
      ) => {
        const d = response.notification.request.content.data;
        if (
          d?.kind !== "travel.status.v2" &&
          d?.kind !== "travel.preparation.v2"
        )
          return;
        await N.clearLastNotificationResponseAsync();
        if (
          stopped ||
          current.current !== owner ||
          d.ownerHash !== (await travelOwnerHash(owner))
        )
          return;
        const doc = await travel.query.refetch();
        if (
          stopped ||
          current.current !== owner ||
          !doc.data?.trips.some(
            (t) =>
              !t.completedAt &&
              t.id === d.tripId &&
              t.legs.some((l) => l.id === d.legId),
          )
        )
          return;
        router.push("/travel-intelligence" as never);
      };
      const subscription = N.addNotificationResponseReceivedListener(
        (r) => void open(r),
      );
      unsubscribe = () => subscription.remove();
      if (stopped) {
        unsubscribe();
        return;
      }
      const last = await N.getLastNotificationResponseAsync();
      if (last) await open(last);
    };
    void init().catch(() => undefined);
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void auth.getToken().then((t) => {
          token = t;
        });
    });
    return () => {
      stopped = true;
      unsubscribe?.();
      foreground.remove();
      client.removeQueries({ queryKey: ["travel-intelligence-v2", owner] });
      void reconcileIntelligenceReminders(null, [], false).catch(
        () => undefined,
      );
      if (token)
        void travelDeviceId()
          .then((deviceId) =>
            fetch(`${API_BASE}/travel/intelligence/device`, {
              method: "DELETE",
              redirect: "error",
              signal: AbortSignal.timeout(8000),
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ deviceId }),
            }),
          )
          .catch(() => undefined);
    };
    // Owner and gate changes retire the previous device binding. Token getter is read through Clerk for this owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId, enabled, client, router]);
  return null;
}
