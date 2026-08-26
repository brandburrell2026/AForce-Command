/**
 * Heat Protocol Service.
 *
 * Maps a heat risk band to the appropriate intervention protocol with concrete
 * cooling and hydration actions, a cooldown timer, and a return-to-activity
 * gate. Used by the HeatRiskScreen and the Guardian view to drive the
 * "what to do RIGHT NOW" card.
 */

import type {
  CoolingAction,
  HeatProtocol,
  HeatProtocolId,
  HeatRiskBand,
  HeatRiskScore,
} from "../types/heat";

const HEAT_RESET: HeatProtocol = {
  id: "heat_reset",
  title: "Heat Reset",
  appliesTo: ["ELEVATED"],
  durationMinutes: 5,
  tone: "info",
  actions: [
    { id: "drink", label: "Drink 12–16 ounces fluids now", detail: "Stick or RTD preferred." },
    { id: "shade", label: "Step out of direct sun for 3 min" },
    { id: "breathe", label: "Reset breathing — 4 in, 6 out" },
  ],
};

const SHADE_RECOVERY: HeatProtocol = {
  id: "shade_recovery",
  title: "Shade Recovery",
  appliesTo: ["WARNING"],
  durationMinutes: 10,
  tone: "warn",
  actions: [
    { id: "stop", label: "Stop activity and sit in shade" },
    { id: "drink", label: "Drink 16–20 ounces fluids", detail: "Stick or canister mix." },
    { id: "cool", label: "Cool neck and forearms with water or ice" },
    { id: "watch", label: "Watch for dizziness or nausea" },
  ],
  returnGate: {
    maxScore: 35,
    minHydrationScore: 70,
    noSymptoms: true,
    recoveryTimerComplete: true,
  },
};

const HYDRATION_RECOVERY: HeatProtocol = {
  id: "hydration_recovery",
  title: "Hydration Recovery",
  appliesTo: ["WARNING", "HIGH_RISK"],
  durationMinutes: 15,
  tone: "warn",
  actions: [
    { id: "stop", label: "Stop work intervals immediately" },
    { id: "force_drink", label: "Drink 24 ounces of AForce in under 10 min" },
    { id: "rest", label: "Rest seated, legs flat" },
    { id: "recheck", label: "Recheck score in 5 min" },
  ],
  returnGate: {
    maxScore: 40,
    minHydrationScore: 75,
    noSymptoms: true,
    recoveryTimerComplete: true,
  },
};

const EMERGENCY_COOLDOWN: HeatProtocol = {
  id: "emergency_cooldown",
  title: "Emergency Cooldown",
  appliesTo: ["HIGH_RISK", "CRITICAL"],
  durationMinutes: 20,
  tone: "critical",
  actions: [
    { id: "stop", label: "Stop activity NOW" },
    { id: "shade", label: "Move to shade or air-conditioned space" },
    { id: "remove", label: "Remove non-essential layers and gear" },
    { id: "ice", label: "Apply ice / cold towels to neck, armpits, groin" },
    { id: "drink", label: "Sip cold fluids — do not chug if nauseous" },
    {
      id: "escalate",
      label: "Seek on-site medical support if warning signs escalate",
      detail: "Confusion, vomiting, or fainting → call emergency services.",
    },
  ],
  returnGate: {
    maxScore: 30,
    minHydrationScore: 80,
    noSymptoms: true,
    recoveryTimerComplete: true,
  },
};

const RETURN_TO_PLAY: HeatProtocol = {
  id: "return_to_play_pending",
  title: "Return to Activity — Pending Recovery",
  appliesTo: ["STABLE", "ELEVATED"],
  durationMinutes: 10,
  tone: "info",
  actions: [
    { id: "verify", label: "Verify hydration score above threshold" },
    { id: "verify_sym", label: "Confirm zero warning signs" },
    { id: "ramp", label: "Ramp activity intensity in 25% steps" },
    { id: "monitor", label: "Recheck score every 10 min for first hour" },
  ],
};

export const HEAT_PROTOCOLS: Record<HeatProtocolId, HeatProtocol> = {
  heat_reset: HEAT_RESET,
  shade_recovery: SHADE_RECOVERY,
  hydration_recovery: HYDRATION_RECOVERY,
  emergency_cooldown: EMERGENCY_COOLDOWN,
  return_to_play_pending: RETURN_TO_PLAY,
};

/** Map a band to the most-appropriate active protocol. */
export function activeProtocolFor(band: HeatRiskBand): HeatProtocol | null {
  switch (band) {
    case "STABLE":
      return null;
    case "ELEVATED":
      return HEAT_RESET;
    case "WARNING":
      return SHADE_RECOVERY;
    case "HIGH_RISK":
      // 15-min protocol matches cooldownForBand(HIGH_RISK) so the
      // command-meta timer and the protocol duration agree.
      return HYDRATION_RECOVERY;
    case "CRITICAL":
      return EMERGENCY_COOLDOWN;
  }
}

/** Quick-fire intervention list (drives the "DO NOW" stack). */
export function immediateActions(band: HeatRiskBand): CoolingAction[] {
  const protocol = activeProtocolFor(band);
  return protocol?.actions ?? [];
}

/** Decide if an athlete is cleared to return to activity. */
export interface ReturnGateInput {
  currentScore: number;
  hydrationScore: number;
  activeSymptomCount: number;
  recoveryTimerCompleted: boolean;
  band: HeatRiskBand;
}

export interface ReturnDecision {
  cleared: boolean;
  blockers: string[];
}

export function evaluateReturnGate(input: ReturnGateInput): ReturnDecision {
  const protocol = activeProtocolFor(input.band);
  const gate = protocol?.returnGate;
  if (!gate) {
    // No active protocol = nothing to clear from.
    return { cleared: true, blockers: [] };
  }
  const blockers: string[] = [];
  if (input.currentScore > gate.maxScore) {
    blockers.push(`Heat risk above ${gate.maxScore}.`);
  }
  if (input.hydrationScore < gate.minHydrationScore) {
    blockers.push(`Hydration below ${gate.minHydrationScore}.`);
  }
  if (gate.noSymptoms && input.activeSymptomCount > 0) {
    blockers.push(`Active warning signs reported.`);
  }
  if (gate.recoveryTimerComplete && !input.recoveryTimerCompleted) {
    blockers.push(`Recovery timer still running.`);
  }
  return { cleared: blockers.length === 0, blockers };
}

/** Convenience helper: pull the protocol for a full HeatRiskScore. */
export function protocolForScore(score: HeatRiskScore): HeatProtocol | null {
  return activeProtocolFor(score.band);
}
