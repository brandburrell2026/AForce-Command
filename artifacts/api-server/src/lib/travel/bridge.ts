import {
  travelCloudStateSchema,
  travelSnapshotResponseSchema,
  type TravelFlightRequest,
} from "@workspace/api-zod";
import {
  bridgeKeyConfigured,
  TRAVELGATE_BRIDGE_URL,
} from "../travelGateBridge";
import { z } from "zod";
const base = TRAVELGATE_BRIDGE_URL.replace(/\/flight-status$/, "");
export async function travelBridge(
  path:
    | "/flight-snapshot"
    | "/account/claim"
    | "/account/trips"
    | "/account/revoke",
  body: unknown,
) {
  const key = process.env["TRAVELGATE_BRIDGE_KEY"];
  if (!bridgeKeyConfigured(key))
    throw new Error("Travel service is not connected.");
  const response = await fetch(base + path, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Link expired. Connect again."
        : "Travel service unavailable.",
    );
  if (!response.body) throw new Error("Empty response");
  const reader = response.body.getReader();
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 131072) throw new Error("Oversized response");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
export async function snapshot(input: TravelFlightRequest) {
  return travelSnapshotResponseSchema.parse(
    await travelBridge("/flight-snapshot", input),
  );
}
export async function claim(code: string, consumer: string) {
  return z
    .object({
      grant: z.string().regex(/^[a-f0-9]{64}$/),
      expiresInSeconds: z.number(),
    })
    .parse(await travelBridge("/account/claim", { code, consumer }));
}
export async function linkedTrips(grant: string, consumer: string) {
  return travelCloudStateSchema.parse(
    await travelBridge("/account/trips", { grant, consumer }),
  );
}
