import { describe, it, expect } from 'vitest';

import { exerciseRow, workoutFocus } from '../oneBreath/workoutFocus';

describe('workoutFocus (spec v1.8.2 Parts 8.2, 8.3)', () => {
  it.each([
    ['Lift tomorrow at 6:30 AM, want my legs fresh', 'unspecified'], // a goal, not leg day (V16)
    ['Morning lift', 'unspecified'],
    ['Leg day tomorrow', 'lower_body'],
    ['Lower body lift at 6', 'lower_body'],
    ['Squats and deadlifts Saturday', 'lower_body'],
    ['Upper body at the gym tomorrow at 6 AM, build strength', 'upper_body'],
    ['Chest day', 'upper_body'],
    ['Full body workout at home', 'full_body'],
    ['Upper body and leg day combined lift', 'full_body'],
  ] as const)('"%s" → %s', (text, focus) => {
    expect(workoutFocus(text)).toBe(focus);
  });
  it('is null for anything that is not a workout', () => {
    for (const text of ['Team dinner tomorrow', 'Presentation at 2 PM', 'Bedtime', 'Pickleball Saturday']) {
      expect(workoutFocus(text)).toBeNull();
    }
  });
  it('never suggests exercises; the row says why (V17)', () => {
    expect(exerciseRow('upper_body')).toBe('Not offered yet · the upper-body playbook isn’t reviewed yet, so I won’t suggest any.');
    expect(exerciseRow('unspecified')).toBe('Not offered yet · the workout playbook isn’t reviewed yet, so I won’t suggest any.');
  });
});
