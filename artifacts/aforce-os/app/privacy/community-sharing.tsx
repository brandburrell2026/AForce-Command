/**
 * Legacy Circle sharing settings have been retired from member-facing flows.
 *
 * Circle v1.7 shares only explicit Moment fields and never exposes scores,
 * HydroState, streaks, ranks, or health data. Keep this path as a safe
 * compatibility redirect for old deep links while server-side legacy-grant
 * revocation is completed.
 */
import { Redirect } from 'expo-router';

export default function CommunitySharingRoute() {
  return <Redirect href="/competition" />;
}
