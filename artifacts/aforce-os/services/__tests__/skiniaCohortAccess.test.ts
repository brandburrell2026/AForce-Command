import { describe, expect, it } from 'vitest';
// Imports the PURE module, not the one holding the hook. Importing through
// the hook pulled in `@clerk/expo`, which does not parse under the node test
// environment — so this suite stopped collecting entirely and reported "no
// tests" rather than a failure.
import { isSkinIAAccessAllowed, type SkinIACohortAccess } from '../skiniaCohortGate';

const granted: SkinIACohortAccess = { status: 'GRANTED', reason: 'CONTROLLED_TESTFLIGHT_COHORT' };
const denied: SkinIACohortAccess = { status: 'DENIED', reason: 'MEMBER_NOT_ENTITLED' };

describe('SkinIA client cohort gate', () => {
  it('does not permit a public build, even for a server-entitled member', () => {
    expect(isSkinIAAccessAllowed({ featureEnabled: true, internalTestflight: false, cohort: granted })).toBe(false);
  });

  it('does not permit an internal build without an explicit server grant', () => {
    expect(isSkinIAAccessAllowed({ featureEnabled: true, internalTestflight: true, cohort: denied })).toBe(false);
  });

  it('requires every gate before the contained shell can be reached', () => {
    expect(isSkinIAAccessAllowed({ featureEnabled: false, internalTestflight: true, cohort: granted })).toBe(false);
    expect(isSkinIAAccessAllowed({ featureEnabled: true, internalTestflight: true, cohort: granted })).toBe(true);
  });
});
