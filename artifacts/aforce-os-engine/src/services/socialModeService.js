import { appendAlcoholCompliance } from "./commandEngine.js";

export function getSocialState(estimatedBac) {
  if (estimatedBac >= 0.16) return "critical";
  if (estimatedBac >= 0.08) return "high";
  if (estimatedBac >= 0.03) return "moderate";
  return "low";
}

export function generateSocialCommand(state, inventory) {
  const hasRtd = inventory.rtdCans > 0;

  let command;

  if (state === "moderate") {
    command = hasRtd
      ? "Open 1 AForce RTD can now. No mixing required. Wait 20 minutes before your next drink."
      : "Drink 12 oz of spring water or alkaline water now. Wait 20 minutes before your next drink.";
  }

  if (state === "high") {
    command = hasRtd
      ? "You are in High impairment. Your deficit is climbing. Open 1 AForce RTD can now. No mixing required."
      : "You are in High impairment. Drink 12 oz of spring water or alkaline water now.";
  }

  if (state === "critical") {
    command = hasRtd
      ? "You are in Critical impairment. Open 1 AForce RTD can right now. Do not take another drink. AutoPilot will check again in 8 minutes."
      : "You are in Critical impairment. Drink spring water or alkaline water right now. Do not take another drink. AutoPilot will check again in 8 minutes.";
  }

  return appendAlcoholCompliance(command || "Drink 12 oz of spring water now.");
}

export function socialControlPanel(data) {
  return {
    title: "CONTROL PANEL",
    ifYouDrinkAgain: {
      bac: data.nextBac,
      status: data.nextState,
      recoveryTimeAdded: `+${data.recoveryHoursAdded} hours`,
      hydrationDeficitAdded: `+${data.deficitAddedOz} oz`,
      hangoverRisk: `${data.hangoverRisk}/100`
    },
    currentState: {
      fluidDeficit: `${data.currentDeficitOz} oz`,
      recoveryVelocity: data.recoveryVelocity,
      scoreTrend: data.scoreTrend
    },
    command: data.command,
    subline: "→ Delay 20 min and stay in control"
  };
}
