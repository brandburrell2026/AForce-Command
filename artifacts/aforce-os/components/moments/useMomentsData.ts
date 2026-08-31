/**
 * useMomentsData — the one data hook every Moments surface shares
 * (Phases 1–2). Assembles: hydrated store moments, per-moment
 * recommendations (pure engine, recomputed on a minute tick), and the real
 * store signals the evidence cites. The minute tick uses
 * useAppStateGatedInterval so countdowns update while foregrounded and cost
 * nothing in the background (RC-1 perf rule).
 *
 * `fixtureMoments`/`fixtureNowIso` exist ONLY for the demo gallery / tests:
 * they bypass the store and clock so fixtures render deterministically.
 */
import React from 'react';

import type { Moment, MomentRecommendation } from '@/types/moments';
import { useMomentsStore, hydrateMoments, addMoment } from '@/services/momentsStore';
import { DEMO_MODE, CAPTURE_MODE } from '@/services/demoMode';
import { buildDemoMoments, buildDemoCalendarMoments } from '@/data/demoMoments';
import {
  buildRecommendation,
  surfaceableMoments,
  nextMoment,
  type MomentSignals,
} from '@/services/momentRecommendation';
import { useEngineSlice, useUserSlice } from '@/store/slices';
import { useFeatureFlags } from '@/store/useAppStore';
import { useCalendarMoments, refreshCalendarMoments } from '@/services/calendarMoments';
import { useAppStateGatedInterval } from '@/hooks/useAppStateGatedInterval';
import { guardMomentRecommendation } from '@/utils/intelligence/decisionGuard';

const TICK_MS = 30_000;

export interface MomentsData {
  hydrated: boolean;
  nowIso: string;
  /** Today + horizon, soonest first. */
  surfaced: Moment[];
  next: Moment | null;
  recFor: (moment: Moment) => MomentRecommendation;
  momentById: (id: string) => Moment | undefined;
}

export function useMomentsData(options?: {
  fixtureMoments?: Moment[];
  fixtureNowIso?: string;
}): MomentsData {
  const store = useMomentsStore();
  const flags = useFeatureFlags();
  const calendarDerived = useCalendarMoments();
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const [tickIso, setTickIso] = React.useState(() => new Date().toISOString());
  useAppStateGatedInterval(() => setTickIso(new Date().toISOString()), TICK_MS);

  React.useEffect(() => {
    if (!options?.fixtureMoments && !store.hydrated) void hydrateMoments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Demo/capture sessions seed the comp's sample day once (Phase 1 "manual
  // demo data"). Production builds never reach this: DEMO_MODE/CAPTURE_MODE
  // are env-gated and `moments_enabled` is OFF in production anyway.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (options?.fixtureMoments || seededRef.current) return;
    if (!(DEMO_MODE || CAPTURE_MODE)) return;
    if (!store.hydrated || store.moments.length > 0) return;
    seededRef.current = true;
    for (const m of buildDemoMoments(new Date().toISOString())) addMoment(m);
  }, [options?.fixtureMoments, store.hydrated, store.moments.length]);

  // Phase 3b (DR-011): merge in-memory calendar moments when the flag is
  // on. The 30s tick doubles as the throttled foreground refresh driver
  // (refreshCalendarMoments self-throttles to 60s; zero background work).
  //
  // DEMO/CAPTURE VISUAL PREVIEW (founder-authorized 2026-08-29): the
  // calendar lane's PRODUCTION data stays legally gated OFF. Demo builds
  // preview the finished calendar experience with the explicitly
  // synthetic buildDemoCalendarMoments set, merged IN-MEMORY exactly like
  // real calendar moments — never persisted, never through addMoment —
  // and the device bridge is never touched: the refresh effect below is
  // skipped, so no permission or EventKit path can run in the demo lane
  // (components/moments/__tests__/demoCalendarPreview.test.ts).
  const calendarOn = flags.moments_calendar_enabled;
  const [demoCalendarMoments] = React.useState<Moment[]>(() =>
    DEMO_MODE || CAPTURE_MODE ? buildDemoCalendarMoments(new Date().toISOString()) : [],
  );
  React.useEffect(() => {
    if (DEMO_MODE || CAPTURE_MODE) return; // synthetic preview — no bridge
    if (options?.fixtureMoments || !calendarOn) return;
    void refreshCalendarMoments();
  }, [options?.fixtureMoments, calendarOn, tickIso]);

  const fixture = options?.fixtureMoments;
  const nowIso = options?.fixtureNowIso ?? tickIso;
  const mergedCalendar = DEMO_MODE || CAPTURE_MODE ? demoCalendarMoments : calendarDerived;
  const moments = React.useMemo(
    () => fixture ?? (calendarOn ? [...store.moments, ...mergedCalendar] : store.moments),
    [fixture, calendarOn, store.moments, mergedCalendar],
  );

  // RP-3 (one hydration action): the mirror source. `engine` here is the
  // GUARDED slice (guardEngineOutput ran at the store boundary), so the
  // command a Moment mirrors is the exact command Home renders — one
  // authority, every surface. Fixture mode pins moments/now for capture but
  // the command still mirrors the host's engine state (a fixture may not
  // mint a dose either).
  const canonicalCommand = React.useMemo(
    () => ({ id: engine.command.id, action: engine.command.action }),
    [engine.command.id, engine.command.action],
  );
  const signals: MomentSignals = React.useMemo(
    () =>
      fixture
        ? { hydrationPct: 62, streakDays: 5, canonicalCommand } // deterministic fixture signals
        : {
            hydrationPct: Math.round(
              (userState.unitsConsumedToday / Math.max(1, userState.dailyTarget)) * 100,
            ),
            performanceLevel: engine.performanceState.level,
            streakDays: userState.complianceStreak,
            canonicalCommand,
          },
    [fixture, userState.unitsConsumedToday, userState.dailyTarget, engine.performanceState.level, userState.complianceStreak, canonicalCommand],
  );

  return React.useMemo(() => {
    const surfaced = surfaceableMoments(moments, nowIso);
    const cache = new Map<string, MomentRecommendation>();
    const recFor = (moment: Moment): MomentRecommendation => {
      const hit = cache.get(moment.id);
      if (hit) return hit;
      // DECISION GUARD — in-app delivery boundary (founder-authorized
      // #877 follow-up; RP-3 conscious repin 2026-08-31). Every Moments
      // surface consumes recFor, so this is the one seam covering
      // NextMomentCard, MomentsScreen, MomentDetailScreen, and
      // PrepareMyDayScreen. The rec's only amount is the mirrored
      // canonical command; the guard judges that mirror structurally AND
      // textually, and a blocked mirror is DROPPED — silence, never a
      // Moment-minted substitute. The member's moment stays visible.
      const { rec } = guardMomentRecommendation(buildRecommendation(moment, signals, nowIso));
      cache.set(moment.id, rec);
      return rec;
    };
    return {
      hydrated: fixture ? true : store.hydrated,
      nowIso,
      surfaced,
      next: nextMoment(moments, nowIso),
      recFor,
      momentById: (id: string) => moments.find((m) => m.id === id),
    };
  }, [moments, nowIso, signals, store.hydrated, fixture]);
}
