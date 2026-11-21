/**
 * One Breath conversation controller — runs the conversation screen.
 *
 * It feeds each input to `oneBreathTurn`, keeps the exchange, and carries out
 * the turn's effects through the owning services (`./effects`). It decides
 * nothing: the engine decides what a turn means, the owners decide whether a
 * write is allowed, and this reports what they answered.
 *
 * Guarantees:
 *  - Once only. An effect id that is running or done is never run again; a
 *    plan sealed again after an Undo or a failure is a new attempt.
 *  - In order. Effects run one at a time, so an Undo can never overtake the
 *    seal it reverses.
 *  - Truthful. A step is marked done only after its owner resolves, and failed
 *    when it rejects; on failure the session is put back to what is true.
 *  - What is sealed is what was shown. The plan steps on screen are the
 *    reviewed Moment the seal saves; a stale review is refused, not refreshed
 *    silently.
 *  - Time and interruption. A held drink is logged when its six seconds end,
 *    or at once if the screen goes away, and never twice.
 */
import { preparationReviewMatches } from "@/services/momentPreparation";
import type { Moment } from "@/types/moments";
import { effectKey, type ConversationEntry, type PlanRow } from "@/utils/oneBreath/conversation";
import { planSealId } from "@/utils/oneBreath/planTurn";
import {
  effectFailed,
  emptyOneBreathState,
  ONE_BREATH_LINES,
  oneBreathTurn,
  type OneBreathContext,
  type OneBreathEffect,
  type OneBreathInput,
  type OneBreathState,
  type OneBreathTurn,
} from "@/utils/oneBreath/session";
import { lockInMoment, logDrink, reviewPlan, sealReviewed, unsealMoment, type OneBreathOwners } from "./effects";

export interface ConversationSnapshot {
  entries: readonly ConversationEntry[];
  session: OneBreathState;
  done: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  /** The waiting plan's steps, exactly as a seal would save them. */
  planRows?: readonly PlanRow[];
  planNote?: string;
  /** Why the waiting plan cannot be sealed as it stands, in the owner's words. */
  planError?: string;
}

export interface ConversationHost {
  /** Everything the engine is told about the member right now, read fresh each turn. */
  context: () => OneBreathContext;
  owners: OneBreathOwners;
  /** Opens a screen by the engine's key. Returns false when there is no such screen. */
  openScreen: (screen: string) => boolean;
  now?: () => number;
  /** How a step's time is written, e.g. "6:10 AM". */
  clock?: (iso: string) => string;
}

/** Shown when a plan has no current-guidance step: the existing Plan screen's own line. */
export const PLAN_NO_COMMAND_NOTE = "Check your current guidance when you’re ready to prepare.";

const defaultClock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export interface OneBreathConversationController {
  getSnapshot: () => ConversationSnapshot;
  subscribe: (listener: () => void) => () => void;
  send: (input: OneBreathInput) => void;
  /** The screen is going away or the app went to the background. */
  interrupt: () => void;
  /** Resolves when every effect asked for so far has been answered. */
  settled: () => Promise<void>;
  dispose: () => void;
}

export function createOneBreathConversation(host: ConversationHost): OneBreathConversationController {
  const now = host.now ?? Date.now;
  const clock = host.clock ?? defaultClock;
  const listeners = new Set<() => void>();
  let entries: ConversationEntry[] = [];
  let session = emptyOneBreathState();
  const done = new Set<string>();
  const failed = new Set<string>();
  /** Effect ids running or carried out. The once-only guard. */
  const claimed = new Set<string>();
  /** The reviewed Moment shown for a plan, by its seal id. */
  let review: { sealId: string; moment?: Moment; base?: Moment; error?: string } | undefined;
  /** Moments this conversation sealed, by seal id, for Undo. */
  const sealedMoments = new Map<string, Moment>();
  /** A Moment unsealed by Undo: sealing its plan again updates it rather than saving another. */
  let carried: Moment | undefined;
  let queue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastTick = now();
  let disposed = false;
  let snapshot: ConversationSnapshot;

  const refreshReview = () => {
    const plan = session.pendingPlan;
    if (!plan || session.asking || !plan.date || !plan.time24) {
      review = undefined;
      return;
    }
    const sealId = planSealId(plan);
    const command = host.owners.command();
    if (review?.sealId === sealId && review.base === carried && (review.error || (review.moment && preparationReviewMatches(review.moment, command, now())))) return;
    const result = reviewPlan(plan, command, now(), carried);
    review = result.ok ? { sealId, moment: result.moment, base: carried } : { sealId, error: result.error, base: carried };
  };

  const publish = () => {
    refreshReview();
    const steps = review?.moment?.preparation?.steps;
    snapshot = {
      entries,
      session,
      done: new Set(done),
      failed: new Set(failed),
      ...(steps ? { planRows: steps.map((s) => ({ at: clock(s.atIso), text: s.action })) } : {}),
      ...(steps && !steps.some((s) => s.commandId) ? { planNote: PLAN_NO_COMMAND_NOTE } : {}),
      ...(review?.error ? { planError: review.error } : {}),
    };
    if (!disposed) listeners.forEach((l) => l());
  };

  type Review = NonNullable<typeof review>;
  const carryOut = async (effect: OneBreathEffect, input: OneBreathInput, shownReview: Review | undefined): Promise<void> => {
    const owners = host.owners;
    switch (effect.kind) {
      case "save_moment": {
        // The review that was on screen when the member sealed, not a later one.
        const shown = shownReview?.sealId === effect.id ? shownReview : undefined;
        if (!shown?.moment) throw new Error(shown?.error ?? "Review again before sealing.");
        const method = input.kind === "say" ? (input.via === "spoken" ? "voice" : "typed") : "hold";
        const saved = await sealReviewed(owners, shown.moment, method, shown.base);
        sealedMoments.set(effect.id, saved);
        carried = undefined;
        return;
      }
      case "undo_moment": {
        const saved = sealedMoments.get(effect.of);
        if (!saved) throw new Error("Nothing to undo.");
        carried = await unsealMoment(owners, saved.id);
        sealedMoments.delete(effect.of);
        // The plan may be sealed again: that is a new save.
        claimed.delete(effect.of);
        return;
      }
      case "lock_in": {
        const momentId = effect.id.slice("lock-in:".length);
        if (!momentId || momentId === "current") throw new Error("No Moment to lock in.");
        await lockInMoment(owners, momentId);
        return;
      }
      case "log_drink":
        await logDrink(owners, effect);
        return;
      case "open_screen":
        if (!host.openScreen(effect.screen)) throw new Error("No such screen.");
        return;
      default:
        // Sends, shares, "made it back" and lessons are not connected here.
        throw new Error("Not available here yet.");
    }
  };

  const enqueue = (effect: OneBreathEffect, input: OneBreathInput, index: number, shownReview: Review | undefined) => {
    const key = effectKey(index, effect.id);
    if (claimed.has(effect.id)) {
      // The same request twice: it is already running or done. Nothing more happens.
      queue = queue.then(() => {
        done.add(key);
        publish();
      });
      return;
    }
    claimed.add(effect.id);
    queue = queue.then(async () => {
      try {
        await carryOut(effect, input, shownReview);
        done.add(key);
      } catch {
        claimed.delete(effect.id);
        failed.add(key);
        session = effectFailed(session, effect);
      }
      publish();
    });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastTick = now();
    const waits = [session.pendingDrink?.msLeft, session.sealUndo?.msLeft].filter((ms): ms is number => typeof ms === "number");
    if (disposed || waits.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      apply({ kind: "wait", ms: Math.max(1, now() - lastTick) });
    }, Math.min(...waits));
  };

  /** A reply the member can read for a request this screen cannot carry out. */
  const withLimit = (turn: OneBreathTurn): OneBreathTurn =>
    turn.reply.outcome === "not_built" ? { ...turn, reply: { outcome: "limit", request: turn.reply.request, text: ONE_BREATH_LINES.limit } } : turn;

  const step = (input: OneBreathInput) => {
    const shownReview = review;
    const turn = withLimit(oneBreathTurn(session, input, host.context()));
    session = turn.state;
    const worthShowing = input.kind === "say" || turn.effects.length > 0 || !!turn.reply.text;
    // Time passing and controls that did nothing leave no trace in the exchange.
    if (!worthShowing || (input.kind !== "say" && turn.reply.outcome === "limit")) return;
    const index = entries.length;
    entries = [...entries, { input, turn }];
    turn.effects.forEach((effect) => enqueue(effect, input, index, shownReview));
  };

  function apply(input: OneBreathInput) {
    // Real time first, so an Undo window is judged by the clock and not by when the next word arrived.
    const elapsed = now() - lastTick;
    if (input.kind !== "wait" && input.kind !== "interrupt" && elapsed > 0 && (session.pendingDrink || session.sealUndo)) {
      step({ kind: "wait", ms: elapsed });
    }
    step(input);
    schedule();
    publish();
  }

  publish();

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send: (input) => {
      if (!disposed) apply(input);
    },
    interrupt: () => apply({ kind: "interrupt" }),
    settled: () => queue,
    dispose: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      disposed = true;
      listeners.clear();
    },
  };
}
