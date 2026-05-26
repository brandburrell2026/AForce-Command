/**
 * Admin / debug endpoint for the Hydration Demand Engine.
 *
 * Surface (admin-gated, Phase 1 — invisible to end users):
 *   POST /api/admin/demand/snapshot
 *     body: HydrationDemandInputs (Zod-validated; same shape the
 *           mobile adapter produces)
 *     returns: { inputs, outputs } where outputs is the engine's
 *              pure computation. Same engine code as the mobile
 *              app — imported from @workspace/demand-engine.
 *
 *   GET  /api/admin/demand/snapshot?weightLbs=...&activityLevel=...
 *     same shape, but inputs come from query params (numeric
 *     fields parsed; sweat/env strings passed through). Convenient
 *     for ad-hoc curl debugging without a JSON body.
 *
 * Architecture lock alignment:
 *   - Hidden infra: no visible surface consumes this endpoint.
 *   - Same flag boundary as mobile: the engine is pure and always
 *     computable, but the *mobile selector* still respects
 *     `spec_demand_engine`. The admin endpoint deliberately
 *     bypasses that flag because admins are debugging the engine
 *     itself.
 *   - No compliance language is generated server-side; all output
 *     strings come from the shared engine module which is already
 *     scrubbed.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  computeHydrationDemand,
  type HydrationDemandInputs,
} from "@workspace/demand-engine";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const SweatProfile = z.enum(["low", "moderate", "high", "very_high"]);
const EnvironmentProfile = z.enum([
  "mostly_indoor",
  "mixed",
  "mostly_outdoor",
  "hot_climate",
  "travel_often",
]);

const InputsSchema = z
  .object({
    weightLbs: z.number().finite(),
    activityLevel: z.number().finite(),
    sweatProfile: SweatProfile.optional(),
    environmentProfile: EnvironmentProfile.optional(),
    heatC: z.number().finite().optional(),
    humidityPct: z.number().finite().optional(),
    sleepHours: z.number().finite().optional(),
    recoveryScore: z.number().finite().optional(),
    consumedOz: z.number().finite().optional(),
    completedCycles: z.number().finite().optional(),
  })
  .strict();

/**
 * Best-effort numeric coercion for query-string callers. Returns
 * `undefined` for missing/blank/NaN so the engine applies its own
 * documented defaults instead of fabricating zeros.
 */
function numFromQuery(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function inputsFromQuery(q: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = {};
  for (const k of [
    "weightLbs",
    "activityLevel",
    "heatC",
    "humidityPct",
    "sleepHours",
    "recoveryScore",
    "consumedOz",
    "completedCycles",
  ]) {
    const n = numFromQuery(q[k]);
    if (n !== undefined) out[k] = n;
  }
  if (typeof q["sweatProfile"] === "string") out["sweatProfile"] = q["sweatProfile"];
  if (typeof q["environmentProfile"] === "string") {
    out["environmentProfile"] = q["environmentProfile"];
  }
  return out;
}

router.use("/admin/demand", requireAdmin);

router.post("/admin/demand/snapshot", (req, res) => {
  const parsed = InputsSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "invalid_inputs", issues: parsed.error.issues });
    return;
  }
  const inputs: HydrationDemandInputs = parsed.data;
  const outputs = computeHydrationDemand(inputs);
  res.json({ inputs, outputs });
});

router.get("/admin/demand/snapshot", (req, res) => {
  const parsed = InputsSchema.safeParse(inputsFromQuery(req.query));
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "invalid_inputs", issues: parsed.error.issues });
    return;
  }
  const inputs: HydrationDemandInputs = parsed.data;
  const outputs = computeHydrationDemand(inputs);
  res.json({ inputs, outputs });
});

export default router;
