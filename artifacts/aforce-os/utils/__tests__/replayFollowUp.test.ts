import { describe, expect, it } from 'vitest';

import {
  REPLAY_ANSWERS,
  REPLAY_NOTE_MAX,
  cleanReplayNote,
  replayNoteLine,
  replayObstacleOptions,
  replayStep,
} from '../replayFollowUp';

describe('Replay follow-ups', () => {
  it('offers the three answers the prototype shows', () => {
    expect(REPLAY_ANSWERS.map((a) => a.label)).toEqual(['Yes, it worked', 'Partly', 'Not really']);
  });

  it('words the obstacles for the kind of Moment, always ending in "Something else"', () => {
    expect(replayObstacleOptions('personal').map((o) => o.label)).toEqual([
      'I was rushed', 'Low energy', 'Forgot water', 'Something else',
    ]);
    for (const type of ['training', 'performance'] as const) {
      expect(replayObstacleOptions(type).map((o) => o.label)).toEqual([
        'Started late', 'Ran out of gas', 'Forgot water', 'Something else',
      ]);
    }
    expect(replayObstacleOptions(undefined)).toBe(replayObstacleOptions('work'));
  });

  it('walks ask → follow-up → closed, from what is saved', () => {
    expect(replayStep(undefined, null)).toBe('ask');
    expect(replayStep({}, null)).toBe('ask');
    expect(replayStep({ replay: 'yes' }, null)).toBe('yes');
    expect(replayStep({ replay: 'skipped' }, null)).toBe('skipped');
    expect(replayStep({ replay: 'partly' }, null)).toBe('miss');
    expect(replayStep({ replay: 'not_really' }, 'other')).toBe('other');
    expect(replayStep({ replay: 'not_really', replayObstacle: 'water' }, null)).toBe('noted');
    expect(replayStep({ replay: 'partly', replayObstacle: 'skipped' }, null)).toBe('noted');
  });

  it('"Yes" and "Skip" never ask a follow-up, and re-asking wins over anything saved', () => {
    expect(replayStep({ replay: 'yes' }, 'other')).toBe('yes');
    expect(replayStep({ replay: 'skipped' }, 'other')).toBe('skipped');
    expect(replayStep({ replay: 'not_really', replayObstacle: 'late' }, 'ask')).toBe('ask');
  });

  it('tidies the member\'s own words and treats blank as no note', () => {
    expect(cleanReplayNote('  the ride \n came late ')).toBe('the ride came late');
    expect(cleanReplayNote('   ')).toBeUndefined();
    expect(cleanReplayNote('x'.repeat(300))).toHaveLength(REPLAY_NOTE_MAX);
  });

  it('says back only what the member told it', () => {
    expect(replayNoteLine(undefined, 'work')).toBeNull();
    expect(replayNoteLine({ replay: 'skipped' }, 'work')).toBeNull();
    expect(replayNoteLine({ replay: 'yes' }, 'work')).toBe('Yes, it worked');
    expect(replayNoteLine({ replay: 'partly', replayObstacle: 'skipped' }, 'work')).toBe('Partly');
    expect(replayNoteLine({ replay: 'not_really', replayObstacle: 'drain' }, 'training')).toBe('Not really · Ran out of gas');
    expect(replayNoteLine({ replay: 'not_really', replayObstacle: 'other', replayNote: 'traffic' }, 'work')).toBe('Not really · “traffic”');
    expect(replayNoteLine({ replay: 'not_really', replayObstacle: 'other' }, 'work')).toBe('Not really');
  });
});
