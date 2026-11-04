import type { Moment } from "@/types/moments";

/** Region and lifetime are release configuration, never inferred from a
 * timezone and never a universal legal-age rule. No drink amounts or words. */
export interface MomentSafetyPolicy {
  region: string;
  retentionHours: number;
  version: string;
}
export function configuredMomentSafetyPolicy(): MomentSafetyPolicy | null {
  const region = process.env["EXPO_PUBLIC_SOCIAL_POLICY_REGION"];
  const hours = Number(
    process.env["EXPO_PUBLIC_SOCIAL_CONTEXT_RETENTION_HOURS"],
  );
  const version = process.env["EXPO_PUBLIC_SOCIAL_POLICY_VERSION"];
  if (
    !region?.trim() ||
    !version?.trim() ||
    !Number.isFinite(hours) ||
    hours <= 0
  )
    return null;
  return { region, retentionHours: hours, version };
}
export function activeAlcoholContext(
  moment: Moment | undefined | null,
  nowMs = Date.now(),
): boolean {
  const context = moment?.safetyContext;
  if (!context || moment?.preparation?.returnedAtIso) return false;
  const mentioned = Date.parse(context.mentionedAtIso);
  const expires = Date.parse(context.expiresAtIso);
  return (
    Number.isFinite(mentioned) &&
    Number.isFinite(expires) &&
    mentioned <= nowMs &&
    expires > nowMs &&
    expires > mentioned
  );
}
export function alcoholDisclosure(words: string): boolean {
  // A volunteered mention is conservative context, never a count or estimate.
  // No location, calendar venue or third-party inference activates it.
  return /\b(alcohol|beers?|wine|tequilas?|vodka|whisk(?:ey|y)|cocktails?|drinking|drinks|drunk|drank)\b/i.test(
    words,
  );
}
export function withAlcoholContext(
  moment: Moment,
  policy: MomentSafetyPolicy,
  nowMs = Date.now(),
): Moment {
  if (activeAlcoholContext(moment, nowMs)) return moment; // reads never extend retention
  const expires = nowMs + policy.retentionHours * 3600000;
  if (!Number.isFinite(expires) || expires <= nowMs)
    throw new Error("Invalid context retention policy.");
  return {
    ...moment,
    safetyContext: {
      mentionedAtIso: new Date(nowMs).toISOString(),
      expiresAtIso: new Date(expires).toISOString(),
      region: policy.region,
      policyVersion: policy.version,
    },
  };
}
/** Called on hydration/write; expired metadata never reaches memory projections.
 * Cleanup does not report sobriety or grant driving clearance. */
export function withoutExpiredSafetyContext(
  moment: Moment,
  nowMs = Date.now(),
): Moment {
  if (!moment.safetyContext || activeAlcoholContext(moment, nowMs))
    return moment;
  const { safetyContext: _expired, ...rest } = moment;
  return rest;
}
