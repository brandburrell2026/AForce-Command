/**
 * statusVerb — pure mapping from (performance level × trend direction)
 * to a single tracked-uppercase verb the home Live Status Line displays
 * next to the trend arrow.
 *
 * Intentionally dependency-free so the verb set stays unit-testable and
 * the home screen never derives copy ad-hoc.
 */

import type { PerformanceLevel } from '../types';
import type { TrendDirection } from '../hooks/useScoreTrend';

export type StatusVerb =
  | 'ASCENDING'
  | 'LOCKED IN'
  | 'HOLDING'
  | 'DRIFTING'
  | 'DECLINING'
  | 'RECOVERING'
  | 'CRITICAL';

export function getStatusVerb(
  level: PerformanceLevel,
  direction: TrendDirection,
): StatusVerb {
  if (level === 'DEPLETED') {
    if (direction === 'rising') return 'RECOVERING';
    return 'CRITICAL';
  }
  if (level === 'RECOVERING') {
    if (direction === 'rising') return 'RECOVERING';
    if (direction === 'falling') return 'DECLINING';
    return 'HOLDING';
  }
  if (level === 'PEAK') {
    if (direction === 'rising') return 'ASCENDING';
    if (direction === 'falling') return 'DRIFTING';
    return 'LOCKED IN';
  }
  // BALANCED (default)
  if (direction === 'rising') return 'ASCENDING';
  if (direction === 'falling') return 'DRIFTING';
  return 'HOLDING';
}
