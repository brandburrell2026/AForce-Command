import { Platform } from 'react-native';
import { consumerCopyBlocked } from '@/utils/intelligence/languageGate/runtimeClaimScan';
import { evaluateDeliverableCopy, evaluateDeliverableLabel } from '@/utils/intelligence/decisionGuard';
import { ensureForegroundHandler } from '@/services/pushNotifications';
import { TRAVEL_REMINDER_ID, type TravelReminderNative } from './reminders';

export const TRAVEL_REMINDER_KIND = 'travel.preparation.v1';
async function notifications() {
  if (Platform.OS === 'web') return null;
  return import('expo-notifications');
}
export async function travelOwnerHash(owner: string): Promise<string> {
  const Crypto = await import('expo-crypto');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner);
}
async function channel(Notif: typeof import('expo-notifications')) {
  if (Platform.OS === 'android') await Notif.setNotificationChannelAsync('travel-preparation', {
    name: 'Travel preparation', importance: Notif.AndroidImportance.LOW, sound: null,
  });
}
export const travelReminderNative: TravelReminderNative = {
  supported: Platform.OS !== 'web',
  async cancel() {
    const Notif = await notifications();
    if (Notif) {
      const results = await Promise.allSettled([
        Notif.cancelScheduledNotificationAsync(TRAVEL_REMINDER_ID),
        Notif.dismissNotificationAsync(TRAVEL_REMINDER_ID),
      ]);
      if (results.some(result => result.status === 'rejected')) throw new Error('Travel reminder cleanup incomplete.');
    }
  },
  async purgeResponse() {
    const Notif = await notifications();
    if (!Notif) return;
    const response = await Notif.getLastNotificationResponseAsync();
    if (response?.notification.request.content.data?.kind === TRAVEL_REMINDER_KIND) await Notif.clearLastNotificationResponseAsync();
  },
  async permission(request) {
    const Notif = await notifications();
    if (!Notif) return false;
    if (request) await channel(Notif);
    const current = await Notif.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return true;
    if (!request || current.canAskAgain === false) return false;
    const result = await Notif.requestPermissionsAsync();
    return result.granted || result.status === 'granted';
  },
  async schedule(fireAt, owner, journeyCreatedAt) {
    const Notif = await notifications();
    if (!Notif) throw new Error('Travel reminders unavailable on this platform.');
    await channel(Notif);
    await ensureForegroundHandler();
    const title = 'AForce travel reminder';
    const body = 'Open Travel to review your journey and prepare.';
    if (consumerCopyBlocked(title) || consumerCopyBlocked(body)
      || evaluateDeliverableLabel(title).verdict === 'blocked' || evaluateDeliverableCopy(body).verdict === 'blocked') {
      throw new Error('Travel reminder copy blocked.');
    }
    const ownerHash = await travelOwnerHash(owner);
    if (Date.parse(fireAt) <= Date.now()) throw new Error('Preparation time has passed.');
    await Notif.scheduleNotificationAsync({
      identifier: TRAVEL_REMINDER_ID,
      content: {
        title, body,
        sound: false,
        // No flight, airport, passenger, health or raw account ID on the OS
        // notification. The fingerprint only guards notification tap routing.
        data: { kind: TRAVEL_REMINDER_KIND, ownerHash, journeyCreatedAt },
      },
      trigger: { type: Notif.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt), channelId: 'travel-preparation' },
    });
  },
};

/** Handles only our own notification kind. Never clears another stream's
 * last response. Cold-start taps and taps while the app is open share a path. */
export async function observeTravelReminderTaps(
  handle: (ownerHash: string, createdAt: string) => Promise<void>,
): Promise<() => void> {
  const Notif = await notifications();
  if (!Notif) return () => {};
  let active = true;
  const seen = new Set<string>();
  const receive = async (response: import('expo-notifications').NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    if (!active || data?.kind !== TRAVEL_REMINDER_KIND || typeof data.ownerHash !== 'string' || typeof data.journeyCreatedAt !== 'string') return;
    const key = `${response!.notification.request.identifier}:${response!.notification.date}:${response!.actionIdentifier}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (seen.size > 16) seen.delete(seen.values().next().value!);
    // Clear before awaiting caller routing so a remount cannot handle this
    // same cold-start response twice. The caller separately verifies ownership.
    await Notif.clearLastNotificationResponseAsync();
    if (active) await handle(data.ownerHash, data.journeyCreatedAt);
  };
  const subscription = Notif.addNotificationResponseReceivedListener(response => { void receive(response).catch(() => {}); });
  void Notif.getLastNotificationResponseAsync().then(receive).catch(() => {});
  return () => { active = false; subscription.remove(); };
}
