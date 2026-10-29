import { Platform } from "react-native";
import { MOMENT_PREP_WINDOW_MIN } from "@/config/hydroStateModel";
import type { TravelTrip } from "@workspace/api-zod";
import { travelOwnerHash } from "./intelligenceNotifications";
const kind = "travel.preparation.v2";
let generation = 0,
  queue: Promise<void> = Promise.resolve();
export function reconcileIntelligenceReminders(
  owner: string | null,
  trips: TravelTrip[],
  enabled: boolean,
) {
  const captured = ++generation;
  const run = async () => {
    if (Platform.OS === "web") return;
    const N = await import("expo-notifications");
    const existing = await N.getAllScheduledNotificationsAsync();
    for (const item of existing)
      if (item.content.data?.kind === kind)
        await N.cancelScheduledNotificationAsync(item.identifier);
    if (captured !== generation || !owner || !enabled) return;
    const permission = await N.getPermissionsAsync();
    if (!permission.granted)
      throw new Error("Travel reminders need notification permission.");
    const hash = await travelOwnerHash(owner);
    for (const trip of trips.filter((t) => !t.completedAt))
      for (const leg of trip.legs) {
        if (leg.departurePreparedAt) continue;
        if (captured !== generation) return;
        const date = new Date(
          Date.parse(leg.departureAt) -
            MOMENT_PREP_WINDOW_MIN.travel.startBefore * 60000,
        );
        const hour = Number(
          new Intl.DateTimeFormat("en", {
            timeZone: leg.originTimeZone,
            hour: "numeric",
            hourCycle: "h23",
          }).format(date),
        );
        if (date.getTime() <= Date.now() || hour < 7 || hour >= 22) continue;
        await N.scheduleNotificationAsync({
          identifier: `travel2-prep-${leg.id}`,
          content: {
            title: "AForce travel reminder",
            body: "Open Travel to review your journey and prepare.",
            sound: false,
            data: { kind, ownerHash: hash, tripId: trip.id, legId: leg.id },
          },
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date },
        });
      }
  };
  const next = queue.catch(() => undefined).then(run);
  queue = next;
  return next;
}
export async function enableIntelligenceReminders() {
  if (Platform.OS === "web")
    throw new Error("Enable preparation reminders in the iPhone app.");
  const N = await import("expo-notifications");
  const p = await N.requestPermissionsAsync();
  if (!p.granted) throw new Error("Allow notifications to enable reminders.");
}
