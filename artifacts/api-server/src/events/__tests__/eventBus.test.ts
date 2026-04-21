import { describe, it, expect, beforeEach } from 'vitest';
import { setEventBus, getEventBus } from '../eventBus';
import type { EventEnvelope } from '../schemas';
import { EVENT_TOPICS } from '../schemas';

beforeEach(() => {
  // Force a fresh in-memory bus per test.
  setEventBus(undefined as never);
  // Re-init.
  void getEventBus();
});

function envelope(id: string, payload: Record<string, unknown> = {}): EventEnvelope {
  return {
    eventId: id,
    eventType: EVENT_TOPICS.intake_logged,
    userId: 'u1',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    source: 'test',
    payload,
  };
}

describe('InMemoryBus', () => {
  it('delivers each event to every subscribed group', async () => {
    const bus = getEventBus();
    const seenA: string[] = [];
    const seenB: string[] = [];
    await bus.subscribe(EVENT_TOPICS.intake_logged, 'A', async (e) => { seenA.push(e.eventId); });
    await bus.subscribe(EVENT_TOPICS.intake_logged, 'B', async (e) => { seenB.push(e.eventId); });
    await bus.publish(EVENT_TOPICS.intake_logged, envelope('e1'));
    expect(seenA).toEqual(['e1']);
    expect(seenB).toEqual(['e1']);
  });

  it('dedupes per-group by eventId on republish', async () => {
    const bus = getEventBus();
    const seen: string[] = [];
    await bus.subscribe(EVENT_TOPICS.intake_logged, 'A', async (e) => { seen.push(e.eventId); });
    const e = envelope('e1');
    await bus.publish(EVENT_TOPICS.intake_logged, e);
    await bus.publish(EVENT_TOPICS.intake_logged, e);
    expect(seen).toEqual(['e1']); // second publish is dropped for group A
  });

  it('routes failed handlers to the DLQ and does not commit dedupe', async () => {
    const bus = getEventBus();
    let attempts = 0;
    await bus.subscribe(EVENT_TOPICS.intake_logged, 'flaky', async () => {
      attempts++;
      if (attempts === 1) throw new Error('boom');
    });
    const e = envelope('e1');
    await bus.publish(EVENT_TOPICS.intake_logged, e);
    expect(attempts).toBe(1);
    const dlq = bus.drainDeadLetter();
    expect(dlq).toHaveLength(1);
    expect(dlq[0]?.error).toContain('boom');

    // Republish should retry because the failed event was never committed.
    await bus.publish(EVENT_TOPICS.intake_logged, e);
    expect(attempts).toBe(2);
  });
});
