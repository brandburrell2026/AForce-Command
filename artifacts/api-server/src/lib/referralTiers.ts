/**
 * Referral tier ladder + anonymous handle derivation (spec #7 slice 3).
 *
 * Social-only: tiers gate display labels only, never entitlements,
 * pricing, or feature access. Reward economy stays out of this slice.
 *
 * Thresholds were chosen to make tier-up feel achievable in the first
 * week of active recruiting while still leaving room for power users.
 */

export type TierId =
  | "recruit"
  | "operator"
  | "captain"
  | "commander"
  | "general";

export interface Tier {
  id: TierId;
  label: string;
  claimsRequired: number;
}

// Ordered low → high. tierFor() relies on this ordering.
export const REFERRAL_TIERS: ReadonlyArray<Tier> = [
  { id: "recruit", label: "Recruit", claimsRequired: 0 },
  { id: "operator", label: "Operator", claimsRequired: 1 },
  { id: "captain", label: "Captain", claimsRequired: 5 },
  { id: "commander", label: "Commander", claimsRequired: 15 },
  { id: "general", label: "General", claimsRequired: 50 },
];

/**
 * Returns the highest tier the user qualifies for at `claims`.
 * Never returns null — every user is at minimum a Recruit.
 */
export function tierFor(claims: number): Tier {
  const n = Math.max(0, Math.floor(claims));
  let current = REFERRAL_TIERS[0];
  for (const t of REFERRAL_TIERS) {
    if (n >= t.claimsRequired) current = t;
    else break;
  }
  return current;
}

/**
 * Returns the next tier above `claims`, or null if already at the top.
 */
export function nextTierFor(claims: number): Tier | null {
  const n = Math.max(0, Math.floor(claims));
  for (const t of REFERRAL_TIERS) {
    if (n < t.claimsRequired) return t;
  }
  return null;
}

/**
 * Claims remaining to reach the next tier. 0 when already at the top.
 */
export function claimsToNextTier(claims: number): number {
  const next = nextTierFor(claims);
  if (!next) return 0;
  return Math.max(0, next.claimsRequired - Math.max(0, Math.floor(claims)));
}

/**
 * Derives a stable, anonymous public handle from a referral code.
 * Format: "Operator XXXX" using the first 4 chars of the code.
 *
 * "Operator" is the persona vocabulary (separate from the tier label
 * — Captain GQ55 would still be "Operator GQ55" on the board). This
 * keeps the public identity uniform across the ladder and avoids
 * leaking rank information through the handle itself.
 */
export function handleForCode(code: string | null | undefined): string {
  const slug = (code ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4);
  return `Operator ${slug || "????"}`;
}
