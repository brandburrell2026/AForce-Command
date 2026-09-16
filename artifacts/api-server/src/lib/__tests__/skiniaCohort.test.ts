import { describe, expect, it } from 'vitest';
import {
  SKINIA_PUBLIC_RELEASE_AUTHORIZED,
  parseSkinIACohortMemberIds,
  resolveSkinIACohortDecision,
  skinIAInternalTestBuildEnabled,
} from '../skiniaCohort';

describe('SkinIA controlled TestFlight cohort policy', () => {
  const entitled = parseSkinIACohortMemberIds('member-a, member-b');

  it('keeps public production locked as an immutable default', () => {
    expect(SKINIA_PUBLIC_RELEASE_AUTHORIZED).toBe(false);
    expect(resolveSkinIACohortDecision({
      userId: 'member-a', internalTestBuildEnabled: false, entitledMemberIds: entitled,
    })).toEqual({ allowed: false, reason: 'PUBLIC_RELEASE_LOCKED' });
  });

  it('does not grant an internal build to a member without entitlement', () => {
    expect(resolveSkinIACohortDecision({
      userId: 'not-enrolled', internalTestBuildEnabled: true, entitledMemberIds: entitled,
    })).toEqual({ allowed: false, reason: 'MEMBER_NOT_ENTITLED' });
  });

  it('requires the explicit internal-build setting and exact authenticated member id', () => {
    expect(skinIAInternalTestBuildEnabled(undefined)).toBe(false);
    expect(skinIAInternalTestBuildEnabled('false')).toBe(false);
    expect(skinIAInternalTestBuildEnabled('true')).toBe(true);
    expect(resolveSkinIACohortDecision({
      userId: 'member-a', internalTestBuildEnabled: true, entitledMemberIds: entitled,
    })).toEqual({ allowed: true, reason: 'CONTROLLED_TESTFLIGHT_COHORT' });
  });
});
