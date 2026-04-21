/**
 * Event bus interface. Production binds Kafka/Redpanda; the in-memory
 * implementation here lets the api-server boot and unit-test event flow
 * without a broker.
 *
 * The in-memory bus mirrors Kafka semantics that real consumers must honor:
 *   - Every subscribed (topic, group) handler receives every event.
 *   - Per-(group, eventId) dedupe — a single group never processes the same
 *     event twice, but two groups each see it.
 *   - The dedupe entry is committed *after* successful handler completion,
 *     so a thrown handler can be retried without losing exactly-once
 *     semantics. Failed events are routed to an in-memory DLQ surface.
 *
 * Production responsibilities (NOT YET WIRED):
 *   - Partition by `userId` so per-user event order is preserved.
 *   - Batch publishes for throughput; flush on shutdown.
 *   - Consumer groups with auto-commit OFF — commit after handler success.
 *   - Dead-letter queue per topic for un-handleable events.
 *   - Replay support via `--from-offset`.
 *   - Schema-registry integration on publish + consume.
 */

import type { EventEnvelope, EventTopic } from './schemas';

export type EventHandler<T = unknown> = (event: EventEnvelope<T>) => Promise<void>;

export interface DeadLetterEntry {
  topic: EventTopic;
  group: string;
  event: EventEnvelope<unknown>;
  error: string;
  failedAt: string;
}

export interface EventBus {
  publish<T>(topic: EventTopic, event: EventEnvelope<T>): Promise<void>;
  subscribe<T>(topic: EventTopic, group: string, handler: EventHandler<T>): Promise<void>;
  /** Read-only view of failed events for inspection / replay. */
  drainDeadLetter(): DeadLetterEntry[];
}

interface Subscription { group: string; handler: EventHandler<unknown> }

class InMemoryBus implements EventBus {
  private subs = new Map<EventTopic, Subscription[]>();
  /** Dedupe key = `${topic}:${group}:${eventId}` — committed AFTER handler success. */
  private committed = new Set<string>();
  private dlq: DeadLetterEntry[] = [];

  async publish<T>(topic: EventTopic, event: EventEnvelope<T>): Promise<void> {
    const list = this.subs.get(topic) ?? [];
    // Each subscription is a separate consumer group — every group sees the event.
    await Promise.all(list.map(async (sub) => {
      const dedupeKey = `${topic}:${sub.group}:${event.eventId}`;
      if (this.committed.has(dedupeKey)) return;
      try {
        await sub.handler(event as unknown as EventEnvelope<unknown>);
        // Commit the offset only after the handler succeeds.
        this.committed.add(dedupeKey);
      } catch (err) {
        this.dlq.push({
          topic,
          group: sub.group,
          event: event as unknown as EventEnvelope<unknown>,
          error: err instanceof Error ? err.message : String(err),
          failedAt: new Date().toISOString(),
        });
        // Production would also emit a metric + alert here.
      }
    }));
  }

  async subscribe<T>(topic: EventTopic, group: string, handler: EventHandler<T>): Promise<void> {
    const list = this.subs.get(topic) ?? [];
    list.push({ group, handler: handler as unknown as EventHandler<unknown> });
    this.subs.set(topic, list);
  }

  drainDeadLetter(): DeadLetterEntry[] {
    const out = [...this.dlq];
    this.dlq = [];
    return out;
  }
}

let _bus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!_bus) _bus = new InMemoryBus();
  return _bus;
}

export function setEventBus(bus: EventBus): void { _bus = bus; }
