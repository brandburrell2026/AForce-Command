import { preparationClosed } from "@/services/momentPreparationLifecycle";
import { Platform } from "react-native";
import {
  getMomentsState,
  hydrateMoments,
  useMomentsStore,
} from "./momentsStore";
import { preparationPreviewEnabled } from "./preparationAccess";

/** Quiet is derived from persisted Moments. No second lifecycle or timer. */
export function quietMomentActive(): boolean {
  return getMomentsState().moments.some(
    (m) => !!m.preparation?.lockedInAtIso && !preparationClosed(m.preparation),
  );
}

/** Unknown persisted Quiet state is not permission to play audio at boot. */
export function ordinaryDeliveryBlocked(): boolean {
  return (
    (preparationPreviewEnabled() && !getMomentsState().hydrated) ||
    quietMomentActive()
  );
}
export function useQuietDeliveryBlocked(): boolean {
  const { moments, hydrated } = useMomentsStore();
  return (
    (preparationPreviewEnabled() && !hydrated) ||
    moments.some(
      (m) =>
        !!m.preparation?.lockedInAtIso && !preparationClosed(m.preparation),
    )
  );
}

// Serialize native scheduling with Lock In so an in-flight scheduler cannot
// add a reminder after the cancellation sweep. This is delivery coordination,
// never another source of preparation state.
let deliveryQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = deliveryQueue.catch(() => undefined).then(operation);
  deliveryQueue = result.catch(() => undefined);
  return result;
}
export function scheduleOutsideQuiet<T>(
  schedule: () => Promise<T>,
  isCurrent: () => boolean = () => true,
): Promise<T | undefined> {
  return serialize(async () => {
    if (preparationPreviewEnabled()) await hydrateMoments();
    return ordinaryDeliveryBlocked() || !isCurrent() ? undefined : schedule();
  });
}

/** A cancellation failure must not report successful Lock In. No reminders
 * are automatically replayed on return: their existing owners reconcile. */
export function lockInWithoutReminders<T>(
  commit: () => Promise<T>,
): Promise<T> {
  return serialize(async () => {
    if (Platform.OS !== "web") {
      const notifications = await import("expo-notifications");
      const pending = await notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        pending
          .filter((n) => n.content.data?.kind !== "safety")
          .map((n) =>
            notifications.cancelScheduledNotificationAsync(n.identifier),
          ),
      );
    }
    return commit();
  });
}
