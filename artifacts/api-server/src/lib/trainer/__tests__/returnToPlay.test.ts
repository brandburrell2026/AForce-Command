/**
 * Return-to-play — the two Phase 6 acceptance criteria.
 *
 *   "no code path can auto-advance a stage, and the coach payload is proven
 *    free of medical context by test."
 *
 * The first is proven two ways: behaviourally, by showing that nothing except
 * a new sign-off changes the derived stage, and structurally, by reading the
 * module's own source for the ingredients an auto-advance would need.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  COACH_FORBIDDEN_FIELDS,
  canSignOff,
  coachView,
  deriveState,
  staffView,
  type RtpSource,
} from "../returnToPlay";

const STAGES = [
  { key: "rest", label: "Symptom-limited activity", description: "Daily activities only" },
  { key: "light_aerobic", label: "Light aerobic", description: "Walking or stationary bike" },
  { key: "sport_specific", label: "Sport-specific", description: "Running drills, no impact" },
  { key: "non_contact", label: "Non-contact training", description: "Harder training drills" },
  { key: "full_contact", label: "Full contact practice", description: "Normal training" },
  { key: "return", label: "Return to play", description: "Normal game play" },
];

const NOTE = "tolerated 20 minutes without symptom return";
const STOPPED_REASON = "symptoms returned at stage 3";

function source(over: Partial<RtpSource> = {}): RtpSource {
  return {
    progressionId: "rtp_1",
    athleteUserId: "user_athlete_1",
    stages: STAGES,
    signoffs: [],
    status: "active",
    startedAt: "2026-09-10T08:00:00.000Z",
    availabilityStatus: "limited",
    ...over,
  };
}

function signoff(stageIndex: number, at: string, note: string | null = NOTE) {
  return {
    stageIndex,
    stageKey: STAGES[stageIndex]!.key,
    signedByUserId: "user_trainer_1",
    signedAt: at,
    note,
  };
}

describe("a stage advances only when a human signs it", () => {
  it("starts at stage 0 with nothing signed", () => {
    const state = deriveState(source());
    expect(state.currentStageIndex).toBe(0);
    expect(state.currentStage?.key).toBe("rest");
    expect(state.completedCount).toBe(0);
  });

  it("advances exactly one stage per sign-off", () => {
    const one = deriveState(source({ signoffs: [signoff(0, "2026-09-11T08:00:00.000Z")] }));
    expect(one.currentStageIndex).toBe(1);

    const two = deriveState(
      source({
        signoffs: [signoff(0, "2026-09-11T08:00:00.000Z"), signoff(1, "2026-09-12T08:00:00.000Z")],
      }),
    );
    expect(two.currentStageIndex).toBe(2);
  });

  it("returns the same state however many times it is called — no clock, no drift", () => {
    const s = source({ signoffs: [signoff(0, "2026-09-11T08:00:00.000Z")] });
    const first = deriveState(s);
    const second = deriveState(s);
    const third = deriveState({ ...s });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("does not skip past a gap — an out-of-order sign-off advances nothing", () => {
    // Stages 0 and 2 signed, 1 missing. The athlete is at stage 1.
    const state = deriveState(
      source({
        signoffs: [signoff(0, "2026-09-11T08:00:00.000Z"), signoff(2, "2026-09-13T08:00:00.000Z")],
      }),
    );
    expect(state.currentStageIndex).toBe(1);
    expect(state.completedCount).toBe(1);
  });

  it("reports completion only when every stage is signed", () => {
    const all = STAGES.map((_, i) => signoff(i, `2026-09-1${i}T08:00:00.000Z`));
    const state = deriveState(source({ signoffs: all }));
    expect(state.currentStageIndex).toBeNull();
    expect(state.currentStage).toBeNull();
    expect(state.completedCount).toBe(STAGES.length);
  });

  it("keeps attribution on every sign-off in the history", () => {
    const state = deriveState(source({ signoffs: [signoff(0, "2026-09-11T08:00:00.000Z")] }));
    expect(state.history[0]).toMatchObject({
      signedByUserId: "user_trainer_1",
      signedAt: "2026-09-11T08:00:00.000Z",
    });
  });

  it("has no ingredient an auto-advance would need", () => {
    const src = readFileSync(join(__dirname, "..", "returnToPlay.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of [
      "Date.now",
      "new Date(",
      "setTimeout",
      "setInterval",
      "elapsed",
      "hydrationScore",
      "readinessScore",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });
});

describe("sign-off is refused unless it is the next stage", () => {
  it("accepts the current stage", () => {
    expect(canSignOff(source(), 0)).toEqual({ ok: true });
  });

  it("refuses a skip", () => {
    expect(canSignOff(source(), 2)).toEqual({ ok: false, reason: "stage_out_of_order" });
  });

  it("refuses a repeat", () => {
    const s = source({ signoffs: [signoff(0, "2026-09-11T08:00:00.000Z")] });
    expect(canSignOff(s, 0)).toEqual({ ok: false, reason: "stage_already_signed" });
  });

  it("refuses an index outside the protocol", () => {
    expect(canSignOff(source(), -1)).toEqual({ ok: false, reason: "stage_out_of_range" });
    expect(canSignOff(source(), 99)).toEqual({ ok: false, reason: "stage_out_of_range" });
    expect(canSignOff(source(), 1.5)).toEqual({ ok: false, reason: "stage_out_of_range" });
  });

  it("refuses anything once the progression is stopped or completed", () => {
    expect(canSignOff(source({ status: "stopped" }), 0)).toEqual({
      ok: false,
      reason: "progression_not_active",
    });
    expect(canSignOff(source({ status: "completed" }), 0)).toEqual({
      ok: false,
      reason: "progression_not_active",
    });
  });
});

describe("the coach payload carries no medical context", () => {
  const withEverything = source({
    signoffs: [signoff(0, "2026-09-11T08:00:00.000Z"), signoff(1, "2026-09-12T08:00:00.000Z")],
    status: "stopped",
    stoppedReason: STOPPED_REASON,
  });

  it("has exactly four keys", () => {
    expect(Object.keys(coachView(withEverything))).toEqual([
      "athleteUserId",
      "stageLabel",
      "stageProgress",
      "availabilityStatus",
    ]);
  });

  it("contains no forbidden field name and no note text", () => {
    const json = JSON.stringify(coachView(withEverything));
    for (const field of COACH_FORBIDDEN_FIELDS) {
      expect(json).not.toContain(`"${field}"`);
    }
    expect(json).not.toContain(NOTE);
    expect(json).not.toContain(STOPPED_REASON);
    // Not even who signed, or when: that is a medical disclosure by another route.
    expect(json).not.toContain("user_trainer_1");
    expect(json).not.toContain("2026-09-11");
  });

  it("shows movement without content", () => {
    const view = coachView(withEverything);
    expect(view.stageProgress).toBe("2 of 6");
    expect(view.stageLabel).toBe("Sport-specific");
    expect(view.availabilityStatus).toBe("limited");
  });

  it("carries no stage description — the label is the whole disclosure", () => {
    const json = JSON.stringify(coachView(source()));
    for (const stage of STAGES) {
      if (stage.description) expect(json).not.toContain(stage.description);
    }
  });

  it("says nothing at all once the progression is complete", () => {
    const all = STAGES.map((_, i) => signoff(i, `2026-09-1${i}T08:00:00.000Z`));
    const view = coachView(source({ signoffs: all, status: "completed" }));
    expect(view.stageLabel).toBeNull();
    expect(view.stageProgress).toBe("6 of 6");
  });
});

describe("the staff view keeps what the coach view drops", () => {
  it("includes notes, the stopped reason and the full history", () => {
    const view = staffView(
      source({
        signoffs: [signoff(0, "2026-09-11T08:00:00.000Z")],
        status: "stopped",
        stoppedReason: STOPPED_REASON,
      }),
    );
    expect(view.stoppedReason).toBe(STOPPED_REASON);
    expect(view.history[0]!.note).toBe(NOTE);
    expect(view.stages).toHaveLength(6);
  });
});
