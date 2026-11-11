import { Router, json, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  flightIdentity,
  travelSyncRequestSchema,
  travelDeviceSchema,
  travelLinkCodeSchema,
} from "@workspace/api-zod";
import { requireRealAuth } from "../middlewares/requireRealAuth";
import {
  defaultTravelRepository,
  TravelConflict,
  type TravelAccount,
  type TravelRepository,
} from "../lib/travel/repository";
import { travelCrypto, travelDigest } from "../lib/travel/crypto";
import {
  claim,
  linkedTrips,
  snapshot,
  travelBridge,
} from "../lib/travel/bridge";
export const intelligenceEnabled = () =>
  process.env["AFORCE_TRAVEL_ENABLED"] === "true" &&
  process.env["AFORCE_TRAVEL_INTELLIGENCE_ENABLED"] === "true" &&
  !!process.env["CLERK_WEBHOOK_SIGNING_SECRET"]?.startsWith("whsec_");
export const travelMembers = () =>
  new Set(
    (process.env["AFORCE_TRAVEL_MEMBER_IDS"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
const consumer = (owner: string) => travelDigest(`aforce-travel-v2:${owner}`);
const publicState = (state: TravelAccount) => ({
  revision: state.revision,
  trips: state.trips,
  observations: state.observations,
  linked: !!state.linkCiphertext,
  monitoring: state.monitoring,
  monitoringAvailable: process.env["AFORCE_TRAVEL_MONITOR_ENABLED"] === "true",
});
async function revokeLinkedGrant(
  state: TravelAccount,
  owner: string,
): Promise<boolean> {
  if (!state.linkCiphertext) return true;
  try {
    await travelBridge("/account/revoke", {
      grant: travelCrypto(process.env["TRAVELGATE_BRIDGE_KEY"] ?? "").decrypt(
        state.linkCiphertext,
      ),
      consumer: consumer(owner),
    });
    return true;
  } catch {
    return false;
  }
}
export function buildTravelIntelligenceRouter(
  repository = defaultTravelRepository,
  enabled = intelligenceEnabled,
) {
  const router = Router();
  router.use(json({ limit: "128kb" }));
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!enabled()) {
      res.status(503).json({ error: "Travel Intelligence is not activated." });
      return;
    }
    next();
  });
  router.use(requireRealAuth);
  router.use((req, res, next) => {
    if (!req.userId || !travelMembers().has(req.userId)) {
      res.status(403).json({ error: "Private pilot access required." });
      return;
    }
    next();
  });
  router.use(
    rateLimit({
      windowMs: 60000,
      limit: 30,
      keyGenerator: (req) => req.userId!,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  router.use(async (_req, res, next) => {
    try {
      if (!(await (await repository()).ready())) throw new Error();
      next();
    } catch {
      res.status(503).json({ error: "Travel storage is not ready." });
    }
  });
  const run =
    (
      fn: (
        repo: TravelRepository,
        owner: string,
        body: unknown,
      ) => Promise<unknown>,
    ) =>
    async (req: Request, res: Response) => {
      try {
        res.json(await fn(await repository(), req.userId!, req.body));
      } catch (error) {
        if (error instanceof TravelConflict) {
          res
            .status(409)
            .json({ error: error.message, current: error.current });
          return;
        }
        res.status(error instanceof z.ZodError ? 400 : 503).json({
          error:
            error instanceof z.ZodError
              ? "Check the flight details."
              : "Travel could not complete this request. Check your connection and try again.",
        });
      }
    };
  router.get(
    "/state",
    run(async (repo, owner) => publicState(await repo.get(owner))),
  );
  router.put(
    "/state",
    run(async (repo, owner, body) => {
      const input = travelSyncRequestSchema.parse(body);
      return publicState(
        await repo.replace(owner, input.revision, input.trips),
      );
    }),
  );
  router.post(
    "/check",
    run(async (repo, owner, body) => {
      const { legId } = z
        .object({ legId: z.string().max(80) })
        .strict()
        .parse(body);
      const state = await repo.get(owner),
        leg = state.trips
          .filter((t) => !t.completedAt)
          .flatMap((t) => t.legs)
          .find((l) => l.id === legId);
      if (!leg) throw new Error("missing");
      const result = await snapshot(leg.flight);
      if (result.availability === "unavailable")
        return { unavailable: result.reason };
      return publicState(
        await repo.observe(owner, legId, flightIdentity(leg), result),
      );
    }),
  );
  router.post(
    "/accept",
    run(async (repo, owner, body) => {
      const p = z
        .object({
          revision: z.number().int().nonnegative(),
          legId: z.string().max(80),
          key: z.string().max(2000),
        })
        .strict()
        .parse(body);
      return publicState(await repo.accept(owner, p.revision, p.legId, p.key));
    }),
  );
  router.post(
    "/link",
    run(async (repo, owner, body) => {
      const p = z
        .object({ code: travelLinkCodeSchema, consent: z.literal(true) })
        .strict()
        .parse(body);
      const grant = await claim(p.code, consumer(owner));
      await repo.link(
        owner,
        travelCrypto(process.env["TRAVELGATE_BRIDGE_KEY"] ?? "").encrypt(
          grant.grant,
        ),
      );
      return { linked: true };
    }),
  );
  router.get(
    "/linked-trips",
    run(async (repo, owner) => {
      const state = await repo.get(owner);
      if (!state.linkCiphertext) throw new Error("not linked");
      return linkedTrips(
        travelCrypto(process.env["TRAVELGATE_BRIDGE_KEY"] ?? "").decrypt(
          state.linkCiphertext,
        ),
        consumer(owner),
      );
    }),
  );
  router.delete(
    "/link",
    run(async (repo, owner) => {
      const state = await repo.get(owner);
      const remoteRevoked = await revokeLinkedGrant(state, owner);
      await repo.link(owner, null);
      return { linked: false, remoteRevoked };
    }),
  );
  router.post(
    "/device",
    run(async (repo, owner, body) => {
      if (process.env["AFORCE_TRAVEL_MONITOR_ENABLED"] !== "true")
        throw new Error("not activated");
      const p = travelDeviceSchema.parse(body);
      await repo.device(
        owner,
        p.deviceId,
        travelCrypto(process.env["TRAVELGATE_BRIDGE_KEY"] ?? "").encrypt(
          p.token,
        ),
        travelDigest(p.token),
        p.enabled,
      );
      return { enabled: p.enabled };
    }),
  );
  router.delete(
    "/device",
    run(async (repo, owner, body) => {
      const p = z.object({ deviceId: z.string().max(80) }).parse(body);
      await repo.disableDevice(owner, p.deviceId);
      return { enabled: false };
    }),
  );
  router.delete(
    "/state",
    run(async (repo, owner, body) => {
      z.object({ confirm: z.literal(true) })
        .strict()
        .parse(body);
      const state = await repo.get(owner);
      const remoteRevoked = await revokeLinkedGrant(state, owner);
      await repo.purge(owner);
      return { cleared: true, remoteRevoked };
    }),
  );
  return router;
}
export default buildTravelIntelligenceRouter();
