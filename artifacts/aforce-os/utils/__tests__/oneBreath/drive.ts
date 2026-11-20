/**
 * Test driver for One Breath conversations: plays inputs through
 * `oneBreathTurn` and keeps every turn, so a scenario can assert on what was
 * said, what was asked of the owning services, and how often.
 */
import {
  emptyOneBreathState,
  oneBreathTurn,
  type OneBreathContext,
  type OneBreathEffect,
  type OneBreathInput,
  type OneBreathTurn,
} from '@/utils/oneBreath/session';

export const BASE_CONTEXT: OneBreathContext = {
  // A Thursday, so "tomorrow" is Friday and "Saturday" is two days out.
  nowIso: '2026-11-19T16:00:00.000Z',
  social: false,
  momentInWindow: false,
  learningOn: true,
  interpreterReachable: true,
  networkUp: true,
  // Sample values for tests only. In the app these come from HydroState and the Moments store.
  hydroState: { value: 51, word: 'Behind', estimated: true, source: 'drinks you logged today' },
  upcoming: [{ title: 'Morning lift', day: 'Fri, Nov 20', time: '6:30 AM' }],
};

export const say = (words: string, via: 'typed' | 'spoken' = 'typed'): OneBreathInput => ({ kind: 'say', words, via });
export const tap = (control: string, value?: string): OneBreathInput => ({ kind: 'tap', control, value });
export const wait = (ms: number): OneBreathInput => ({ kind: 'wait', ms });
export const scan = (
  barcode: string,
  product?: { name: string; categoryId: string; packageOz?: number },
): OneBreathInput => ({ kind: 'scan', barcode, product });

export interface Run {
  turns: OneBreathTurn[];
  last: OneBreathTurn;
  effects: OneBreathEffect[];
  of: <K extends OneBreathEffect['kind']>(kind: K) => Extract<OneBreathEffect, { kind: K }>[];
}

export function run(inputs: OneBreathInput[], context: Partial<OneBreathContext> = {}): Run {
  const ctx = { ...BASE_CONTEXT, ...context };
  let state = emptyOneBreathState();
  const turns: OneBreathTurn[] = [];
  for (const input of inputs) {
    const turn = oneBreathTurn(state, input, ctx);
    turns.push(turn);
    state = turn.state;
  }
  const effects = turns.flatMap((t) => t.effects);
  return {
    turns,
    last: turns[turns.length - 1],
    effects,
    of: (kind) => effects.filter((e) => e.kind === kind) as never,
  };
}

/** Effects that change something the member owns. Reads and opened screens are not writes. */
export const WRITE_KINDS: OneBreathEffect['kind'][] = [
  'save_moment',
  'log_drink',
  'lock_in',
  'send_message',
  'share_plan',
  'made_it_back',
  'save_lesson',
];

export const writes = (effects: OneBreathEffect[]) => effects.filter((e) => WRITE_KINDS.includes(e.kind));

/** Ids used more than once among writes: a duplicate save, log or send. */
export function duplicateWriteIds(effects: OneBreathEffect[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const e of writes(effects)) {
    if (seen.has(e.id)) dupes.add(e.id);
    seen.add(e.id);
  }
  return [...dupes];
}
