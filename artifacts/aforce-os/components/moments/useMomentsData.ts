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
import { buildDemoMoments } from '@/data/demoMoments';
import {
  buildRecommendation,
  surfaceableMoments,
  nextMoment,
  type MomentSignals,
} from '@/services/momentRecommendation';
import { useEngineSlice, useUserSlice } from '@/store/slices';
import { useAppStateGatedInterval } from '@/hooks/useAppStateGatedInterval';

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

  const fixture = options?.fixtureMoments;
  const nowIso = options?.fixtureNowIso ?? tickIso;
  const moments = fixture ?? store.moments;

  const signals: MomentSignals = React.useMemo(
    () =>
      fixture
        ? { hydrationPct: 62, streakDays: 5 } // deterministic fixture signals
        : {
            hydrationPct: Math.round(
              (userState.unitsConsumedToday / Math.max(1, userState.dailyTarget)) * 100,
            ),
            performanceLevel: engine.performanceState.level,
            streakDays: userState.complianceStreak,
          },
    [fixture, userState.unitsConsumedToday, userState.dailyTarget, engine.performanceState.level, userState.complianceStreak],
  );

  return React.useMemo(() => {
    const surfaced = surfaceableMoments(moments, nowIso);
    const cache = new Map<string, MomentRecommendation>();
    const recFor = (moment: Moment): MomentRecommendation => {
      const hit = cache.get(moment.id);
      if (hit) return hit;
      const rec = buildRecommendation(moment, signals, nowIso);
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
