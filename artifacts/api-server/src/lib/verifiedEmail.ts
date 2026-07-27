/**
 * verifiedEmail — the trust root for the D-2 web-entitlement bridge
 * (release-gate blocker #2, PR #400).
 *
 * `aforce_users.email` may be written from EXACTLY ONE source: the user's
 * Clerk PRIMARY email address, and ONLY when Clerk reports it VERIFIED.
 * Fetched server-to-server with CLERK_SECRET_KEY (clerkClient) — never from
 * a client-supplied value, never from an unverified address. An unverified
 * or missing primary email yields null, and null is never persisted over an
 * existing value.
 *
 * Why this matters: web Command purchases match on email. An attacker who
 * could register (but not verify) a victim's purchase email must gain
 * nothing — Clerk enforces uniqueness at verification time, so a verified
 * primary email is proof of mailbox control.
 */

interface ClerkEmailAddress {
  id: string;
  emailAddress?: string;
  email_address?: string;
  verification?: { status?: string | null } | null;
}

export interface ClerkUserLike {
  primaryEmailAddressId?: string | null;
  primary_email_address_id?: string | null;
  emailAddresses?: ClerkEmailAddress[];
  email_addresses?: ClerkEmailAddress[];
}

/** The lowercased verified primary email, or null. Pure + total. */
export function extractVerifiedPrimaryEmail(user: ClerkUserLike | null | undefined): string | null {
  if (!user) return null;
  const primaryId = user.primaryEmailAddressId ?? user.primary_email_address_id ?? null;
  const addresses = user.emailAddresses ?? user.email_addresses ?? [];
  if (!primaryId || addresses.length === 0) return null;
  const primary = addresses.find((a) => a.id === primaryId);
  if (!primary) return null;
  if (primary.verification?.status !== "verified") return null;
  const raw = primary.emailAddress ?? primary.email_address;
  if (typeof raw !== "string" || !raw.includes("@")) return null;
  return raw.trim().toLowerCase();
}
