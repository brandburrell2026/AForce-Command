import { describe, it, expect } from 'vitest';
import { deriveDailyLesson } from '../intelligence/livingPerformanceModel';
import { LIVING_PERFORMANCE_MIN_LESSON_CONFIDENCE } from '../../config/hydroStateModel';
import {
  RESPONSE_CATEGORIES,
  type AdaptiveResponseProfile,
  type PersonalResponseEntry,
  type ResponseCategory,
  type ResponseOutcome,
} from '../../types/adaptiveResponse';

function insufficient(category: ResponseCategory): PersonalResponseEntry {
  return { category, status: 'insufficient', sampleSize: 0, whatWorked: null, confidenceAfterAction: null };
}

function ready(
  category: ResponseCategory,
  outcome: ResponseOutcome,
  confidence: number,
  followedRate = 0.8,
): PersonalResponseEntry {
  return {
    category,
    status: 'ready',
    sampleSize: 8,
    whatWorked: { sampleSize: 8, followed: Math.round(8 * followedRate), followedRate, outcome },
    confidenceAfterAction: confidence,
  };
}

function profileWith(overrides: Partial<Record<ResponseCategory, PersonalResponseEntry>>): AdaptiveResponseProfile {
  return Object.fromEntries(
    RESPONSE_CATEGORIES.map((c) => [c, overrides[c] ?? insufficient(c)]),
  ) as AdaptiveResponseProfile;
}

const ABOVE = LIVING_PERFORMANCE_MIN_LESSON_CONFIDENCE + 0.1;
const BELOW = LIVING_PERFORMANCE_MIN_LESSON_CONFIDENCE - 0.1;

describe('Section 61 — deriveDailyLesson', () => {
  it('returns Silent Intelligence on-track on an empty library (no fabrication)', () => {
    const lesson = deriveDailyLesson(profileWith({}));
    expect(lesson).toMatchObject({ kind: 'on_track', category: null, lineKey: 'livingPerformance.on_track', confidence: null });
  });

  it('surfaces a lesson for a ready, notable, confident category', () => {
    const lesson = deriveDailyLesson(profileWith({ hydration: ready('hydration', 'improved', ABOVE, 0.75) }));
    expect(lesson).toMatchObject({
      kind: 'lesson',
      category: 'hydration',
      lineKey: 'livingPerformance.lesson_improved',
      categoryLabelKey: 'adaptiveResponse.category_hydration',
      followedPct: 75,
    });
    expect(lesson.confidence).toBeCloseTo(ABOVE);
  });

  it('uses the declined line for a declined outcome', () => {
    const lesson = deriveDailyLesson(profileWith({ recovery: ready('recovery', 'declined', ABOVE) }));
    expect(lesson.lineKey).toBe('livingPerformance.lesson_declined');
  });

  it('stays on-track when the only ready category is below the confidence floor', () => {
    const lesson = deriveDailyLesson(profileWith({ hydration: ready('hydration', 'improved', BELOW) }));
    expect(lesson.kind).toBe('on_track');
  });

  it('stays on-track when outcomes are only steady/unknown (nothing notable)', () => {
    const lesson = deriveDailyLesson(
      profileWith({ hydration: ready('hydration', 'steady', ABOVE), training: ready('training', 'unknown', ABOVE) }),
    );
    expect(lesson.kind).toBe('on_track');
  });

  it('picks the highest-confidence qualifying category (deterministic)', () => {
    const lesson = deriveDailyLesson(
      profileWith({
        hydration: ready('hydration', 'improved', LIVING_PERFORMANCE_MIN_LESSON_CONFIDENCE + 0.05),
        training: ready('training', 'improved', LIVING_PERFORMANCE_MIN_LESSON_CONFIDENCE + 0.3),
      }),
    );
    expect(lesson.category).toBe('training');
  });
});
