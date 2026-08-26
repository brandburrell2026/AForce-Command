import { describe, it, expect, vi } from 'vitest';

// `services/timelineLock.ts` imports `useFeatureFlags` from
// `@/store/useAppStore` at module scope (for the hidden
// `useTimelineLock()` hook, which this suite does not test).
// The store transitively reaches RN/Expo native edges (the `expo`
// winter runtime, expo-notifications, AsyncStorage) that fail to
// load under Vitest's Node environment. Per repo convention
// (see orbReasons.test.ts, coachModeResolution.test.ts,
// realApi.intake.test.ts), stub the RN-touching edge minimally
// and test the real pure logic.
vi.mock('@/store/useAppStore', () => ({
  useFeatureFlags: () => ({}),
}));

import {
  MICRO_MOTION_MAX_DURATION_MS,
  TIMELINE_ALLOWED_ACTIONS,
  TIMELINE_ALLOWED_LABELS,
  TIMELINE_PROTECTED_FIELDS,
  TIMELINE_PROTECTED_LABELS,
  isMicroMotion,
  isTimelineActionAllowed,
  isTimelineFieldProtected,
} from '../timelineLock';

describe('timelineLock — protected fields', () => {
  it('lists the eleven spec-protected fields in order', () => {
    expect(TIMELINE_PROTECTED_FIELDS).toEqual([
      'performanceTimeline',
      '7d',
      '30d',
      '90d',
      'momentum',
      'avgScore',
      'consistency',
      'streak',
      'heatMap',
      'signalCurve',
      'winMoments',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(TIMELINE_PROTECTED_LABELS.performanceTimeline).toBe(
      'Performance Timeline',
    );
    expect(TIMELINE_PROTECTED_LABELS['7d']).toBe('7d');
    expect(TIMELINE_PROTECTED_LABELS['30d']).toBe('30d');
    expect(TIMELINE_PROTECTED_LABELS['90d']).toBe('90d');
    expect(TIMELINE_PROTECTED_LABELS.momentum).toBe('Momentum');
    expect(TIMELINE_PROTECTED_LABELS.avgScore).toBe('Avg Score');
    expect(TIMELINE_PROTECTED_LABELS.consistency).toBe('Consistency');
    expect(TIMELINE_PROTECTED_LABELS.streak).toBe('Streak');
    expect(TIMELINE_PROTECTED_LABELS.heatMap).toBe('Heat map');
    expect(TIMELINE_PROTECTED_LABELS.signalCurve).toBe('Signal curve');
    expect(TIMELINE_PROTECTED_LABELS.winMoments).toBe('Win Moments');
  });
});

describe('isTimelineFieldProtected', () => {
  it('returns true for every protected field', () => {
    for (const f of TIMELINE_PROTECTED_FIELDS) {
      expect(isTimelineFieldProtected(f)).toBe(true);
    }
  });

  it('returns false for unknown fields', () => {
    expect(isTimelineFieldProtected('hydration')).toBe(false);
    expect(isTimelineFieldProtected('')).toBe(false);
  });
});

describe('timelineLock — allowed actions', () => {
  it('exposes exactly the four spec-allowed actions', () => {
    expect(TIMELINE_ALLOWED_ACTIONS).toEqual([
      'tap_node',
      'replay',
      'day_story',
      'export',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(TIMELINE_ALLOWED_LABELS.tap_node).toBe('Tap node');
    expect(TIMELINE_ALLOWED_LABELS.replay).toBe('Replay');
    expect(TIMELINE_ALLOWED_LABELS.day_story).toBe('Day Story');
    expect(TIMELINE_ALLOWED_LABELS.export).toBe('Export');
  });
});

describe('isTimelineActionAllowed', () => {
  it('allows the four spec actions', () => {
    expect(isTimelineActionAllowed('tap_node')).toBe(true);
    expect(isTimelineActionAllowed('replay')).toBe(true);
    expect(isTimelineActionAllowed('day_story')).toBe(true);
    expect(isTimelineActionAllowed('export')).toBe(true);
  });

  it('denies destructive verbs', () => {
    for (const verb of ['edit', 'delete', 'reorder', 'hide', 'add', 'share']) {
      expect(isTimelineActionAllowed(verb)).toBe(false);
    }
  });

  it('denies the empty string and unknown verbs', () => {
    expect(isTimelineActionAllowed('')).toBe(false);
    expect(isTimelineActionAllowed('whatever')).toBe(false);
  });
});

describe('isMicroMotion', () => {
  it('treats sub-cap positive durations as micro motion', () => {
    expect(isMicroMotion(1)).toBe(true);
    expect(isMicroMotion(100)).toBe(true);
    expect(isMicroMotion(MICRO_MOTION_MAX_DURATION_MS)).toBe(true);
  });

  it('rejects anything past the cap (no longer micro)', () => {
    expect(isMicroMotion(MICRO_MOTION_MAX_DURATION_MS + 1)).toBe(false);
    expect(isMicroMotion(1000)).toBe(false);
  });

  it('rejects zero and negative durations', () => {
    expect(isMicroMotion(0)).toBe(false);
    expect(isMicroMotion(-1)).toBe(false);
  });
});
