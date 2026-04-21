/**
 * Metrics facade. Production binds prom-client and exposes /metrics; this
 * stub keeps a histogram/counter per name in memory so business code can
 * emit metrics today without forcing a Prometheus dependency.
 *
 * Conventions:
 *   - histogram: latency_ms.<flow>
 *   - counter:   requests_total.<route>.<status>
 *   - gauge:     ws_connections, queue_depth.<job>, cache_hit_ratio.<scope>
 */

interface HistSnapshot { count: number; sum: number; p50: number; p95: number; p99: number; max: number }

class Histogram {
  private samples: number[] = [];
  observe(v: number): void {
    this.samples.push(v);
    if (this.samples.length > 1024) this.samples.splice(0, this.samples.length - 1024);
  }
  snapshot(): HistSnapshot {
    if (this.samples.length === 0) return { count: 0, sum: 0, p50: 0, p95: 0, p99: 0, max: 0 };
    const sorted = [...this.samples].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
    const sum = sorted.reduce((a, b) => a + b, 0);
    return { count: sorted.length, sum, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted[sorted.length - 1]! };
  }
}

const histograms = new Map<string, Histogram>();
const counters = new Map<string, number>();
const gauges = new Map<string, number>();

export function observeLatency(flow: string, ms: number): void {
  const key = `latency_ms.${flow}`;
  let h = histograms.get(key);
  if (!h) { h = new Histogram(); histograms.set(key, h); }
  h.observe(ms);
}

export function incCounter(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function setGauge(name: string, value: number): void {
  gauges.set(name, value);
}

export function snapshot(): {
  histograms: Record<string, HistSnapshot>;
  counters: Record<string, number>;
  gauges: Record<string, number>;
} {
  const out = { histograms: {} as Record<string, HistSnapshot>, counters: {} as Record<string, number>, gauges: {} as Record<string, number> };
  histograms.forEach((h, k) => { out.histograms[k] = h.snapshot(); });
  counters.forEach((v, k) => { out.counters[k] = v; });
  gauges.forEach((v, k) => { out.gauges[k] = v; });
  return out;
}

/** Thin helper for timing async operations. */
export async function timed<T>(flow: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try { return await fn(); }
  finally { observeLatency(flow, Date.now() - start); }
}
