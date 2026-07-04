/**
 * Section 58 — read-only accessor for the current Command Confidence™ level.
 *
 * Surfaces the level ALREADY computed by the scoring engine
 * (`utils/scoringEngine.ts` → `generateCommand`, off-limits) and held on the
 * engine slice. It recomputes nothing and never touches the score, so every
 * Section 58 surface shows the exact same level as Today's Command.
 */
import { useEngineSlice } from '../store/slices';
import type { CommandConfidenceLevel } from '../types';

export function useCommandConfidence(): CommandConfidenceLevel | undefined {
  return useEngineSlice().command?.confidence;
}
