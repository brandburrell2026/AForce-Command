import { createCircleAuthenticatedRequest } from './circleMembershipService';
import type { ScopeState } from './userScope';

export type CircleSharedField = 'score' | 'state';
export interface CircleSharingGrant {
  memberUserId: string;
  fields: CircleSharedField[];
  version: number;
  acknowledgementVersion: 'circle-sharing-v1' | null;
}
export interface CircleRecordedActivity {
  userId: string;
  name: string;
  initials: string;
  score?: number;
  state?: string;
  recordedAt: string;
  source: 'recorded_app_data';
}

export function createCircleSharingClient(scope: ScopeState) {
  const request = createCircleAuthenticatedRequest(scope);
  return {
    grants: () => request<{ grants: CircleSharingGrant[] }>('GET', '/sharing'),
    activity: () =>
      request<{ activity: CircleRecordedActivity[] }>('GET', '/activity'),
    save: (
      memberUserId: string,
      fields: CircleSharedField[],
      expectedVersion: number,
    ) =>
      request<{ grant: CircleSharingGrant }>(
        'PUT',
        `/sharing/${encodeURIComponent(memberUserId)}`,
        {
          fields,
          expectedVersion,
          ...(fields.length
            ? { acknowledgementVersion: 'circle-sharing-v1' }
            : {}),
        },
      ),
    revoke: (memberUserId: string, expectedVersion: number) =>
      request<{ grant: CircleSharingGrant }>(
        'DELETE',
        `/sharing/${encodeURIComponent(memberUserId)}`,
        { expectedVersion },
      ),
  };
}
