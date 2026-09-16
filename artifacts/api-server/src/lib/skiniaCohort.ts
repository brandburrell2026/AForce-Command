/**
 * SkinIA controlled-cohort authorization.
 *
 * This module deliberately contains no image, biometric, or observation
 * payload. It is the API-side half of the containment gate introduced by
 * founder decision DR-015. A public release has no authorization path here.
 */

export type SkinIACohortDecision =
  | { allowed: true; reason: 'CONTROLLED_TESTFLIGHT_COHORT' }
  | {
      allowed: false;
      reason: 'PUBLIC_RELEASE_LOCKED' | 'INTERNAL_BUILD_DISABLED' | 'MEMBER_NOT_ENTITLED';
    };

/** Immutable until a separate founder public-release decision changes code. */
export const SKINIA_PUBLIC_RELEASE_AUTHORIZED = false;

export function parseSkinIACohortMemberIds(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function resolveSkinIACohortDecision(input: {
  userId: string;
  internalTestBuildEnabled: boolean;
  entitledMemberIds: ReadonlySet<string>;
}): SkinIACohortDecision {
  // There is intentionally no public-release branch. A future public release
  // must be a separately reviewed founder decision, not an environment flip.
  if (!input.internalTestBuildEnabled) {
    return { allowed: false, reason: 'PUBLIC_RELEASE_LOCKED' };
  }
  if (!input.entitledMemberIds.has(input.userId)) {
    return { allowed: false, reason: 'MEMBER_NOT_ENTITLED' };
  }
  return { allowed: true, reason: 'CONTROLLED_TESTFLIGHT_COHORT' };
}

export function skinIAInternalTestBuildEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}
