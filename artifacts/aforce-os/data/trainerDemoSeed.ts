/**
 * Morning Board — seeded demo roster. SIMULATED DATA.
 *
 * Phase 0 founder ruling (`docs/trainer-dashboard-plan.md` §0a, decision 6):
 * build against placeholder athletes behind `trainer_demo_seed_enabled`,
 * default off, visually marked as simulated wherever they render. No real
 * athlete data, and no production code path reaches this file — the screen
 * imports it only when the flag is on, and every row carries
 * `isSimulated: true` so the marker cannot be forgotten at a call site.
 *
 * Deterministic on purpose: a fixed generator means the board looks the same
 * on every launch and the tests can assert real orderings rather than shapes.
 *
 * Covers the golden-roster edge cases from the brief §6.1: no device data,
 * partial data, stale data (> 72h), duplicate names, a single-name athlete, a
 * 3-character name, a 40-character name, and a mid-season transfer who has not
 * consented yet.
 */

import type { Availability, BoardAthlete } from "../utils/trainerBoard";

/**
 * Mulberry32. Small, seeded, and stable across platforms — the point is
 * repeatability, not cryptographic quality.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POSITION_GROUPS: { group: string; positions: string[] }[] = [
  { group: "Offense", positions: ["QB", "RB", "WR", "TE", "OL"] },
  { group: "Defense", positions: ["DL", "LB", "DB"] },
  { group: "Special", positions: ["K", "P", "LS"] },
];

const SURNAMES = [
  "Reyes", "Walker", "Park", "Brooks", "Cole", "Singh", "Pierce", "Johnson",
  "Alvarez", "Nakamura", "Okafor", "Bennett", "Rivera", "Fitzgerald", "Nguyen",
  "Kowalski", "Osei", "Lindqvist", "Marchetti", "Delacroix",
];

const INITIALS = "ABCDEFGHJKLMNPRSTVW";

function availabilityFor(rand: number): Availability {
  if (rand < 0.06) return "out";
  if (rand < 0.16) return "limited";
  if (rand < 0.2) return "unset";
  return "available";
}

/**
 * Build the seeded roster.
 *
 * @param size defaults to 120 — the figure the brief's performance criterion
 *             names, so the demo board is always the hard case.
 */
export function buildTrainerDemoRoster(size = 120): BoardAthlete[] {
  const rand = mulberry32(20260916);
  const out: BoardAthlete[] = [];

  for (let i = 0; i < size; i += 1) {
    const groupPick = POSITION_GROUPS[Math.floor(rand() * POSITION_GROUPS.length)]!;
    const position = groupPick.positions[Math.floor(rand() * groupPick.positions.length)]!;
    const surname = SURNAMES[Math.floor(rand() * SURNAMES.length)]!;
    const initial = INITIALS[Math.floor(rand() * INITIALS.length)]!;

    const score = Math.round(28 + rand() * 70);
    const availability = availabilityFor(rand());
    const submitted = rand() > 0.12;
    const sleep = rand() < 0.22 ? 4.4 + rand() * 1.5 : 6.4 + rand() * 2.1;
    const sinceIntake = Math.round(20 + rand() * 260);
    const sinceSync = Math.round(5 + rand() * 300);

    out.push({
      athleteUserId: `demo_athlete_${String(i + 1).padStart(3, "0")}`,
      displayName: `${initial}. ${surname}`,
      position,
      positionGroup: groupPick.group,
      consentGranted: true,
      hydrationScore: score,
      availability,
      questionnaireSubmitted: submitted,
      minutesSinceLastIntake: sinceIntake,
      sleepHoursLastNight: Math.round(sleep * 10) / 10,
      minutesSinceSync: sinceSync,
      isSimulated: true,
    });
  }

  // ── Golden-fixture edge cases (brief §6.1). Overwrite the tail so the set
  // is exactly `size` and the awkward rows are always present.
  const edge: BoardAthlete[] = [
    {
      // No device data at all — consented, but nothing has ever synced.
      athleteUserId: "demo_athlete_nodata",
      displayName: "R. Idris",
      position: "WR",
      positionGroup: "Offense",
      consentGranted: true,
      hydrationScore: null,
      availability: "available",
      questionnaireSubmitted: true,
      minutesSinceLastIntake: null,
      sleepHoursLastNight: null,
      minutesSinceSync: null,
      isSimulated: true,
    },
    {
      // Stale — last sync four days ago. The number on screen is old and the
      // board must say so rather than render it as current.
      athleteUserId: "demo_athlete_stale",
      displayName: "T. Valenza",
      position: "LB",
      positionGroup: "Defense",
      consentGranted: true,
      hydrationScore: 74,
      availability: "available",
      questionnaireSubmitted: true,
      minutesSinceLastIntake: 5000,
      sleepHoursLastNight: 7.1,
      minutesSinceSync: 5760,
      isSimulated: true,
    },
    {
      // Mid-season transfer: on the roster, has not shared yet.
      athleteUserId: "demo_athlete_transfer",
      displayName: "J. Okonkwo",
      position: "DB",
      positionGroup: "Defense",
      consentGranted: false,
      hydrationScore: null,
      availability: "unset",
      questionnaireSubmitted: false,
      minutesSinceLastIntake: null,
      sleepHoursLastNight: null,
      minutesSinceSync: null,
      isSimulated: true,
    },
    {
      // Duplicate name #1 — two athletes, same display name.
      athleteUserId: "demo_athlete_dupe_a",
      displayName: "C. Boozer",
      position: "TE",
      positionGroup: "Offense",
      consentGranted: true,
      hydrationScore: 46,
      availability: "limited",
      questionnaireSubmitted: true,
      minutesSinceLastIntake: 190,
      sleepHoursLastNight: 5.2,
      minutesSinceSync: 40,
      isSimulated: true,
    },
    {
      // Duplicate name #2.
      athleteUserId: "demo_athlete_dupe_b",
      displayName: "C. Boozer",
      position: "OL",
      positionGroup: "Offense",
      consentGranted: true,
      hydrationScore: 88,
      availability: "available",
      questionnaireSubmitted: true,
      minutesSinceLastIntake: 55,
      sleepHoursLastNight: 7.8,
      minutesSinceSync: 22,
      isSimulated: true,
    },
    {
      // Single-name athlete.
      athleteUserId: "demo_athlete_mononym",
      displayName: "Kaladin",
      position: "K",
      positionGroup: "Special",
      consentGranted: true,
      hydrationScore: 61,
      availability: "available",
      questionnaireSubmitted: false,
      minutesSinceLastIntake: 120,
      sleepHoursLastNight: 6.9,
      minutesSinceSync: 65,
      isSimulated: true,
    },
    {
      // Three characters.
      athleteUserId: "demo_athlete_short",
      displayName: "Ada",
      position: "P",
      positionGroup: "Special",
      consentGranted: true,
      hydrationScore: 93,
      availability: "available",
      questionnaireSubmitted: true,
      minutesSinceLastIntake: 35,
      sleepHoursLastNight: 8.2,
      minutesSinceSync: 12,
      isSimulated: true,
    },
    {
      // Forty characters — the layout must truncate, not reflow the row.
      athleteUserId: "demo_athlete_long",
      displayName: "Maximilian Ferdinand Oyelaran-Whitaker",
      position: "DL",
      positionGroup: "Defense",
      consentGranted: true,
      hydrationScore: 38,
      availability: "available",
      questionnaireSubmitted: true,
      minutesSinceLastIntake: 240,
      sleepHoursLastNight: 5.6,
      minutesSinceSync: 30,
      isSimulated: true,
    },
  ];

  return [...out.slice(0, Math.max(0, size - edge.length)), ...edge];
}
