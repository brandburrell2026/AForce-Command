import { createCircleAuthenticatedRequest } from './circleMembershipService';
import type { ScopeState } from './userScope';
import type { Moment } from '@/types/moments';

/** The only Moment fields Circle may transmit. */
export interface CircleMomentShare {
  id: string;
  sourceUserId: string;
  recipientUserId: string;
  momentId: string;
  title: string;
  startsAt: string;
  sharedAt: string;
}

export function createCircleMomentSharingClient(scope: ScopeState) {
  const request = createCircleAuthenticatedRequest(scope);
  return {
    incoming: () => request<{ shares: CircleMomentShare[] }>('GET', '/moment-shares'),
    share: (memberUserId: string, moment: Pick<Moment, 'id' | 'title' | 'startAtIso'>) =>
      request<{ share: CircleMomentShare }>('POST', '/moment-shares', {
        memberUserId,
        momentId: moment.id,
        title: moment.title,
        startsAt: moment.startAtIso,
      }),
    revoke: (shareId: string) =>
      request<void>('DELETE', `/moment-shares/${encodeURIComponent(shareId)}`),
  };
}
