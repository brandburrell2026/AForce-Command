/**
 * One Breath effects — carries out what a One Breath turn asks for, through
 * the services that already own each thing. Nothing here decides anything.
 *
 *  - A sealed plan is saved by the Moments store's reviewed commit, with the
 *    steps from the preparation service: the same record the existing
 *    Mirror → Plan → Seal flow saves.
 *  - Undo of a seal and Lock In are the same commits the existing Lock screen
 *    makes. Lock In goes through `lockInWithoutReminders`, which is where
 *    Quiet begins. There is no second Quiet.
 *  - A drink goes down the app's two existing rails: plain water through the
 *    store's `logIntake`, everything else to the drink log, which cannot move
 *    HydroState (C1). `drinkRoute` chooses, as it does for HydroScan.
 *
 * Every function either resolves once the owner has acknowledged, or throws.
 * A caller may only show "Sealed", "Logged" or "Locked in" after it resolves.
 */
import { DRINK_CATEGORIES, formatDrinkDisplayName, type DrinkCategoryId } from "@/data/drinkCatalog";
import { validateMomentDraft, createConfirmedMoment, type MomentDraft } from "@/services/momentDraft";
import { PREPARATION_POLICY_VERSION, preparationReviewMatches, reviewedPreparationSteps } from "@/services/momentPreparation";
import { preparationClosed } from "@/services/momentPreparationLifecycle";
import { alcoholDisclosure } from "@/services/momentSafetyContext";
import type { Moment, MomentPreparation, MomentType } from "@/types/moments";
import { drinkRoute } from "@/utils/hydration/drinkRoute";
import { evaluateMomentSafety } from "@/utils/intelligence/decisionGuard";
import type { OneBreathEffect, PlanDraft } from "@/utils/oneBreath/session";

export type Command = { id: string; action: string };

/** The owning services, handed in so this file reaches nothing on its own. */
export interface OneBreathOwners {
  /** `commitReviewedMoment` from the Moments store. */
  commitMoment: (moment: Moment, expected?: Moment, reviewIsCurrent?: () => boolean) => Promise<Moment>;
  /** `lockInWithoutReminders` from Quiet delivery. */
  lockIn: <T>(commit: () => Promise<T>) => Promise<T>;
  /** The store's `logIntake`. Resolves with the log's id only when the write landed. */
  logWater: (oz: number) => Promise<string | number | null | undefined>;
  /** `postRecordedDrink`: the drink log that never moves HydroState. */
  /** The store's `undoIntake`: takes a logged water back. Resolves false when it could not. */
  undoWater: (logId: string) => Promise<boolean>;
  recordDrink: (input: { categoryId: string; displayName: string; ozAmount: number; entrySource: "manual" }) => Promise<unknown>;
  /** Saved Moments, read when the effect runs. */
  moments: () => readonly Moment[];
  /** The member's current command, read when the effect runs. */
  command: () => Command;
  now?: () => number;
}

const transaction = () => `seal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export type PlanReview = { ok: true; moment: Moment } | { ok: false; error: string };

/**
 * Turns a complete read-back into the reviewed Moment the seal would save:
 * validated, with the preparation service's steps. Nothing is written.
 * `base` is the same Moment unsealed by an Undo, so sealing again updates it
 * instead of saving a second one.
 */
export function reviewPlan(plan: PlanDraft, command: Command, nowMs: number, base?: Moment): PlanReview {
  if (plan.type === "social") return { ok: false, error: "Social plans are made from Social." };
  const draft: MomentDraft = { title: plan.title, date: plan.date ?? "", time: plan.time24 ?? "", type: plan.type as MomentType, prepGoal: plan.goal ?? "" };
  const valid = validateMomentDraft(draft, nowMs);
  if (!valid.ok) return valid;
  // The same refusals the existing plan screen makes before it builds a plan.
  if (evaluateMomentSafety(`${draft.title} ${draft.prepGoal}`)) return { ok: false, error: "This needs the full plan screen." };
  if (alcoholDisclosure(draft.title) || alcoholDisclosure(draft.prepGoal)) return { ok: false, error: "Use a Moment name and priority without alcohol details." };
  const nowIso = new Date(nowMs).toISOString();
  const moment: Moment = {
    ...(base ?? createConfirmedMoment(draft, valid.startAtIso)),
    title: draft.title.trim(),
    type: draft.type,
    startAtIso: valid.startAtIso,
    prepGoal: draft.prepGoal.trim() || undefined,
    safetyContext: undefined,
  };
  const preparation: MomentPreparation = {
    version: 1,
    context: "one_breath",
    transactionId: transaction(),
    reviewedAtIso: nowIso,
    sealedAtIso: "",
    validUntilIso: new Date(Math.min(nowMs + 5 * 60000, Date.parse(valid.startAtIso))).toISOString(),
    returnMethod: "none",
    destination: "",
    emergencyNumber: base?.preparation?.emergencyNumber ?? "911",
    steps: reviewedPreparationSteps(moment, command, nowIso),
    policyVersion: PREPARATION_POLICY_VERSION,
  };
  return { ok: true, moment: { ...moment, preparation } };
}

/** Saves a reviewed plan as sealed. Refused if the review is no longer current. `expected` is the stored Moment it replaces, if any. */
export function sealReviewed(owners: OneBreathOwners, reviewed: Moment, method: "hold" | "typed" | "voice", expected?: Moment): Promise<Moment> {
  const now = owners.now ?? Date.now;
  const current = () => preparationReviewMatches(reviewed, owners.command(), now());
  if (!reviewed.preparation || !current()) return Promise.reject(new Error("Review again before sealing."));
  return owners.commitMoment(
    { ...reviewed, preparation: { ...reviewed.preparation, sealedAtIso: new Date(now()).toISOString(), sealedBy: { method } } },
    expected,
    current,
  );
}

/** Undo of a seal: the Moment stays saved, unsealed, exactly as the Lock screen's Undo leaves it. */
export function unsealMoment(owners: OneBreathOwners, momentId: string): Promise<Moment> {
  const sealed = owners.moments().find((m) => m.id === momentId);
  if (!sealed?.preparation?.sealedAtIso || sealed.preparation.lockedInAtIso) return Promise.reject(new Error("Nothing to undo."));
  const { sealedBy: _undone, ...unsealed } = sealed.preparation;
  return owners.commitMoment({ ...sealed, preparation: { ...unsealed, sealedAtIso: "", transactionId: transaction() } }, sealed);
}

/** Lock In for a sealed Moment, through the one owner of Quiet. */
export function lockInMoment(owners: OneBreathOwners, momentId: string): Promise<Moment> {
  const now = owners.now ?? Date.now;
  const saved = owners.moments().find((m) => m.id === momentId);
  if (!saved?.preparation?.sealedAtIso) return Promise.reject(new Error("No sealed Moment to lock in."));
  if (saved.preparation.lockedInAtIso) return Promise.resolve(saved);
  return owners.lockIn(() =>
    owners.commitMoment({ ...saved, preparation: { ...saved.preparation!, lockedInAtIso: new Date(now()).toISOString(), transactionId: transaction() } }, saved),
  );
}

/**
 * Ends an open plan the way the existing Quiet screens do: one commit that
 * stamps the outcome and drops any private safety context. A plan already
 * closed is left exactly as it is, so a second tap changes nothing.
 */
function closePlan(owners: OneBreathOwners, momentId: string, outcome: "returnedAtIso" | "cancelledAtIso"): Promise<Moment> {
  const now = owners.now ?? Date.now;
  const saved = owners.moments().find((m) => m.id === momentId);
  if (!saved?.preparation?.sealedAtIso) return Promise.reject(new Error("No sealed plan."));
  if (preparationClosed(saved.preparation)) return Promise.resolve(saved);
  // "Made it back" belongs to a plan that was locked in. A cancellation is never a return.
  if (outcome === "returnedAtIso" && !saved.preparation.lockedInAtIso) return Promise.reject(new Error("Not locked in."));
  return owners.commitMoment(
    { ...saved, safetyContext: undefined, preparation: { ...saved.preparation, [outcome]: new Date(now()).toISOString(), transactionId: transaction() } },
    saved,
  );
}

/** "Made it back": the plan is closed as returned. */
export const returnFromPlan = (owners: OneBreathOwners, momentId: string) => closePlan(owners, momentId, "returnedAtIso");

/** "My plan is cancelled": the plan is closed as cancelled, with no return recorded. */
export const cancelPlan = (owners: OneBreathOwners, momentId: string) => closePlan(owners, momentId, "cancelledAtIso");

/**
 * A Replay answer: the member's own answer about one Moment that has been
 * returned from. The same single commit the existing Replay makes; it never
 * reopens the plan and never changes how it ended.
 */
export function saveReplay(
  owners: OneBreathOwners,
  momentId: string,
  answer: Pick<MomentPreparation, "replay" | "replayObstacle" | "replayNote">,
): Promise<Moment> {
  const saved = owners.moments().find((m) => m.id === momentId);
  if (!saved?.preparation?.returnedAtIso) return Promise.reject(new Error("No returned plan."));
  return owners.commitMoment({ ...saved, preparation: { ...saved.preparation, ...answer, transactionId: transaction() } }, saved);
}

/** One drink, down the rail its kind belongs to. Only plain water can move HydroState. */
export async function logDrink(owners: OneBreathOwners, effect: Extract<OneBreathEffect, { kind: "log_drink" }>): Promise<string | undefined> {
  const name = effect.name ?? "";
  const route = drinkRoute({ categoryId: effect.categoryId, name, enteredOz: effect.oz });
  if (route.kind === "water") {
    const id = await owners.logWater(route.oz);
    // No id means the write did not land (or is only queued): never "Logged".
    if (id === null || id === undefined) throw new Error("Not logged.");
    return String(id);
  }
  const known = route.categoryId in DRINK_CATEGORIES;
  await owners.recordDrink({
    categoryId: route.categoryId,
    displayName: `${known ? formatDrinkDisplayName({ categoryId: route.categoryId as DrinkCategoryId, name }) : name || "Drink"} · ${effect.oz} oz`,
    ozAmount: route.oz,
    entrySource: "manual",
  });
  return undefined;
}

/** True when the hydration log can take this drink back: plain water, by the app's own routing. The drink log has no removal. */
export const canUndoLoggedDrink = (categoryId: string, name: string) => drinkRoute({ categoryId, name, enteredOz: 0 }).kind === "water";

/** The only log ids the existing undo accepts. Anything else is never guessed at. */
export const undoableLogId = (id: string | undefined): id is string => !!id && /^intake-\d+$/.test(id);
