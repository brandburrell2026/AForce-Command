import { z } from "zod";
import { flightIdentity } from "@workspace/api-zod";
import { defaultTravelRepository, type TravelRepository } from "./repository";
import { snapshot } from "./bridge";
import { travelCrypto, travelDigest } from "./crypto";
const resultSchema = z.object({
  status: z.enum(["ok", "error"]),
  id: z.string().optional(),
  details: z.object({ error: z.string().optional() }).optional(),
});
export async function expoRequest(path: "send" | "getReceipts", body: unknown) {
  const r = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Push service unavailable");
  const text = await r.text();
  if (text.length > 16384) throw new Error("Invalid push response");
  return z.object({ data: z.unknown() }).parse(JSON.parse(text)).data;
}
export async function monitorTravel(
  repo: TravelRepository,
  members: ReadonlySet<string>,
  key: string,
  transport = expoRequest,
) {
  const crypto = travelCrypto(key);
  for (const owner of await repo.claimOwners()) {
    try {
      if (!members.has(owner)) continue;
      const account = await repo.get(owner);
      const now = Date.now();
      const candidates = account.trips
        .filter((t) => !t.completedAt)
        .flatMap((t) => t.legs)
        .filter(
          (leg) =>
            now >= Date.parse(leg.departureAt) - 86400000 &&
            now <= Date.parse(leg.arrivalAt ?? leg.departureAt) + 86400000,
        )
        .sort((a, b) => Date.parse(a.departureAt) - Date.parse(b.departureAt));
      // Rotate the bounded batch so an unavailable leg cannot starve later legs.
      const start = candidates.length
        ? (Math.floor(now / 300000) * 8) % candidates.length
        : 0;
      const due = [...candidates, ...candidates].slice(
        start,
        start + Math.min(8, candidates.length),
      );
      for (const leg of due) {
        if (
          now < Date.parse(leg.departureAt) - 86400000 ||
          now > Date.parse(leg.arrivalAt ?? leg.departureAt) + 86400000
        )
          continue;
        try {
          const value = await snapshot(leg.flight);
          if (value.availability !== "unavailable")
            await repo.observe(owner, leg.id, flightIdentity(leg), value);
        } catch {
          /* Retry on the next bounded sweep; never change itinerary. */
        }
      }
    } finally {
      await repo.releaseOwner(owner);
    }
  }
  for (const job of await repo.claimAlerts()) {
    const now = Date.now();
    try {
      const target = members.has(job.user_id)
        ? await repo.deliveryTarget(job)
        : null;
      if (!target) {
        await repo.finishAlert(job.id, "superseded", now);
        continue;
      }
      if (job.state === "receipt" && job.ticket_id) {
        const responses = await transport("getReceipts", {
          ids: [job.ticket_id],
        });
        const value = z.record(z.string(), resultSchema).parse(responses)[
          job.ticket_id
        ];
        if (!value) {
          await repo.finishAlert(
            job.id,
            job.attempts > 30 ? "failed" : "receipt",
            now + 900000,
          );
          continue;
        }
        if (value.details?.error === "DeviceNotRegistered")
          await repo.disableDevice(job.user_id, job.device_id);
        await repo.finishAlert(
          job.id,
          value.status === "ok" ? "delivered" : "failed",
          now,
        );
        continue;
      }
      if (job.attempts >= 6) {
        await repo.finishAlert(job.id, "failed", now);
        continue;
      }
      if (!(await repo.claimDevice(job.user_id, job.device_id))) {
        await repo.finishAlert(job.id, "queued", now + 600000);
        continue;
      }
      const value = resultSchema.parse(
        await transport("send", {
          to: crypto.decrypt(target.ciphertext),
          title: "AForce Travel",
          body: "Travel update available. Open AForce to review your journey.",
          sound: "default",
          data: {
            kind: "travel.status.v2",
            ownerHash: travelDigest(job.user_id),
            tripId: job.trip_id,
            legId: job.leg_id,
            eventId: job.id,
          },
        }),
      );
      if (value.details?.error === "DeviceNotRegistered")
        await repo.disableDevice(job.user_id, job.device_id);
      if (value.status === "ok" && value.id) {
        await repo.sent(job.user_id, job.device_id);
        await repo.finishAlert(job.id, "receipt", now + 900000, value.id);
      } else
        await repo.finishAlert(
          job.id,
          value.details?.error === "DeviceNotRegistered" ? "failed" : "queued",
          now + 600000,
        );
    } catch {
      await repo.finishAlert(
        job.id,
        job.attempts >= 5
          ? "failed"
          : job.state === "receipt"
            ? "receipt"
            : "queued",
        now + Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
      );
    }
  }
  await repo.sweep();
}
export function startTravelMonitor() {
  if (
    process.env["AFORCE_TRAVEL_ENABLED"] !== "true" ||
    process.env["AFORCE_TRAVEL_INTELLIGENCE_ENABLED"] !== "true" ||
    process.env["AFORCE_TRAVEL_MONITOR_ENABLED"] !== "true"
  )
    return () => undefined;
  if (!process.env["CLERK_WEBHOOK_SIGNING_SECRET"]?.startsWith("whsec_"))
    return () => undefined;
  const key = process.env["TRAVELGATE_BRIDGE_KEY"] ?? "";
  if (!/^[a-f0-9]{64}$/i.test(key)) return () => undefined;
  let busy = false,
    stopped = false;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try {
      const repo = await defaultTravelRepository();
      if (await repo.ready())
        await monitorTravel(
          repo,
          new Set(
            (process.env["AFORCE_TRAVEL_MEMBER_IDS"] ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
          key,
        );
    } catch {
      /* No credential, flight or account data in logs. */
    } finally {
      busy = false;
    }
  };
  const interval = setInterval(() => void tick(), 60000);
  interval.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
