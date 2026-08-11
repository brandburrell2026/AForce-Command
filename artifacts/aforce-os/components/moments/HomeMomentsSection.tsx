/**
 * HomeMomentsSection — the Home/Today mount for AForce Moments (Phase 1).
 * Rendered by HomeScreenV2 ONLY when `moments_enabled` is on, so its hooks
 * (store hydration, minute tick) cost nothing in production while the flag
 * is off. Renders nothing without moments — Home never gains an empty shell.
 */
import React from 'react';

import { useMomentsData } from './useMomentsData';
import { NextMomentCard, TodaysMomentsList } from './NextMomentCard';

export function HomeMomentsSection() {
  const data = useMomentsData();
  if (!data.hydrated || data.surfaced.length === 0) return null;
  return (
    <>
      {data.next ? (
        <NextMomentCard moment={data.next} rec={data.recFor(data.next)} nowIso={data.nowIso} />
      ) : null}
      <TodaysMomentsList moments={data.surfaced} recFor={data.recFor} nowIso={data.nowIso} />
    </>
  );
}
