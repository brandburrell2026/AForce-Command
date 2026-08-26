/**
 * HomeMomentsSection — the Home/Today mount for AForce Moments (Phase 1).
 * Rendered by HomeScreenV2 ONLY when `moments_enabled` is on, so its hooks
 * (store hydration, minute tick) cost nothing in production while the flag
 * is off. Renders nothing without a next moment — Home never gains an empty
 * shell, and Wave 5 removed the today-list that used to render on its own.
 */
import React from 'react';

import { useMomentsData } from './useMomentsData';
import { useMomentPrepScheduling } from './useMomentPrepScheduling';
import { NextMomentCard, AllTodayLink } from './NextMomentCard';

export function HomeMomentsSection() {
  const data = useMomentsData();
  // Phase 3a (DR-010): OS-level prep signals stay in sync with the store.
  useMomentPrepScheduling();
  // `next` is drawn from the same surfaced set as the list was, so gating on
  // it alone is what Home now needs: one moment, or nothing at all.
  if (!data.hydrated || !data.next) return null;
  return (
    <>
      <NextMomentCard moment={data.next} rec={data.recFor(data.next)} nowIso={data.nowIso} />
      <AllTodayLink />
    </>
  );
}
