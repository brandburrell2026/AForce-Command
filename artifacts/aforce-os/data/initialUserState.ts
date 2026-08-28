/**
 * initialUserState — the HONEST production cold-start seed (PR-2,
 * founder-authorized production-seed honesty).
 *
 * The store previously seeded `data/mockData.ts:defaultUserState` — a
 * DEMO-tuned day (5 units / 45 oz / streak 5, engineered to score
 * BALANCED 76) — unconditionally. Pre-first-fetch frames and the
 * offline fetchHome echo therefore presented a fabricated day (ring
 * 47%, "45 of 96 oz", a 5-day streak) beside an EMPTY event list.
 *
 * `productionInitialUserState` is instead byte-shaped like what
 * `services/realApi.ts:normalizeUserState({})` produces for a brand-new
 * server account — first frame ≡ post-fetch fresh account, no flash,
 * nothing claimed that didn't happen. The demo-tuned seed remains, but
 * only for env-gated DEMO/CAPTURE builds (which run against no live
 * backend and depend on the tuned seed for their entire data story —
 * see services/demoMode.ts).
 *
 * Recorded constraints honored (NOT new fabrications, flagged residuals):
 *  - `lastIntakeTime: new Date()` — the field is non-nullable through the
 *    scoring engine by the recorded W3-PR10 founder decision (see
 *    services/realApi.ts normalizeUserState); epoch-0 would render
 *    "29,768,000 min ago" copy and a fabricated depletion command.
 *  - `bodyWeightLbs: 180` — the recorded default at three layers
 *    (normalizeUserState `?? 180`, appStoreReducer DEFAULT_BODY_WEIGHT_LBS,
 *    non-nullable type); a 0 sentinel would surface a clamped "60 lb
 *    body" personalization chip. Making weight honestly absent is a
 *    type-ripple + founder ruling, out of this PR's scope.
 *  - `dailyTarget`/`ozTarget` stay non-zero — `ozConsumedToday/ozTarget`
 *    is score math; a zero target is NaN, not honesty.
 *  - `intakeEvents: []` and streak 0 — the Wave-5 evidence gate counts
 *    intake events as real behavior; the production seed must never
 *    carry fabricated evidence.
 */

import type { UserState } from '../types';
import { defaultUserState } from './mockData';
import { DEMO_MODE, CAPTURE_MODE } from '../services/demoMode';

export const productionInitialUserState: UserState = {
  unitsConsumedToday: 0,
  aforceUnitsToday: 0,
  language: 'en',
  ozConsumedToday: 0,
  lastIntakeTime: new Date(),
  lastIntakeType: 'water',
  symptomState: 'none',
  symptoms: [],
  // 3 is the true neutral (normalizeUserState's fresh-account default);
  // the demo seed's 2 emitted a fabricated "Hydration signal optimal".
  urineSignal: 3,
  energyState: 'steady',
  heatLoad: 4,
  sweatRate: 3,
  activityLevel: 5,
  complianceStreak: 0,
  dailyTarget: 8,
  ozTarget: 96,
  isSnoozed: false,
  snoozeUntil: null,
  bodyWeightLbs: 180,
  isAwake: true,
  wakeTime: null,
  overnightLossOz: 0,
  hasSeenMorningCommand: false,
  clutchActive: false,
  // No weather has been fetched yet — honestly null, like a fresh account.
  weatherTempC: null,
  weatherHumidity: null,
  weatherCity: null,
  weatherFetchedAt: null,
  intakeEvents: [],
  // inventory deliberately ABSENT: normalizeUserState never maps it, so
  // absent is the post-fetch truth; the Recovery Protocol resolver's
  // all-zero "restock / start with water" plan is the designed state.
};

/**
 * Resolve the store's cold-start seed. Mirrors the
 * `defaultSubscription(demoBuild)` idiom (services/subscriptionService):
 * env-gated demo/capture builds keep the tuned demo day — their whole
 * data story is this seed (fetches 401 and echo it back) — while every
 * production build starts honest.
 */
export function resolveInitialUserState(
  demoBuild: boolean = DEMO_MODE || CAPTURE_MODE,
): UserState {
  return demoBuild ? defaultUserState : productionInitialUserState;
}
