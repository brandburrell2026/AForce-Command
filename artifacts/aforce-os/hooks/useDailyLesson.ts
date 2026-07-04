/**
 * useDailyLesson — Section 61 surface accessor for the Living Performance
 * Model's daily lesson.
 *
 * Composes the pure `deriveDailyLesson` over the Section 59 Personal Response
 * Library (via `useAdaptiveResponse`). Read-only: dispatches nothing into the
 * hydration reducer and never touches score (Score-Protection). The engine owns
 * all derivation; this hook only memoizes it.
 */
import React from 'react';

import { useAdaptiveResponse } from '@/hooks/useAdaptiveResponse';
import { deriveDailyLesson } from '@/utils/intelligence/livingPerformanceModel';
import type { DailyLesson } from '@/types/livingPerformance';

export function useDailyLesson(): DailyLesson {
  const profile = useAdaptiveResponse();
  return React.useMemo(() => deriveDailyLesson(profile), [profile]);
}
