/**
 * Heat Risk Engine.
 *
 * Pure scoring service. Takes a HeatSignalInput, produces a HeatRiskScore.
 * No I/O, no React. Easy to swap to wearable inputs later.
 *
 * IMPORTANT:
 * - Output is a RISK PREDICTION, not a diagnosis.
 * - The "CRITICAL" band flags a severe risk pattern; it does NOT claim heat
 *   stroke or any medical condition.
 */

import type {
  HeatBandDisplay,
  HeatRiskBand,
  HeatRiskContribution,
  HeatRiskScore,
  HeatSignalInput,
  HeatTrendDirection,
} from "../types/heat";

// ─── Band configuration ─────────────────────────────────────────────────────
export const HEAT_BANDS: HeatBandDisplay[] = [
  {
    band: "STABLE",
    label: "STABLE",
    range: [0, 24],
    color: "#1FA35A", // Soursop green
    flashing: false,
    visualMode: "subtle",
    urgency: "calm",
    recheckMinutes: 35,
    shortDirective: "Maintenance hydration",
  },
  {
    band: "ELEVATED",
    label: "ELEVATED",
    range: [25, 44],
    color: "#FFC857", // gold
    flashing: false,
    visualMode: "warm_glow",
    urgency: "moderate",
    recheckMinutes: 20,
    shortDirective: "Increase cadence",
  },
  {
    band: "WARNING",
    label: "WARNING",
    range: [45, 64],
    color: "#FFA01E", // amber
    flashing: false,
    visualMode: "amber_tension",
    urgency: "high",
    recheckMinutes: 10,
    shortDirective: "Stop. Hydrate. Cool.",
  },
  {
    band: "HIGH_RISK",
    label: "HIGH RISK",
    range: [65, 84],
    color: "#FF5A1F", // red-orange
    flashing: false,
    visualMode: "red_tighten",
    urgency: "extreme",
    recheckMinutes: 5,
    shortDirective: "Stop activity now",
  },
  {
    band: "CRITICAL",
    label: "CRITICAL",
    range: [85, 100],
    color: "#FF2800", // WHOOP recovery red
    flashing: true,
    visualMode: "red_collapse",
    urgency: "imminent",
    recheckMinutes: 1,
    shortDirective: "Begin rapid cooling",
  },
];

export function bandForScore(score: number): HeatBandDisplay {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    HEAT_BANDS.find((b) => clamped >= b.range[0] && clamped <= b.range[1]) ??
    HEAT_BANDS[0]
  );
}

// ─── Heat index helper (Rothfusz simplified) ────────────────────────────────
export function computeHeatIndex(tempF: number, humidityPct: number): number {
  if (tempF < 80) return tempF;
  const T = tempF;
  const R = humidityPct;
  const HI =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;
  return HI;
}

// ─── Contribution calculators ───────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function heatIndexLoad(input: HeatSignalInput): HeatRiskContribution {
  const hi = input.heatIndexF ?? computeHeatIndex(input.ambientTempF, input.humidityPct);
  // Heat index thresholds per NWS:
  // <80 caution none, 80-90 caution, 90-103 extreme caution, 103-124 danger,
  // >=125 extreme danger. Map to 0-22 points.
  let raw = 0;
  if (hi >= 125) raw = 22;
  else if (hi >= 103) raw = 16 + ((hi - 103) / 22) * 6;
  else if (hi >= 90) raw = 8 + ((hi - 90) / 13) * 8;
  else if (hi >= 80) raw = ((hi - 80) / 10) * 8;
  // Sun exposure adds up to +4 on top.
  raw += input.sunExposure * 4;
  return {
    id: "heat_index",
    label: "Heat index load",
    points: clamp(Math.round(raw), 0, 26),
    maxPoints: 26,
    // CALCULATION NEUTRAL != OBSERVED EVIDENCE. `ambientTempF` is the
    // zero-risk neutral (70 °F) when no reading exists, so quoting it here
    // would publish a temperature AForce never measured. The POINTS are
    // unchanged either way — the neutral remains a legitimate engine input;
    // only the member-visible sentence is withheld.
    //
    // This was reachable, not theoretical: at the neutral, heat_index scores 0
    // and is filtered out of `topDrivers`, which is the ONLY thing that hid it.
    // Give the engine a real `sunExposure` — precisely what an environmental
    // UV feature supplies — and "Heat index 70°F is mild." renders.
    reason: !input.ambientTempMeasured
      ? 'Heat index unavailable — no local temperature reading.'
      : hi >= 103
        ? `Heat index ${Math.round(hi)}°F — danger zone.`
        : hi >= 90
        ? `Heat index ${Math.round(hi)}°F is elevated.`
        : `Heat index ${Math.round(hi)}°F is mild.`,
  };
}

function hydrationDeficit(input: HeatSignalInput): HeatRiskContribution {
  // hydrationScore 100 = no deficit (0 pts). Below 60 ramps fast.
  const deficit = Math.max(0, 100 - input.hydrationScore);
  let raw = 0;
  if (deficit > 40) raw = 12 + ((deficit - 40) / 60) * 8; // up to 20
  else raw = (deficit / 40) * 12;
  // Time since last intake compounds the deficit.
  if (input.minutesSinceLastIntake > 60) {
    raw += clamp((input.minutesSinceLastIntake - 60) / 30, 0, 4);
  }
  return {
    id: "hydration_deficit",
    label: "Hydration deficit",
    points: clamp(Math.round(raw), 0, 20),
    maxPoints: 20,
    reason:
      deficit > 30
        ? `Hydration score has dropped ${Math.round(deficit)} pts.`
        : `Hydration is holding (${input.hydrationScore} pts).`,
  };
}

function activityStress(input: HeatSignalInput): HeatRiskContribution {
  // Continuous exertion >30 min compounds; intensity multiplies.
  const minutes = input.continuousActiveMin;
  const minutesPts =
    minutes <= 20 ? 0 : minutes >= 80 ? 10 : ((minutes - 20) / 60) * 10;
  const intensityPts = input.activityIntensity * 6; // up to 6
  const raw = minutesPts + intensityPts;
  return {
    id: "activity_stress",
    label: "Activity stress",
    points: clamp(Math.round(raw), 0, 16),
    maxPoints: 16,
    reason:
      minutes > 40
        ? `Continuous exertion exceeded ${minutes} min.`
        : `Activity load is moderate.`,
  };
}

function heartRateStrain(input: HeatSignalInput): HeatRiskContribution {
  // Approximate "strain" as HR > 150 starts adding load.
  const hr = input.heartRateBpm;
  let raw = 0;
  if (hr >= 180) raw = 10;
  else if (hr >= 150) raw = ((hr - 150) / 30) * 10;
  // Recovery delay adds independent strain (slower recovery = worse).
  if (input.hrRecoveryDelaySec > 0) {
    raw += clamp(input.hrRecoveryDelaySec / 15, 0, 6);
  }
  return {
    id: "hr_strain",
    label: "Heart-rate strain",
    points: clamp(Math.round(raw), 0, 16),
    maxPoints: 16,
    reason:
      input.hrRecoveryDelaySec >= 30
        ? `Heart-rate recovery is delayed.`
        : hr >= 160
        ? `Heart rate is elevated at ${hr} bpm.`
        : `Heart rate trend is normal.`,
  };
}

function recoveryFailure(input: HeatSignalInput): HeatRiskContribution {
  // Low recovery momentum + recent heat event compounds.
  const base = (1 - clamp(input.recoveryMomentum, 0, 1)) * 6;
  const echo = input.recentHeatEvent ? 4 : 0;
  return {
    id: "recovery_failure",
    label: "Recovery momentum",
    points: clamp(Math.round(base + echo), 0, 10),
    maxPoints: 10,
    reason:
      input.recoveryMomentum < 0.5
        ? `Recovery momentum is low (${Math.round(input.recoveryMomentum * 100)}%).`
        : input.recentHeatEvent
        ? `Prior heat event in last 7 days.`
        : `Recovery momentum is healthy.`,
  };
}

function symptomRisk(input: HeatSignalInput): HeatRiskContribution {
  // Per-symptom weights. Confusion is the heaviest single signal.
  const weights: Record<string, number> = {
    confusion: 8,
    nausea: 5,
    dizziness: 5,
    cramping: 4,
    chills: 4,
    headache: 3,
    fatigue: 2,
  };
  const points = input.symptoms.reduce((acc, s) => acc + (weights[s] ?? 0), 0);
  // Urine darkness 5+ adds independent points.
  const urinePts = input.urineSignal >= 5 ? (input.urineSignal - 4) * 2 : 0;
  const raw = points + urinePts;
  return {
    id: "symptom_risk",
    label: "Warning signs",
    points: clamp(raw, 0, 18),
    maxPoints: 18,
    reason:
      input.symptoms.length > 0
        ? `Reported: ${input.symptoms.join(", ")}.`
        : input.urineSignal >= 5
        ? `Urine signal is dark (${input.urineSignal}/8).`
        : `No warning signs reported.`,
  };
}

function sleepPenalty(input: HeatSignalInput): HeatRiskContribution {
  const raw = clamp(input.sleepDeficitHrs * 1.5, 0, 6);
  return {
    id: "sleep_penalty",
    label: "Sleep deficit",
    points: Math.round(raw),
    maxPoints: 6,
    reason:
      input.sleepDeficitHrs >= 1.5
        ? `Sleep deficit ${input.sleepDeficitHrs.toFixed(1)} hr below baseline.`
        : `Sleep is on baseline.`,
  };
}

function sweatLossEstimate(input: HeatSignalInput): HeatRiskContribution {
  // Sweat loss as % of body weight per hour. >2% triggers concern.
  const lossPct =
    input.bodyWeightLbs > 0
      ? (input.sweatLossOzPerHr / 16 / input.bodyWeightLbs) * 100
      : 0;
  let raw = 0;
  if (lossPct >= 2.5) raw = 8;
  else if (lossPct >= 1.5) raw = 4 + ((lossPct - 1.5) / 1) * 4;
  else if (lossPct >= 0.8) raw = ((lossPct - 0.8) / 0.7) * 4;
  return {
    id: "sweat_loss",
    label: "Sweat loss estimate",
    points: clamp(Math.round(raw), 0, 8),
    maxPoints: 8,
    reason:
      lossPct >= 1.5
        ? `Sweat loss ~${lossPct.toFixed(1)}% body weight / hr.`
        : `Sweat loss is within range.`,
  };
}

// ─── Main entrypoint ────────────────────────────────────────────────────────
export interface ScoreOptions {
  /** Previous score for trend computation. */
  previousScore?: number;
}

export function evaluateHeatRisk(
  input: HeatSignalInput,
  opts: ScoreOptions = {},
): HeatRiskScore {
  const breakdown: HeatRiskContribution[] = [
    heatIndexLoad(input),
    hydrationDeficit(input),
    activityStress(input),
    heartRateStrain(input),
    recoveryFailure(input),
    symptomRisk(input),
    sleepPenalty(input),
    sweatLossEstimate(input),
  ];

  const rawSum = breakdown.reduce((acc, c) => acc + c.points, 0);
  const score = clamp(Math.round(rawSum), 0, 100);
  const band = bandForScore(score);

  // Trend.
  let trend: HeatTrendDirection = "steady";
  if (opts.previousScore != null) {
    const delta = score - opts.previousScore;
    if (delta >= 4) trend = "rising";
    else if (delta <= -4) trend = "falling";
  }

  const topDrivers = [...breakdown]
    .filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  const command = commandForBand(band.band);
  const commandDetail = commandDetailForBand(band.band, input);
  const cooldownMinutes = cooldownForBand(band.band);

  return {
    score,
    band: band.band,
    trend,
    urgency: band.urgency,
    visualMode: band.visualMode,
    topDrivers,
    breakdown,
    recheckMinutes: band.recheckMinutes,
    cooldownMinutes,
    command,
    commandDetail,
  };
}

/**
 * COMMAND-AUTHORITY CONTAINMENT (re-plumb wave, founder-authorized).
 * These strings previously issued their own hydration doses ("Drink 12
 * to 16 ounces now") and their own recheck clocks ("Recheck in 20
 * minutes") — a second command authority beside the canonical
 * RecoveryCommand, on safety-framed copy. The heat engine CALCULATES
 * (score, band, trend — unchanged above); its band copy now carries
 * heat-SAFETY behavior only (stop, shade, cooling, escalation) and
 * defers every hydration action to the member's current command, which
 * already reflects heat via the engine inputs. The band's
 * `recheckMinutes` (HEAT_BANDS config) remains the heat-risk
 * RE-ASSESSMENT cadence — the same ladder useHeatGuard runs — which is
 * this surface's own function; what was removed is the hydration-command
 * clock embedded in copy. No dose numbers or product pushes may return
 * here (services/__tests__/commandAuthorityContainment.test.ts).
 */
function commandForBand(band: HeatRiskBand): string {
  switch (band) {
    case "STABLE":
      return "Heat load is under control. Your current command stays the guide.";
    case "ELEVATED":
      return "Heat stress is building. Act on your current command now.";
    case "WARNING":
      return "Stop and cool down now. Act on your current command.";
    case "HIGH_RISK":
      return "Stop activity now. Move to shade or cooling. Act on your current command immediately.";
    case "CRITICAL":
      return "Critical heat risk rising. Stop activity now. Begin rapid cooling immediately and act on your current command. Seek on-site medical support if warning signs escalate.";
  }
}

function commandDetailForBand(band: HeatRiskBand, input: HeatSignalInput): string {
  switch (band) {
    case "STABLE":
      return "Maintain steady intake. Monitor environment as it changes.";
    case "ELEVATED":
      return "Heat stress trend detected. Increase intake cadence and watch the score.";
    case "WARNING":
      return "Heat stress pattern is forming. Action now prevents escalation.";
    case "HIGH_RISK":
      return "Dangerous heat trend detected. Aggressive cooling and fluids required.";
    case "CRITICAL":
      return input.symptoms.includes("confusion")
        ? "Confusion reported with extreme heat load — act urgently."
        : "Extreme heat risk pattern. Do not resume activity until cleared.";
  }
}

function cooldownForBand(band: HeatRiskBand): number {
  switch (band) {
    case "STABLE":
      return 0;
    case "ELEVATED":
      return 5;
    case "WARNING":
      return 10;
    case "HIGH_RISK":
      return 15;
    case "CRITICAL":
      return 20;
  }
}
