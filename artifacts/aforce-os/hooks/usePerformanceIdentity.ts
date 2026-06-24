/**
 * usePerformanceIdentity — hook-friendly selector for the (inert) Performance
 * Identity record.
 *
 * It reads the unified Performance Memory snapshot via
 * `useUnifiedPerformanceMemory` and re-shapes it through the pure
 * `derivePerformanceIdentity`. Like the memory hook it dispatches NOTHING into
 * any reducer (Score-Protection), and the classifier it surfaces is INERT —
 * `archetype` / `confidence` are always null.
 */
import React from 'react';

import { useUnifiedPerformanceMemory } from '@/hooks/useUnifiedPerformanceMemory';
import {
  derivePerformanceIdentity,
  type PerformanceIdentity,
} from '@/utils/performanceIdentity';

export function usePerformanceIdentity(): PerformanceIdentity {
  const memory = useUnifiedPerformanceMemory();
  return React.useMemo(() => derivePerformanceIdentity(memory), [memory]);
}
