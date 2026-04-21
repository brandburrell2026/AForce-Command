/**
 * Async job catalog. Each job has:
 *   - a stable name (used as the queue topic)
 *   - a typed payload contract
 *   - documented retry/backoff policy
 *
 * Production runs these on BullMQ (Redis) or SQS. The api-server boots with
 * an in-process runner so jobs execute synchronously in dev; flip the
 * implementation in `getQueue()` to hand off to a real broker.
 */

export type JobName =
  | 'recompute_score'
  | 'sync_subscription'
  | 'send_notification'
  | 'archive_old_events'
  | 'rebuild_leaderboard_slice'
  | 'export_share_image'
  | 'reconcile_hardware_state'
  | 'precompute_morning_reset';

export interface JobPolicy {
  maxAttempts: number;
  backoff: 'exponential' | 'fixed';
  baseMs: number;
  /** Per-tenant rate limit: max concurrent jobs of this type per user. */
  perUserConcurrency?: number;
  /** Global concurrency cap on the worker pool. */
  globalConcurrency: number;
  /** Move to DLQ after maxAttempts and alert. */
  deadLetter: boolean;
}

export const JOB_POLICY: Record<JobName, JobPolicy> = {
  recompute_score:           { maxAttempts: 3, backoff: 'exponential', baseMs: 250,  perUserConcurrency: 1, globalConcurrency: 200, deadLetter: true  },
  sync_subscription:         { maxAttempts: 8, backoff: 'exponential', baseMs: 1000, perUserConcurrency: 1, globalConcurrency: 50,  deadLetter: true  },
  send_notification:         { maxAttempts: 5, backoff: 'exponential', baseMs: 500,                         globalConcurrency: 500, deadLetter: true  },
  archive_old_events:        { maxAttempts: 3, backoff: 'fixed',       baseMs: 5000,                        globalConcurrency: 4,   deadLetter: true  },
  rebuild_leaderboard_slice: { maxAttempts: 3, backoff: 'exponential', baseMs: 1000,                        globalConcurrency: 16,  deadLetter: false },
  export_share_image:        { maxAttempts: 2, backoff: 'fixed',       baseMs: 250,  perUserConcurrency: 2, globalConcurrency: 64,  deadLetter: false },
  reconcile_hardware_state:  { maxAttempts: 4, backoff: 'exponential', baseMs: 500,  perUserConcurrency: 1, globalConcurrency: 32,  deadLetter: true  },
  precompute_morning_reset:  { maxAttempts: 2, backoff: 'fixed',       baseMs: 250,                         globalConcurrency: 8,   deadLetter: false },
};

export interface Queue {
  enqueue<T>(name: JobName, payload: T, opts?: { delayMs?: number; idempotencyKey?: string }): Promise<void>;
  registerWorker<T>(name: JobName, handler: (payload: T) => Promise<void>): void;
}

class InProcessQueue implements Queue {
  private workers = new Map<JobName, (payload: unknown) => Promise<void>>();
  private dedupe = new Set<string>();

  async enqueue<T>(name: JobName, payload: T, opts?: { delayMs?: number; idempotencyKey?: string }): Promise<void> {
    if (opts?.idempotencyKey) {
      const key = `${name}:${opts.idempotencyKey}`;
      if (this.dedupe.has(key)) return;
      this.dedupe.add(key);
    }
    const handler = this.workers.get(name);
    if (!handler) return; // no worker registered — production would persist
    const run = async () => {
      const policy = JOB_POLICY[name];
      let attempt = 0;
      let lastErr: unknown = null;
      while (attempt < policy.maxAttempts) {
        try { await handler(payload as unknown); return; }
        catch (err) {
          lastErr = err;
          attempt++;
          const delay = policy.backoff === 'exponential'
            ? policy.baseMs * Math.pow(2, attempt - 1)
            : policy.baseMs;
          await new Promise(r => setTimeout(r, delay));
        }
      }
      // In production this would write to the DLQ and emit a metric.
      void lastErr;
    };
    if (opts?.delayMs) setTimeout(() => { void run(); }, opts.delayMs);
    else void run();
  }

  registerWorker<T>(name: JobName, handler: (payload: T) => Promise<void>): void {
    this.workers.set(name, handler as (p: unknown) => Promise<void>);
  }
}

let _queue: Queue | null = null;
export function getQueue(): Queue {
  if (!_queue) _queue = new InProcessQueue();
  return _queue;
}
export function setQueue(q: Queue): void { _queue = q; }
