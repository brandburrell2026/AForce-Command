/**
 * GET /api/skinia/access
 *
 * Read-only cohort entitlement check. This route handles no imagery and
 * deliberately exposes no allowlist. Future SkinIA processing routes must
 * call the same policy before accepting any request.
 */
import { Router, type IRouter } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import {
  parseSkinIACohortMemberIds,
  resolveSkinIACohortDecision,
  skinIAInternalTestBuildEnabled,
} from '../lib/skiniaCohort';

const router: IRouter = Router();

router.get('/access', requireAuth, (req, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ authorized: false, reason: 'UNAUTHENTICATED' });
    return;
  }

  const decision = resolveSkinIACohortDecision({
    userId,
    internalTestBuildEnabled: skinIAInternalTestBuildEnabled(
      process.env['SKINIA_INTERNAL_TEST_BUILD_ENABLED'],
    ),
    entitledMemberIds: parseSkinIACohortMemberIds(
      process.env['SKINIA_INTERNAL_TEST_COHORT_MEMBER_IDS'],
    ),
  });

  res.json({ authorized: decision.allowed, reason: decision.reason });
});

export default router;
