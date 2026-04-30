/**
 * Cruise Mode Engine.
 *
 * Pure scoring service for the AForce OS Cruise Mode premium feature.
 * Models hydration risk for cruise crew (long shifts, heat, sweat) and guests
 * (sun, alcohol, excursions, sleep) layered on top of the live hydration score.
 *
 * No I/O, no React. The screen passes a CruiseSession in, gets a CruiseEvaluation
 * back. Demo profiles are exported for the operator-style dashboard.
 *
 * IMPORTANT — these are RISK PREDICTIONS, not medical diagnoses. The
 * RECOVERY_CRITICAL band flags a severe pattern; emergency-services language is
 * suggested as an action the user MAY need to take, not as a determination.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type CruiseUserType = "crew" | "guest";

export type CruiseCrewRole =
  | "housekeeping"
  | "food_beverage"
  | "entertainment"
  | "deck_crew"
  | "spa_fitness"
  | "officer";

export type CruiseGuestType =
  | "family"
  | "athlete"
  | "older_traveler"
  | "party"
  | "excursion";

export type CruiseStatus =
  | "OPTIMIZED"
  | "MONITOR"
  | "DEHYDRATION_RISK"
  | "RECOVERY_NEEDED";

export type CruiseRiskLevel = "LOW" | "MODERATE" | "HIGH" | "RECOVERY_CRITICAL";

export interface EnvironmentFactors {
  ambientTempF: number;
  humidityPct: number;
  sunExposureHours: number;
  deckExposure: "indoor" | "mixed" | "outdoor";
  dayMode: "sea_day" | "port_day";
  excursionRisk: "none" | "low" | "moderate" | "high";
}

export interface CrewSession {
  role: CruiseCrewRole;
  shiftLengthHours: number; // 0–14
  steps: number;
  sweatRiskLevel: "low" | "moderate" | "high";
  hoursSinceBreak: number;
}

export interface GuestSession {
  guestType: CruiseGuestType;
  poolHours: number;
  alcoholDrinks: number;
  excursionHours: number;
  fitnessHours: number;
  sleepQualityPct: number; // 0–100, from health
}

export interface CruiseSession {
  userType: CruiseUserType;
  hydrationScore: number; // 0–100 — comes from engine
  minutesSinceLastIntake: number;
  env: EnvironmentFactors;
  crew?: CrewSession;
  guest?: GuestSession;
}

export interface CruiseEvaluation {
  score: number; // 0–100
  status: CruiseStatus;
  statusLabel: string;
  recommendation: string;
  riskLevel: CruiseRiskLevel;
  riskReasons: string[];
  envHeatIndexF: number;
  nextCheckMinutes: number;
}

const STATUS_LABEL: Record<CruiseStatus, string> = {
  OPTIMIZED: "Optimized",
  MONITOR: "Monitor",
  DEHYDRATION_RISK: "Dehydration Risk",
  RECOVERY_NEEDED: "Recovery Needed",
};

export const RISK_LABEL: Record<CruiseRiskLevel, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  RECOVERY_CRITICAL: "Recovery Critical",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** NOAA Rothfusz simplified heat-index regression (°F + RH %). */
function rothfusz(tempF: number, humidityPct: number): number {
  if (tempF < 80) return tempF;
  const T = tempF;
  const R = humidityPct;
  return (
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R
  );
}

// ─── Main evaluator ─────────────────────────────────────────────────────────

export function evaluateCruise(s: CruiseSession): CruiseEvaluation {
  const hi = rothfusz(s.env.ambientTempF, s.env.humidityPct);
  const reasons: string[] = [];

  // Start at the live hydration score (0–100) and erode it toward 0 with risk loads.
  let score = s.hydrationScore;
  let alcoholHit = 0;
  let sunHit = 0;
  let sleepHit = 0;
  let workHit = 0;

  // Heat / sun load
  const sunHours = s.env.sunExposureHours;
  if (hi >= 103) {
    sunHit += 18;
    reasons.push(`Heat index ${Math.round(hi)}°F — danger zone`);
  } else if (hi >= 90) {
    sunHit += 10;
    reasons.push(`Heat index ${Math.round(hi)}°F is elevated`);
  }
  if (sunHours >= 4) {
    sunHit += 8;
    reasons.push(`${sunHours.toFixed(1)} hrs in direct sun`);
  } else if (sunHours >= 2) {
    sunHit += 4;
    reasons.push(`${sunHours.toFixed(1)} hrs in sun`);
  }
  if (s.env.deckExposure === "outdoor") sunHit += 2;

  // Crew workload
  if (s.crew) {
    const c = s.crew;
    if (c.shiftLengthHours >= 8) {
      workHit += 10;
      reasons.push(`Long ${c.shiftLengthHours}h shift`);
    } else if (c.shiftLengthHours >= 6) {
      workHit += 5;
    }
    if (c.steps >= 14000) {
      workHit += 6;
      reasons.push(`${c.steps.toLocaleString()} steps logged`);
    } else if (c.steps >= 10000) {
      workHit += 3;
    }
    if (c.sweatRiskLevel === "high") {
      workHit += 8;
      reasons.push("High-sweat role");
    } else if (c.sweatRiskLevel === "moderate") {
      workHit += 4;
    }
    if (c.hoursSinceBreak >= 3) {
      workHit += 4;
      reasons.push(`${c.hoursSinceBreak}h since last break`);
    }
  }

  // Guest behaviour
  if (s.guest) {
    const g = s.guest;
    if (g.alcoholDrinks >= 3) {
      alcoholHit += 14;
      reasons.push(`${g.alcoholDrinks} alcoholic drinks`);
    } else if (g.alcoholDrinks >= 1) {
      alcoholHit += 6;
      reasons.push(`${g.alcoholDrinks} alcoholic drink${g.alcoholDrinks > 1 ? "s" : ""}`);
    }
    if (g.poolHours >= 3) {
      sunHit += 4;
      reasons.push(`${g.poolHours} hrs poolside`);
    }
    if (g.excursionHours >= 3) {
      workHit += 6;
      reasons.push(`${g.excursionHours} hr excursion`);
    } else if (g.excursionHours >= 1) {
      workHit += 3;
    }
    if (g.sleepQualityPct < 60) {
      sleepHit += 8;
      reasons.push(`Sleep quality ${g.sleepQualityPct}%`);
    } else if (g.sleepQualityPct < 75) {
      sleepHit += 4;
    }
  }

  // Time since last intake compounds
  if (s.minutesSinceLastIntake > 90) {
    score -= 6;
    reasons.push(`${s.minutesSinceLastIntake} min since last sip`);
  } else if (s.minutesSinceLastIntake > 60) {
    score -= 3;
  }

  const totalLoad = alcoholHit + sunHit + sleepHit + workHit;
  score = clamp(Math.round(score - totalLoad), 0, 100);

  let status: CruiseStatus;
  if (score >= 80) status = "OPTIMIZED";
  else if (score >= 60) status = "MONITOR";
  else if (score >= 40) status = "DEHYDRATION_RISK";
  else status = "RECOVERY_NEEDED";

  let riskLevel: CruiseRiskLevel;
  const riskScore = totalLoad + (100 - score) * 0.4;
  if (riskScore >= 55) riskLevel = "RECOVERY_CRITICAL";
  else if (riskScore >= 35) riskLevel = "HIGH";
  else if (riskScore >= 18) riskLevel = "MODERATE";
  else riskLevel = "LOW";

  let recommendation: string;
  if (status === "OPTIMIZED") {
    recommendation = "Hydration locked. Maintain — sip water every 45 min.";
  } else if (status === "MONITOR") {
    recommendation = "Drink 8–12 oz water and complete one AForce hydration cycle.";
  } else if (status === "DEHYDRATION_RISK") {
    recommendation = "Drink 12–16 oz water + 1 AForce stick now. Recheck in 20 min.";
  } else {
    recommendation = "Recovery cycle: 16 oz water + 1 AForce + 5 min seated cool-down.";
  }

  const nextCheckMinutes =
    riskLevel === "RECOVERY_CRITICAL"
      ? 10
      : riskLevel === "HIGH"
        ? 20
        : riskLevel === "MODERATE"
          ? 35
          : 60;

  return {
    score,
    status,
    statusLabel: STATUS_LABEL[status],
    recommendation,
    riskLevel,
    riskReasons: reasons.slice(0, 5),
    envHeatIndexF: Math.round(hi),
    nextCheckMinutes,
  };
}

// ─── Demo profiles (for the screen + investor demo) ─────────────────────────

export interface CruiseDemoProfile {
  id: string;
  label: string;
  hint: string;
  session: CruiseSession;
}

export const CRUISE_DEMO_PROFILES: CruiseDemoProfile[] = [
  {
    id: "pool_guest",
    label: "Pool-day Guest",
    hint: "3 cocktails · 11k steps · high sun",
    session: {
      userType: "guest",
      hydrationScore: 54,
      minutesSinceLastIntake: 95,
      env: {
        ambientTempF: 88,
        humidityPct: 70,
        sunExposureHours: 5,
        deckExposure: "outdoor",
        dayMode: "sea_day",
        excursionRisk: "low",
      },
      guest: {
        guestType: "party",
        poolHours: 4,
        alcoholDrinks: 3,
        excursionHours: 0,
        fitnessHours: 0,
        sleepQualityPct: 72,
      },
    },
  },
  {
    id: "excursion_guest",
    label: "Excursion Guest",
    hint: "4-hr walking tour · high heat",
    session: {
      userType: "guest",
      hydrationScore: 48,
      minutesSinceLastIntake: 110,
      env: {
        ambientTempF: 92,
        humidityPct: 68,
        sunExposureHours: 4,
        deckExposure: "outdoor",
        dayMode: "port_day",
        excursionRisk: "high",
      },
      guest: {
        guestType: "excursion",
        poolHours: 0,
        alcoholDrinks: 1,
        excursionHours: 4,
        fitnessHours: 0,
        sleepQualityPct: 78,
      },
    },
  },
];

// ─── Aggregate (operator dashboard) demo ────────────────────────────────────

export interface CrewDeptRisk {
  department: string;
  hydrationCompliancePct: number;
  highRiskShiftWindow: string;
  aforceUsagePerCrew: number;
  riskLevel: CruiseRiskLevel;
}

export const CREW_AGGREGATE_DEMO: CrewDeptRisk[] = [
  { department: "Food & Beverage", hydrationCompliancePct: 71, highRiskShiftWindow: "14:00–18:00", aforceUsagePerCrew: 2.4, riskLevel: "HIGH" },
  { department: "Housekeeping", hydrationCompliancePct: 84, highRiskShiftWindow: "10:00–13:00", aforceUsagePerCrew: 1.8, riskLevel: "MODERATE" },
  { department: "Deck Crew", hydrationCompliancePct: 68, highRiskShiftWindow: "12:00–16:00", aforceUsagePerCrew: 2.1, riskLevel: "HIGH" },
  { department: "Spa & Fitness", hydrationCompliancePct: 91, highRiskShiftWindow: "—", aforceUsagePerCrew: 1.4, riskLevel: "LOW" },
  { department: "Entertainment", hydrationCompliancePct: 79, highRiskShiftWindow: "20:00–23:00", aforceUsagePerCrew: 1.9, riskLevel: "MODERATE" },
];

// ─── Fleet view (operator multi-ship dashboard) ─────────────────────────────

export interface FleetShip {
  id: string;
  name: string;
  line: string;
  portToday: string;
  totalCrew: number;
  fleetCompliancePct: number;
  highRiskCrewPct: number;
  departments: CrewDeptRisk[];
}

export const FLEET_DEMO: ReadonlyArray<FleetShip> = [
  {
    id: "symphony",
    name: "Symphony of the Seas",
    line: "Royal Caribbean",
    portToday: "Cozumel",
    totalCrew: 2200,
    fleetCompliancePct: 78,
    highRiskCrewPct: 14,
    departments: CREW_AGGREGATE_DEMO,
  },
  {
    id: "mardi_gras",
    name: "Mardi Gras",
    line: "Carnival Cruise Line",
    portToday: "Nassau",
    totalCrew: 1750,
    fleetCompliancePct: 72,
    highRiskCrewPct: 19,
    departments: [
      { department: "Food & Beverage", hydrationCompliancePct: 64, highRiskShiftWindow: "13:00–17:00", aforceUsagePerCrew: 2.7, riskLevel: "HIGH" },
      { department: "Housekeeping", hydrationCompliancePct: 77, highRiskShiftWindow: "09:00–12:00", aforceUsagePerCrew: 1.9, riskLevel: "MODERATE" },
      { department: "Deck Crew", hydrationCompliancePct: 61, highRiskShiftWindow: "11:00–15:00", aforceUsagePerCrew: 2.4, riskLevel: "HIGH" },
      { department: "Spa & Fitness", hydrationCompliancePct: 88, highRiskShiftWindow: "—", aforceUsagePerCrew: 1.5, riskLevel: "LOW" },
      { department: "Entertainment", hydrationCompliancePct: 74, highRiskShiftWindow: "20:00–23:00", aforceUsagePerCrew: 2.0, riskLevel: "MODERATE" },
    ],
  },
  {
    id: "scarlet_lady",
    name: "Scarlet Lady",
    line: "Virgin Voyages",
    portToday: "St. Thomas",
    totalCrew: 1150,
    fleetCompliancePct: 86,
    highRiskCrewPct: 8,
    departments: [
      { department: "Food & Beverage", hydrationCompliancePct: 82, highRiskShiftWindow: "14:00–17:00", aforceUsagePerCrew: 2.1, riskLevel: "MODERATE" },
      { department: "Housekeeping", hydrationCompliancePct: 90, highRiskShiftWindow: "—", aforceUsagePerCrew: 1.6, riskLevel: "LOW" },
      { department: "Deck Crew", hydrationCompliancePct: 80, highRiskShiftWindow: "12:00–15:00", aforceUsagePerCrew: 1.9, riskLevel: "MODERATE" },
      { department: "Spa & Fitness", hydrationCompliancePct: 94, highRiskShiftWindow: "—", aforceUsagePerCrew: 1.3, riskLevel: "LOW" },
      { department: "Entertainment", hydrationCompliancePct: 87, highRiskShiftWindow: "21:00–23:00", aforceUsagePerCrew: 1.7, riskLevel: "LOW" },
    ],
  },
  {
    id: "wonder",
    name: "Disney Wonder",
    line: "Disney Cruise Line",
    portToday: "Grand Cayman",
    totalCrew: 950,
    fleetCompliancePct: 83,
    highRiskCrewPct: 11,
    departments: [
      { department: "Food & Beverage", hydrationCompliancePct: 76, highRiskShiftWindow: "13:00–16:00", aforceUsagePerCrew: 2.3, riskLevel: "MODERATE" },
      { department: "Housekeeping", hydrationCompliancePct: 87, highRiskShiftWindow: "10:00–12:00", aforceUsagePerCrew: 1.7, riskLevel: "LOW" },
      { department: "Deck Crew", hydrationCompliancePct: 73, highRiskShiftWindow: "12:00–15:00", aforceUsagePerCrew: 2.0, riskLevel: "MODERATE" },
      { department: "Spa & Fitness", hydrationCompliancePct: 92, highRiskShiftWindow: "—", aforceUsagePerCrew: 1.3, riskLevel: "LOW" },
      { department: "Entertainment", hydrationCompliancePct: 88, highRiskShiftWindow: "19:00–22:00", aforceUsagePerCrew: 1.6, riskLevel: "LOW" },
    ],
  },
];

/** Roll-up of fleet KPIs for the dashboard hero strip. */
export interface FleetSummary {
  shipCount: number;
  totalCrew: number;
  weightedCompliancePct: number;
  highRiskCrewCount: number;
  topRiskShip: FleetShip;
}

export function summarizeFleet(fleet: ReadonlyArray<FleetShip>): FleetSummary {
  const totalCrew = fleet.reduce((sum, s) => sum + s.totalCrew, 0);
  const weighted = totalCrew === 0
    ? 0
    : Math.round(
        fleet.reduce((sum, s) => sum + s.fleetCompliancePct * s.totalCrew, 0) /
          totalCrew,
      );
  const highRisk = Math.round(
    fleet.reduce((sum, s) => sum + s.totalCrew * (s.highRiskCrewPct / 100), 0),
  );
  const topRiskShip = [...fleet].sort(
    (a, b) => b.highRiskCrewPct - a.highRiskCrewPct,
  )[0]!;
  return {
    shipCount: fleet.length,
    totalCrew,
    weightedCompliancePct: weighted,
    highRiskCrewCount: highRisk,
    topRiskShip,
  };
}

// ─── Port-day checklist (static) ────────────────────────────────────────────

export const PORT_DAY_CHECKLIST: ReadonlyArray<{ id: string; label: string; icon: string }> = [
  { id: "hydrate_before", label: "Hydrate before leaving the ship", icon: "droplet" },
  { id: "bring_aforce", label: "Bring an AForce stick", icon: "package" },
  { id: "log_outdoor", label: "Log outdoor activity", icon: "sun" },
  { id: "monitor_heat", label: "Monitor heat index every 30 min", icon: "thermometer" },
  { id: "recovery_after", label: "Recovery cycle after returning to ship", icon: "rotate-ccw" },
];

// ─── Engagement / rewards (cruise-specific badges) ──────────────────────────

export const CRUISE_BADGES: ReadonlyArray<{ id: string; title: string; hint: string }> = [
  { id: "deck_day", title: "Deck Day", hint: "4+ hrs poolside, hydrated through" },
  { id: "excursion_recovery", title: "Excursion Recovery", hint: "Recovery cycle within 60 min of return" },
  { id: "shift_warrior", title: "Shift Warrior", hint: "9+ hr shift with hydration above 70" },
  { id: "wellness_streak", title: "Wellness Streak", hint: "5 consecutive sea days, score ≥ 75" },
];

// ─── Role / guest copy maps ─────────────────────────────────────────────────

export const CREW_ROLE_LABEL: Record<CruiseCrewRole, string> = {
  housekeeping: "Housekeeping",
  food_beverage: "Food & Beverage",
  entertainment: "Entertainment",
  deck_crew: "Deck Crew",
  spa_fitness: "Spa & Fitness",
  officer: "Officer",
};

export const GUEST_TYPE_LABEL: Record<CruiseGuestType, string> = {
  family: "Family",
  athlete: "Athlete / Fitness",
  older_traveler: "Older Traveler",
  party: "Nightlife / Party",
  excursion: "Excursion",
};
