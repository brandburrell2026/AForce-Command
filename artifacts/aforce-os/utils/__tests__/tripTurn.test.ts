/**
 * "Tell AFORCE your trip" as an exchange: one sentence, one question at a
 * time, corrections without starting over, and nothing inferred.
 */
import { describe, it, expect } from 'vitest';
import { legComplete, nextTripQuestion, tripComplete, tripDayLabel, tripTimeLabel, tripTitle, tripTurn, type TripDraft } from '../travel/tripTurn';

const NOW = new Date(2026, 10, 19, 10, 0); // Thursday 19 Nov 2026
const say = (words: string[], start: TripDraft | null = null) => {
  let draft = start;
  const steps = [];
  for (const w of words) {
    const step = tripTurn(draft, w, NOW);
    steps.push(step);
    draft = step.draft;
  }
  return { draft: draft!, steps, last: steps[steps.length - 1]! };
};

describe('one sentence', () => {
  it('a straightforward flight is complete with no questions', () => {
    const { draft } = say(['Delta 123 from JFK to Los Angeles tomorrow at 9:05 AM']);
    expect(draft.legs).toEqual([{ flightNumber: 'DL123', origin: 'JFK', destination: 'LAX', date: '2026-11-20', time: '09:05' }]);
    expect(draft.asking).toBeUndefined();
    expect(tripComplete(draft)).toBe(true);
    expect(tripTitle(draft)).toBe('JFK → LAX · Nov 20');
  });

  it('words with nothing about a trip start nothing', () => {
    const { last } = say(['what a lovely day']);
    expect(last.understood).toBe(false);
    expect(last.draft.asking).toBeUndefined();
    expect(tripComplete(last.draft)).toBe(false);
  });
});

describe('asks only for what is missing, one thing at a time', () => {
  it('a missing time, then a missing flight number', () => {
    const r = say(['flying delta from JFK to LAX tomorrow', '9:05 am', '123']);
    expect(r.steps[0]!.draft.asking).toMatchObject({ field: 'time', text: 'What time does it leave?' });
    expect(r.steps[1]!.draft.asking).toMatchObject({ field: 'flightNumber', text: 'What’s the DL flight number?' });
    expect(r.draft.legs[0]).toEqual({ origin: 'JFK', destination: 'LAX', date: '2026-11-20', time: '09:05', flightNumber: 'DL123' });
    expect(r.draft.asking).toBeUndefined();
  });

  it('a city with several airports is asked about with its airports as choices', () => {
    const r = say(['united 5 from houston to boston tomorrow at 9 am']);
    expect(r.draft.asking).toEqual({ leg: 0, field: 'origin', text: 'Which Houston airport?', choices: [{ label: 'IAH', value: 'IAH' }, { label: 'HOU', value: 'HOU' }] });
    expect(say(['IAH'], r.draft).draft.legs[0]!.origin).toBe('IAH');
    expect(say(['hobby'], r.draft).draft.legs[0]!.origin).toBe('HOU');
    expect(tripComplete(say(['HOU'], r.draft).draft)).toBe(true);
  });

  it('"at 9" is asked as morning or evening, never assumed', () => {
    const r = say(['delta 5 from jfk to lax saturday at 9']);
    expect(r.draft.legs[0]!.time).toBeUndefined();
    expect(r.draft.asking).toEqual({ leg: 0, field: 'time', text: '9:00 in the morning or evening?', choices: [{ label: '9:00 AM', value: '09:00' }, { label: '9:00 PM', value: '21:00' }] });
    expect(say(['evening'], r.draft).draft.legs[0]!.time).toBe('21:00');
    expect(say(['9:00 AM'], r.draft).draft.legs[0]!.time).toBe('09:00');
    expect(say(['am'], r.draft).draft.legs[0]!.time).toBe('09:00');
  });

  it('"next Friday" offers the two dates it could be', () => {
    const r = say(['delta 5 from jfk to lax next friday at 9 am']);
    expect(r.draft.asking).toEqual({ leg: 0, field: 'date', text: 'Which Friday?', choices: [{ label: 'Fri, Nov 20', value: '2026-11-20' }, { label: 'Fri, Nov 27', value: '2026-11-27' }] });
    expect(say(['Fri, Nov 27'], r.draft).draft.legs[0]!.date).toBe('2026-11-27');
    expect(say(['the second'], r.draft).draft.legs[0]!.date).toBe('2026-11-27');
    expect(say(['november 27'], r.draft).draft.legs[0]!.date).toBe('2026-11-27');
  });

  it('an unknown place is asked about, and a second unclear answer keeps asking', () => {
    const r = say(['delta 5 from springfield to lax tomorrow at 9 am']);
    expect(r.draft.asking?.text).toBe('I don’t know “springfield”. What’s the airport or its three-letter code?');
    const again = say(['portland'], r.draft);
    expect(again.draft.legs[0]!.origin).toBeUndefined();
    expect(again.draft.asking?.text).toBe('Which Portland airport?');
    expect(say(['PDX'], again.draft).draft.legs[0]!.origin).toBe('PDX');
  });

  it('only a destination: asks where from, then the day, time and flight, in that order', () => {
    const r = say(['flying to miami']);
    expect(r.draft.asking?.field).toBe('origin');
    const order = say(['from newark', 'tomorrow', '7 am', 'united 88'], r.draft);
    expect(order.steps.map((s) => s.draft.asking?.field)).toEqual(['date', 'time', 'flightNumber', undefined]);
    expect(order.draft.legs[0]).toEqual({ destination: 'MIA', origin: 'EWR', date: '2026-11-20', time: '07:00', flightNumber: 'UA88' });
  });

  it('an answer that is not an answer changes nothing and keeps the question', () => {
    const r = say(['flying delta from JFK to LAX tomorrow']);
    const off = say(['hmm let me think'], r.draft);
    expect(off.last.understood).toBe(false);
    expect(off.draft).toBe(r.draft);
  });

  it('a flight number is never built from digits alone when no airline was named', () => {
    const r = say(['from JFK to LAX tomorrow at 9 am']);
    expect(r.draft.asking?.text).toBe('What’s the flight number?');
    expect(say(['123'], r.draft).last.understood).toBe(false);
    expect(say(['delta 123'], r.draft).draft.legs[0]!.flightNumber).toBe('DL123');
  });
});

describe('corrections without starting over', () => {
  const start = say(['Delta 123 from JFK to Los Angeles tomorrow at 9:05 AM']).draft;

  it('"No, Saturday" moves the day and keeps everything else', () => {
    const r = say(['No, Saturday'], start);
    expect(r.draft.legs[0]).toEqual({ ...start.legs[0], date: '2026-11-21' });
    expect(tripComplete(r.draft)).toBe(true);
  });

  it('a new time, said in full or relative to the one already there', () => {
    expect(say(['it leaves at 11:30 am'], start).draft.legs[0]!.time).toBe('11:30');
    expect(say(['make it 10'], start).draft.legs[0]!.time).toBe('10:00');
    expect(say(['actually 4 pm'], start).draft.legs[0]!.time).toBe('16:00');
  });

  it('a different flight number, or airport', () => {
    expect(say(["it's Delta 456"], start).draft.legs[0]!.flightNumber).toBe('DL456');
    expect(say(['to San Francisco'], start).draft.legs[0]!.destination).toBe('SFO');
    expect(say(['no, from Newark'], start).draft.legs[0]!.origin).toBe('EWR');
  });

  it('a correction to an ambiguous place is not applied; nothing is picked for the member', () => {
    const r = say(['to Houston'], start);
    expect(r.last.understood).toBe(false);
    expect(r.draft).toBe(start);
  });

  it('several corrections in a row all land on the same draft', () => {
    const r = say(['No, Saturday', 'make it 10', "it's Delta 456"], start);
    expect(r.draft.legs[0]).toEqual({ flightNumber: 'DL456', origin: 'JFK', destination: 'LAX', date: '2026-11-21', time: '10:00' });
    expect(r.draft.heard).toHaveLength(4);
  });

  it('"undo" or "repeat that" alone changes nothing', () => {
    for (const w of ['undo', 'say that again']) expect(say([w], start).draft).toBe(start);
  });
});

describe('the way back', () => {
  it('is asked about only after the way out is complete', () => {
    const r = say(['United 88 from Newark to San Francisco December 3 at 8 am returning December 7']);
    expect(r.draft.legs[1]).toEqual({ origin: 'SFO', destination: 'EWR', date: '2026-12-07' });
    expect(r.draft.asking).toEqual({ leg: 1, field: 'time', text: 'What time does the return leave?' });
    const done = say(['5 pm', 'united 99'], r.draft);
    expect(done.draft.legs[1]).toEqual({ origin: 'SFO', destination: 'EWR', date: '2026-12-07', time: '17:00', flightNumber: 'UA99' });
    expect(tripComplete(done.draft)).toBe(true);
  });

  it('takes its airports from the way out once those are known', () => {
    const r = say(['flying to miami tomorrow at 7 am returning sunday', 'from newark']);
    expect(r.draft.legs[1]).toMatchObject({ origin: 'MIA', destination: 'EWR', date: '2026-11-22' });
  });

  it('can be dropped: "just one way"', () => {
    const r = say(['United 88 from Newark to San Francisco December 3 at 8 am returning December 7', 'just one way']);
    expect(r.draft.legs).toHaveLength(1);
    expect(tripComplete(r.draft)).toBe(true);
  });

  it('a correction about the return changes the return only', () => {
    const r = say(['United 88 from Newark to San Francisco December 3 at 8 am returning December 7 at 5 pm on United 99', 'the return is December 8']);
    expect(r.draft.legs[0]!.date).toBe('2026-12-03');
    expect(r.draft.legs[1]!.date).toBe('2026-12-08');
  });
});

describe('never inferred, never saved', () => {
  it('the arrival date is not assumed from an arrival time', () => {
    const r = say(['delta 5 from jfk to lax tomorrow at 11 pm landing at 2 am']);
    expect(r.draft.legs[0]).toMatchObject({ arrivalTime: '02:00' });
    expect(r.draft.legs[0]!.arrivalDate).toBeUndefined();
  });

  it('a trip is not complete while any required field of any leg is missing', () => {
    expect(legComplete({ origin: 'JFK', destination: 'LAX', date: '2026-11-20', time: '09:05' })).toBe(false);
    expect(nextTripQuestion({ legs: [{}], open: [], heard: [] })?.field).toBe('origin');
  });

  it('the module only reads words: no storage, network or save path', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const code = readFileSync(join(__dirname, '..', 'travel', 'tripTurn.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/fetch\(|AsyncStorage|SecureStore|useTravelIntelligence|\.save\(|services\/travel/);
  });

  it('labels', () => {
    expect(tripDayLabel('2026-11-21')).toBe('Sat, Nov 21');
    expect(tripTimeLabel('07:15')).toBe('7:15 AM');
    expect(tripTimeLabel('00:40')).toBe('12:40 AM');
    expect(tripTitle({ legs: [{ destination: 'MIA' }], open: [], heard: [] })).toBe('');
  });
});
