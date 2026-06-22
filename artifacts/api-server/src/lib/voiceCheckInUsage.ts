/**
 * Voice Check-In Usage — founder Command Center aggregate (server lib).
 *
 * Turns per-pseudonymous-identity event roll-ups into an aggregate-only
 * usage DTO for the Voice Check-In™ engagement panel: how many active
 * identities adopted the morning ritual, how sticky it is (repeat use),
 * and the average cadence per adopter.
 *
 * Privacy: input rows are PSEUDONYMOUS (analytics_id only, NEVER joined to
 * users / subscriptions) and never leave this process — only aggregate
 * counts / rates do. The `voice_checkin_completed` event carries NO
 * payload (no self-report content), so this panel reveals usage, never
 * what anyone answered.
 *
 * Score-Protection & no-fabrication: voice check-ins are display-only
 * self-reports that never touch a hydration score, so this is pure
 * engagement telemetry. A rate with an empty denominator reports `null`
 * + `awaiting`, never a fabricated 0%.
 */
import { z } from "zod";

/**
 * One pseudonymous identity's voice-check-in usage roll-up. `appOpened`
 * is true when the identity has at least one `app_opened` event;
 * `checkInCount` is its number of distinct-day `voice_checkin_completed`
 * events (the mobile client emits that at most once per local day).
 */
export interface VoiceCheckInUsageRow {
  appOpened: boolean;
  checkInCount: number;
}

export const VoiceCheckInUsageSchema = z.object({
  generatedAt: z.string(),
  /** Active identities (opened the app and/or completed a check-in). */
  activeUsers: z.number().int().nonnegative(),
  /** Identities with >= 1 voice check-in. */
  checkInUsers: z.number().int().nonnegative(),
  /** Identities with >= 2 voice check-ins (returning users). */
  repeatUsers: z.number().int().nonnegative(),
  /** Total distinct-day check-ins across all identities. */
  totalCheckIns: z.number().int().nonnegative(),
  /** checkInUsers / activeUsers, or null when no active users. */
  adoptionRate: z.number().min(0).max(1).nullable(),
  /** repeatUsers / checkInUsers, or null when no check-in users. */
  repeatRate: z.number().min(0).max(1).nullable(),
  /** totalCheckIns / checkInUsers, or null when no check-in users. */
  avgPerUser: z.number().nonnegative().nullable(),
  adoptionStatus: z.enum(["awaiting", "measured"]),
  repeatStatus: z.enum(["awaiting", "measured"]),
});

export type VoiceCheckInUsageDTO = z.infer<typeof VoiceCheckInUsageSchema>;

/**
 * Pure builder: per-identity rows → aggregate usage DTO. `generatedAt`
 * is injected (no Date.now()) so the result is deterministic + testable.
 *
 * `activeUsers` (the adoption denominator) counts any identity that
 * opened the app OR completed a check-in, so a check-in is always a
 * subset of the active base and `adoptionRate` can never exceed 1 even
 * if an identity's `app_opened` event was dropped.
 */
export function buildVoiceCheckInUsage(
  rows: readonly VoiceCheckInUsageRow[],
  generatedAt: string,
): VoiceCheckInUsageDTO {
  let activeUsers = 0;
  let checkInUsers = 0;
  let repeatUsers = 0;
  let totalCheckIns = 0;

  for (const r of rows) {
    const checkIns = Math.max(0, Math.trunc(r.checkInCount));
    const active = r.appOpened || checkIns > 0;
    if (active) activeUsers += 1;
    if (checkIns > 0) {
      checkInUsers += 1;
      totalCheckIns += checkIns;
      if (checkIns >= 2) repeatUsers += 1;
    }
  }

  const adoptionRate = activeUsers > 0 ? checkInUsers / activeUsers : null;
  const repeatRate = checkInUsers > 0 ? repeatUsers / checkInUsers : null;
  const avgPerUser = checkInUsers > 0 ? totalCheckIns / checkInUsers : null;

  return {
    generatedAt,
    activeUsers,
    checkInUsers,
    repeatUsers,
    totalCheckIns,
    adoptionRate,
    repeatRate,
    avgPerUser,
    // Honest status: a rate with an empty denominator is "awaiting", never 0%.
    adoptionStatus: activeUsers > 0 ? "measured" : "awaiting",
    repeatStatus: checkInUsers > 0 ? "measured" : "awaiting",
  };
}
