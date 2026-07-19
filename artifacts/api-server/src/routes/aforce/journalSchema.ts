/**
 * Pure request/domain schema for the Hydration Journal snapshot write.
 *
 * Kept free of any `@workspace/db` (or other side-effectful) import so the
 * app↔backend contract can be validated in isolation — no DATABASE_URL, no
 * connection. `routes/aforce/journal.ts` imports these; contract tests import
 * this module directly.
 */
import { z } from "zod";

export const LEVELS = ["PEAK", "BALANCED", "RECOVERING", "DEPLETED"] as const;

export const snapshotSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(LEVELS),
  ozConsumedToday: z.number().min(0).default(0),
  aforceUnitsToday: z.number().int().min(0).default(0),
  unitsConsumedToday: z.number().int().min(0).default(0),
  sodiumDeliveredMg: z.number().min(0).default(0),
  sodiumLostMg: z.number().min(0).default(0),
  deficitPct: z.number().min(0).default(0),
  clutchActive: z.boolean().default(false),
  socialActive: z.boolean().default(false),
  autopilotActive: z.boolean().default(false),
  reason: z.string().max(280).default(""),
  // Recovery Layer — all optional; persisted only when the client opts
  // in (i.e. `spec_recovery` is on). Server is content-agnostic.
  recoveryScore: z.number().int().min(0).max(100).optional(),
  pressureScore: z.number().int().min(0).max(100).optional(),
  recoveryTrend: z.enum(["rising", "stable", "declining"]).optional(),
  recoveryFingerprint: z.string().regex(/^[0-9a-f]{8}$/).optional(),
  recoveryStory: z.string().max(280).optional(),
});

export type SnapshotInput = z.infer<typeof snapshotSchema>;
