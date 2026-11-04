/** Projection adapters for the existing Moment + guarded RecoveryCommand loop. */
import type { Moment, MomentPreparation } from "@/types/moments";
import { nextMoment, surfaceableMoments } from "./momentRecommendation";
import {
  momentProposalKey,
  proposalCooldownUntil,
  type MomentProposalPreferences,
} from "./momentProposalPreferences";
import {
  MOMENT_NOTIFY_QUIET_START_HOUR,
  MOMENT_NOTIFY_QUIET_END_HOUR,
  MOMENT_PROPOSAL_LEAD_HOURS,
  MOMENT_PROPOSAL_MIN_LEAD_MIN,
} from "@/config/hydroStateModel";
import { buildRecommendation } from "./momentRecommendation";
import {
  evaluateDeliverableLabel,
  evaluateDeliverableCopy,
} from "@/utils/intelligence/decisionGuard";

export const PREPARATION_POLICY_VERSION = "social-v0.4-phase-a" as const;
export function reviewedPreparationSteps(
  moment: Moment,
  command: { id: string; action: string },
  nowIso: string,
  options: { happeningNow?: boolean } = {},
): MomentPreparation["steps"] {
  const now = Date.parse(nowIso);
  const timing = buildRecommendation(moment, {}, nowIso);
  // The canonical command describes the member NOW. Never freeze it into
  // tomorrow's plan or claim that today's dose is valid at a future time.
  // The existing Moments engine owns the preparation window; this adapter
  // only decides whether its mirror is timely. Silence is valid (RP-3).
  const inPreparation =
    now >= Date.parse(timing.prepWindowStartIso) &&
    (now <= Date.parse(moment.startAtIso) || options.happeningNow === true);
  const eligible =
    inPreparation &&
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
      // A newly reviewed action cannot be scheduled retroactively. Timing
      // stays with Moments; a current command is mirrored at review time.
      atIso: new Date(Math.max(now, Date.parse(s.atIso))).toISOString(),
      action:
        s.key === "hydrate"
          ? command.action
          : s.key === "pause"
            ? "Take one breath."
            : "Lock In. Then quiet.",
      ...(s.key === "hydrate" ? { commandId: command.id } : {}),
    }));
}
/** Validate the exact reviewed command, not just its semantic ID. A command
 * may change dose/copy while retaining its ID. This does not select advice. */
export function preparationReviewMatches(
  moment: Moment,
  command: { id: string; action: string },
  nowMs: number,
): boolean {
  const p = moment.preparation;
  if (
    !p ||
    p.policyVersion !== PREPARATION_POLICY_VERSION ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(Date.parse(p.reviewedAtIso)) ||
    Date.parse(p.reviewedAtIso) > nowMs ||
    !Number.isFinite(Date.parse(p.validUntilIso ?? "")) ||
    Date.parse(p.validUntilIso!) <= nowMs
  )
    return false;
  return p.steps.every(
    (step) =>
      !step.commandId ||
      (step.commandId === command.id &&
        step.action === command.action &&
        evaluateDeliverableCopy(command.action).verdict === "approved"),
  );
}

/** In-memory review binding only. Calendar titles never become a new record. */
export function preparationContextKey(moment: Moment | null): string {
  return moment
    ? JSON.stringify([
        moment.id,
        moment.source,
        moment.title,
        moment.startAtIso,
        moment.endAtIso ?? null,
        moment.masked ?? false,
      ])
    : "none";
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

/** Synthetic calendar fixtures are never an input to a persisted plan. */
export function isRealPreparationMoment(moment: Moment): boolean {
  return (
    moment.source !== "demo" &&
    !moment.id.startsWith("demo-") &&
    !moment.calendarEventId?.startsWith("demo-")
  );
}

/** Select real shared context, never a fabricated tomorrow or a completed/demo event. */
export function nextPreparationContext(
  moments: readonly Moment[],
  current: Pick<Moment, "id" | "startAtIso"> | undefined | null,
  nowIso: string,
): Moment | null {
  const after = Math.max(
    Date.parse(nowIso),
    current ? Date.parse(current.startAtIso) : 0,
  );
  return nextMoment(
    moments.filter(
      (m) =>
        isRealPreparationMoment(m) &&
        !m.masked &&
        m.title.trim().length > 0 &&
        evaluateDeliverableLabel(m.title).verdict === "approved" &&
        m.id !== current?.id &&
        Date.parse(m.startAtIso) > after,
    ),
    nowIso,
  );
}

/** Conservative in-app proposal adapter over existing Moments selectors and
 * the shared preference budget. No notifications, place inference or engine. */
export function preparationProposalCandidate(
  moments: readonly Moment[],
  prefs: MomentProposalPreferences,
  nowIso: string,
): Moment | null {
  const now = Date.parse(nowIso);
  const hour = new Date(nowIso).getHours();
  if (
    !Number.isFinite(now) ||
    hour >= MOMENT_NOTIFY_QUIET_START_HOUR ||
    hour < MOMENT_NOTIFY_QUIET_END_HOUR ||
    proposalCooldownUntil(prefs) > now
  )
    return null;
  if (
    moments.some(
      (m) =>
        m.source !== "demo" &&
        ((m.preparation?.sealedAtIso && !m.preparation.returnedAtIso) ||
          (Date.parse(m.startAtIso) <= now &&
            m.endAtIso &&
            Date.parse(m.endAtIso) > now)),
    )
  )
    return null;
  return (
    surfaceableMoments(moments, nowIso).find((m) => {
      if (
        !isRealPreparationMoment(m) ||
        (m.source !== "manual" && m.source !== "calendar") ||
        evaluateDeliverableLabel(m.title).verdict !== "approved" ||
        m.masked ||
        /\b(maybe|tentative|cancelled|canceled|declined)\b/i.test(m.title) ||
        m.preparedAtIso ||
        m.preparation ||
        m.importance === "low" ||
        prefs.neverTypes.includes(m.type) ||
        prefs.records.some((r) => r.key === momentProposalKey(m))
      )
        return false;
      const lead = (Date.parse(m.startAtIso) - now) / 3600000;
      if (lead < MOMENT_PROPOSAL_MIN_LEAD_MIN / 60) return false;
      if (m.type === "travel") return lead <= MOMENT_PROPOSAL_LEAD_HOURS.travel;
      // A generic personal title is not evidence of a Social moment. Exact
      // member/calendar words remain visible for correction before any Seal.
      return (
        m.type === "personal" &&
        lead <= MOMENT_PROPOSAL_LEAD_HOURS.personal &&
        /\b(dinner|lunch|brunch|party|celebration|reunion|picnic|pool|boat|beach|social)\b/i.test(
          m.title,
        )
      );
    }) ?? null
  );
}
