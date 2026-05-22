/**
 * useScoreTrend — rolling sample buffer over the live hydration score.
 *
 * Captures up to N timestamped samples and returns:
 *   - direction: 'rising' | 'falling' | 'flat'
 *   - delta:     signed point difference over the sample window
 *   - ageSec:    seconds spanned by the active window (for the "last Ns" label)
 *
 * Pure UI state. The engine is still the source of truth — this hook
 * only exposes the visible trajectory of `score` so the home surface
 * can render a trend arrow + live status line without polling the
 * engine's internal prediction model.
 */

import React from 'react';

const SAMPLE_LIMIT = 12;
/** Minimum |delta| (points) before we leave the 'flat' bucket. */
const FLAT_THRESHOLD = 1;
/** Maximum sample-window age we'll keep (ms). Older samples get evicted. */
const MAX_AGE_MS = 10 * 60 * 1000;

export type TrendDirection = 'rising' | 'falling' | 'flat';

export interface ScoreTrend {
  direction: TrendDirection;
  /** Signed point delta over the active sample window. */
  delta: number;
  /** Seconds spanned by the active sample window. */
  ageSec: number;
}

interface Sample {
  score: number;
  at: number;
}

export function useScoreTrend(score: number): ScoreTrend {
  const samplesRef = React.useRef<Sample[]>([]);
  const [trend, setTrend] = React.useState<ScoreTrend>({
    direction: 'flat',
    delta: 0,
    ageSec: 0,
  });

  React.useEffect(() => {
    if (!Number.isFinite(score)) return;
    const now = Date.now();
    const buf = samplesRef.current;
    const last = buf[buf.length - 1];

    // Skip pure noise — only record when the integer score changes
    // OR more than ~30s have elapsed (keeps the buffer alive on idle).
    if (last && last.score === score && now - last.at < 30_000) return;

    buf.push({ score, at: now });
    while (buf.length > SAMPLE_LIMIT) buf.shift();
    while (buf.length > 1 && now - buf[0].at > MAX_AGE_MS) buf.shift();

    const first = buf[0];
    const delta = score - first.score;
    const ageSec = Math.round((now - first.at) / 1000);

    const direction: TrendDirection =
      Math.abs(delta) < FLAT_THRESHOLD ? 'flat'
      : delta > 0 ? 'rising'
      : 'falling';

    setTrend({ direction, delta, ageSec });
  }, [score]);

  return trend;
}
