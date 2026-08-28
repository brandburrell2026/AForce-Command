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
  // Until the store answers, say nothing (never flash an empty doorway).
  if (!data.hydrated) return null;
  // Founder ruling 2026-08-28 (calendar = intelligence INPUT to Moments, not
  // an agenda on Home): keep the SINGLE NEXT moment experience, and offer one
  // subtle, persistent doorway into the full Moments/calendar experience for a
  // member who wants to inspect what's coming up. When nothing is imminent the
  // doorway is a single tertiary line — never a card, never a list. The
  // device-calendar connect it leads to stays behind `moments_calendar_enabled`
  // (gated inside MomentsScreen); nothing here exposes raw calendar data or
  // touches consent.
  if (!data.next) {
    return <AllTodayLink labelKey="moments.home_entry" />;
  }
  return (
    <>
      <NextMomentCard moment={data.next} rec={data.recFor(data.next)} nowIso={data.nowIso} />
      <AllTodayLink />
    </>
  );
}
