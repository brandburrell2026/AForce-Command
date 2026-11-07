import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scope: { status: 'AUTHENTICATED', userId: 'user_1' } as any,
  request: vi.fn(),
}));

vi.mock('../circleMembershipService', () => ({
  createCircleAuthenticatedRequest: () => mocks.request,
}));

import { createCircleMomentSharingClient } from '../circleMomentSharingService';

afterEach(() => vi.clearAllMocks());

describe('Circle Moment sharing client', () => {
  it('sends only Moment identity, title and scheduled time', async () => {
    mocks.request.mockResolvedValue({ share: { id: 'share' } });
    await createCircleMomentSharingClient(mocks.scope).share('member_1', {
      id: 'moment_1',
      title: 'Training',
      startAtIso: '2026-11-07T15:00:00.000Z',
    });
    expect(mocks.request).toHaveBeenCalledWith('POST', '/moment-shares', {
      memberUserId: 'member_1',
      momentId: 'moment_1',
      title: 'Training',
      startsAt: '2026-11-07T15:00:00.000Z',
    });
  });

  it('uses authenticated Circle paths for incoming shares and revocation', async () => {
    const client = createCircleMomentSharingClient(mocks.scope);
    await client.incoming();
    await client.revoke('share with spaces');
    expect(mocks.request).toHaveBeenNthCalledWith(1, 'GET', '/moment-shares');
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      'DELETE',
      '/moment-shares/share%20with%20spaces',
    );
  });
});
