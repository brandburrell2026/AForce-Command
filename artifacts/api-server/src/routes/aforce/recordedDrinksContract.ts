/**
 * Input contract for drinks that have no approved HydroState rule.
 * Deliberately excludes water: water belongs to the scored `/intake` rail.
 */
import { z } from "zod";

export const RECORDED_DRINK_CATEGORY_IDS = [
  "coffee",
  "tea",
  "coffee_or_tea",
  "pre_workout",
  "energy_drink",
  "sports_drink",
  "alcohol",
  "smoothie",
  "juice",
  "soda",
  "electrolyte",
  "custom",
  "aforce",
  "sparkling_water",
] as const;

export const recordedDrinkSchema = z.object({
  categoryId: z.enum(RECORDED_DRINK_CATEGORY_IDS),
  displayName: z.string().trim().min(1).max(120),
  ozAmount: z.number().positive().max(64),
  entrySource: z.enum(["home", "hydration", "scan", "manual"]).optional(),
  clientEventId: z.string().min(1).max(64).optional(),
});
