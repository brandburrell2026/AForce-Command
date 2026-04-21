"use strict";
/**
 * Heat Guard mock data.
 *
 * Until wearable / weather inputs are wired, these mocks provide realistic
 * inputs across each risk band and a roster for the team / coach view. All
 * values are physiologically plausible.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BAND_LIST = exports.SAMPLE_INPUTS = void 0;
exports.buildMockRoster = buildMockRoster;
exports.buildMockAlertFeed = buildMockAlertFeed;
const heatRiskEngine_1 = require("../services/heatRiskEngine");
// ─── Sample inputs by band ──────────────────────────────────────────────────
exports.SAMPLE_INPUTS = {
    STABLE: {
        hydrationScore: 88,
        recentFluidOz: 18,
        minutesSinceLastIntake: 18,
        ambientTempF: 78,
        humidityPct: 45,
        sunExposure: 0.2,
        continuousActiveMin: 15,
        activityIntensity: 0.3,
        heartRateBpm: 118,
        hrRecoveryDelaySec: 0,
        sweatLossOzPerHr: 8,
        bodyWeightLbs: 185,
        recoveryMomentum: 0.85,
        symptoms: [],
        urineSignal: 2,
        energyState: "steady",
        sleepDeficitHrs: 0,
        recentHeatEvent: false,
    },
    ELEVATED: {
        hydrationScore: 70,
        recentFluidOz: 8,
        minutesSinceLastIntake: 38,
        ambientTempF: 88,
        humidityPct: 55,
        sunExposure: 0.5,
        continuousActiveMin: 28,
        activityIntensity: 0.55,
        heartRateBpm: 144,
        hrRecoveryDelaySec: 8,
        sweatLossOzPerHr: 16,
        bodyWeightLbs: 185,
        recoveryMomentum: 0.7,
        symptoms: [],
        urineSignal: 3,
        energyState: "steady",
        sleepDeficitHrs: 0.5,
        recentHeatEvent: false,
    },
    WARNING: {
        hydrationScore: 55,
        recentFluidOz: 4,
        minutesSinceLastIntake: 65,
        ambientTempF: 94,
        humidityPct: 60,
        sunExposure: 0.7,
        continuousActiveMin: 48,
        activityIntensity: 0.7,
        heartRateBpm: 162,
        hrRecoveryDelaySec: 22,
        sweatLossOzPerHr: 24,
        bodyWeightLbs: 185,
        recoveryMomentum: 0.5,
        symptoms: ["fatigue"],
        urineSignal: 5,
        energyState: "low",
        sleepDeficitHrs: 1,
        recentHeatEvent: false,
    },
    HIGH_RISK: {
        hydrationScore: 38,
        recentFluidOz: 2,
        minutesSinceLastIntake: 88,
        ambientTempF: 99,
        humidityPct: 65,
        sunExposure: 0.9,
        continuousActiveMin: 65,
        activityIntensity: 0.85,
        heartRateBpm: 174,
        hrRecoveryDelaySec: 38,
        sweatLossOzPerHr: 32,
        bodyWeightLbs: 185,
        recoveryMomentum: 0.32,
        symptoms: ["headache", "fatigue", "cramping"],
        urineSignal: 6,
        energyState: "low",
        sleepDeficitHrs: 1.5,
        recentHeatEvent: false,
    },
    CRITICAL: {
        hydrationScore: 22,
        recentFluidOz: 0,
        minutesSinceLastIntake: 110,
        ambientTempF: 104,
        humidityPct: 70,
        sunExposure: 1,
        continuousActiveMin: 82,
        activityIntensity: 0.9,
        heartRateBpm: 188,
        hrRecoveryDelaySec: 60,
        sweatLossOzPerHr: 40,
        bodyWeightLbs: 185,
        recoveryMomentum: 0.18,
        symptoms: ["dizziness", "nausea", "confusion"],
        urineSignal: 7,
        energyState: "crashed",
        sleepDeficitHrs: 2,
        recentHeatEvent: true,
    },
};
exports.BAND_LIST = heatRiskEngine_1.HEAT_BANDS;
const MOCK_ROSTER = [
    { id: "p_06", name: "T. Johnson", jerseyNumber: 6, position: "WR", pattern: "STABLE", trend: "steady" },
    { id: "p_07", name: "M. Reyes", jerseyNumber: 7, position: "RB", pattern: "CRITICAL", trend: "rising" },
    { id: "p_12", name: "K. Walker", jerseyNumber: 12, position: "QB", pattern: "HIGH_RISK", trend: "rising" },
    { id: "p_22", name: "J. Park", jerseyNumber: 22, position: "DB", pattern: "WARNING", trend: "rising" },
    { id: "p_31", name: "A. Cole", jerseyNumber: 31, position: "LB", pattern: "ELEVATED", trend: "rising" },
    { id: "p_44", name: "D. Brooks", jerseyNumber: 44, position: "OL", pattern: "WARNING", trend: "falling" },
    { id: "p_55", name: "E. Pierce", jerseyNumber: 55, position: "LB", pattern: "STABLE", trend: "steady" },
    { id: "p_88", name: "R. Singh", jerseyNumber: 88, position: "TE", pattern: "ELEVATED", trend: "steady" },
];
function alertStateForBand(band) {
    switch (band) {
        case "STABLE":
        case "ELEVATED":
            return "WATCH";
        case "WARNING":
        case "HIGH_RISK":
            return "INTERVENE";
        case "CRITICAL":
            return "PULL_NOW";
    }
}
function coachActionFor(band, name) {
    switch (band) {
        case "STABLE":
            return "On cadence. Keep monitoring.";
        case "ELEVATED":
            return "Push fluids at next break.";
        case "WARNING":
            return `Pull ${name} at next stoppage. Hydrate now.`;
        case "HIGH_RISK":
            return `Pull ${name} now. Begin shade recovery.`;
        case "CRITICAL":
            return `Remove ${name} immediately. Begin emergency cooldown.`;
    }
}
function buildMockRoster() {
    return MOCK_ROSTER.map((m) => {
        const score = (0, heatRiskEngine_1.evaluateHeatRisk)(exports.SAMPLE_INPUTS[m.pattern]);
        const band = (0, heatRiskEngine_1.bandForScore)(score.score).band;
        return {
            id: m.id,
            name: m.name,
            jerseyNumber: m.jerseyNumber,
            position: m.position,
            riskScore: score.score,
            band,
            trend: m.trend,
            hydrationScore: exports.SAMPLE_INPUTS[m.pattern].hydrationScore,
            alertState: alertStateForBand(band),
            coachAction: coachActionFor(band, m.name.split(" ")[1] ?? m.name),
            minutesSinceLastIntake: exports.SAMPLE_INPUTS[m.pattern].minutesSinceLastIntake,
        };
    });
}
function buildMockAlertFeed() {
    const roster = buildMockRoster();
    return roster
        .filter((a) => a.alertState !== "WATCH")
        .sort((a, b) => b.riskScore - a.riskScore)
        .map((a, idx) => ({
        athleteId: a.id,
        athleteName: a.name,
        state: a.alertState,
        band: a.band,
        message: a.alertState === "PULL_NOW"
            ? `${a.name} (#${a.jerseyNumber}) — Critical heat risk. Remove immediately.`
            : a.alertState === "INTERVENE"
                ? `${a.name} (#${a.jerseyNumber}) — Trending ${a.band.replace("_", " ")}. Pull at next stoppage.`
                : `${a.name} (#${a.jerseyNumber}) — Watch.`,
        loggedAt: new Date(Date.now() - idx * 90000).toISOString(),
    }));
}
