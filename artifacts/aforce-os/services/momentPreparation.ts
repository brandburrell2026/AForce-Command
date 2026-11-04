/** Projection adapters for the existing Moment + guarded RecoveryCommand loop. */
import type { Moment, MomentPreparation } from "@/types/moments";
import { buildRecommendation } from "./momentRecommendation";
import { evaluateDeliverableCopy } from "@/utils/intelligence/decisionGuard";

export const PREPARATION_POLICY_VERSION = "social-v0.4-phase-a" as const;
export function reviewedPreparationSteps(
  moment: Moment,
  command: { id: string; action: string },
  nowIso: string,
): MomentPreparation["steps"] {
  const eligible =
    evaluateDeliverableCopy(command.action).verdict === "approved" &&
    !/\b(sticks?|aforce|electrolytes?|supplements?)\b/i.test(command.action);
  const rec = buildRecommendation(
    moment,
    eligible ? { canonicalCommand: command } : {},
    nowIso,
  );
  return rec.ritual
    .filter((s) => s.key !== "perform")
    .map((s) => ({
      atIso: s.atIso,
      action:
        s.key === "hydrate"
          ? command.action
          : s.key === "pause"
            ? "Take one breath."
            : "Lock In. Then quiet.",
      ...(s.key === "hydrate" ? { commandId: command.id } : {}),
    }));
}
export function isDayMoment(moment: Pick<Moment, "startAtIso">): boolean {
  const hour = new Date(moment.startAtIso).getHours();
  return hour >= 6 && hour < 18;
}
export function momentReturnLabel(now: Date): string {
  return now.getHours() >= 21 || now.getHours() < 6
    ? "Good night."
    : "Enjoy the rest of your day.";
}
export function rideHandoffUrl(provider: "uber" | "lyft"): string {
  // Phase A opens the provider. No hidden location, user words, or health data.
  return provider === "uber" ? "https://m.uber.com/" : "https://ride.lyft.com/";
}
