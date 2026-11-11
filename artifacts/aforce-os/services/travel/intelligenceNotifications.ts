import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { travelStorage } from "./storage";
export async function travelDeviceId() {
  const key = "aforce.travel.device.v2";
  let id = await travelStorage.getItem(key);
  if (!id) {
    id = Crypto.randomUUID();
    await travelStorage.setItem(key, id);
  }
  return id;
}
export async function travelPushRegistration() {
  if (Platform.OS === "web")
    throw new Error("Enable alerts in the iPhone app.");
  let p = await Notifications.getPermissionsAsync();
  if (p.status !== "granted") p = await Notifications.requestPermissionsAsync();
  if (p.status !== "granted")
    throw new Error("Allow notifications in Settings to enable alerts.");
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("This build has no push project configured.");
  return {
    deviceId: await travelDeviceId(),
    token: (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    enabled: true,
    consent: true as const,
  };
}
export async function travelOwnerHash(owner: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner);
}
