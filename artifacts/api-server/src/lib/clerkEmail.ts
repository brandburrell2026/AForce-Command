/**
 * clerkEmail — resolve the authenticated user's VERIFIED primary email
 * (Wave-3 PR4: the Shopify→AForce identity bridge).
 *
 * `aforce_users.email` is the join key for the web (Shopify) entitlement
 * rail. It was read in two places and written NOWHERE, so a Shopify
 * Command purchaser never received app entitlement (dead rail, live
 * revenue bug).
 *
 * SECURITY INVARIANTS:
 *  - VERIFIED emails only. An unverified address must never establish
 *    the commerce linkage — otherwise anyone could claim a purchaser's
 *    email pre-verification and take over their web entitlement.
 *  - The Clerk user id remains the CANONICAL application identity; the
 *    email is a commerce join key only. Nothing here merges accounts —
 *    if two authenticated people ever present the same email string,
 *    identity resolution is untouched (each keeps their own Clerk id);
 *    Clerk enforces verified-email uniqueness per instance.
 *  - Best-effort: a Clerk outage returns null and must never block
 *    entitlement resolution.
 */

import { clerkClient } from "@clerk/express";
import { logger } from "./logger";

/** Normalized (trimmed, lowercased) verified primary email, or null. */
export async function fetchVerifiedPrimaryEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary =
      user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId) ??
      user.emailAddresses?.[0];
    if (!primary?.emailAddress) return null;
    if (primary.verification?.status !== "verified") return null;
    const normalized = primary.emailAddress.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  } catch (err) {
    logger.debug({ err }, "clerkEmail: verified-primary-email lookup failed");
    return null;
  }
}
