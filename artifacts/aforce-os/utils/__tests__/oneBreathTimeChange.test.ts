import { describe, it, expect } from 'vitest';

import { changedDate, changedTime } from '../oneBreath/timeChange';

describe('changedTime ("make it 7", Part 6.1.5)', () => {
  it.each([
    ['06:30', 'make it 7', '07:00'],
    ['18:30', 'make it 7', '19:00'],
    ['06:30', 'move it to 7:30', '07:30'],
    ['06:30', 'change it to 7 PM', '19:00'],
    ['18:30', 'change it to 7 a.m.', '07:00'],
    ['06:30', 'can I go at 7 instead?', '07:00'],
    ['06:30', 'move it from 6:30 to 7:15', '07:15'],
    ['06:30', 'make it 19:45', '19:45'],
    ['06:30', 'make it noon', '12:00'],
    ['18:30', 'make it 12 pm', '12:00'],
    ['18:30', 'make it 12 am', '00:00'],
  ])('%s + "%s" → %s', (current, text, expected) => {
    expect(changedTime(current, text)).toBe(expected);
  });

  it.each([
    ['06:30', 'make it 12'], // AM or PM? ask
    ['06:30', 'No, Saturday'], // no time named
    ['06:30', 'make it 7:75'],
    ['06:30', 'make it 13 pm'],
    ['bad', 'make it 7'],
  ])('%s + "%s" → null (ask, never guess)', (current, text) => {
    expect(changedTime(current, text)).toBeNull();
  });
});

describe('changedDate ("No, Saturday", CB4)', () => {
  const now = new Date(2026, 10, 12, 20); // Thursday, Nov 12 2026
  it.each([
    ['No, Saturday', '2026-11-14'],
    ['make it tomorrow', '2026-11-13'],
    ['no, today', '2026-11-12'],
    ['Saturday at 7', '2026-11-14'],
    ['move it to Monday', '2026-11-16'],
  ])('"%s" → %s', (text, expected) => {
    expect(changedDate(text, now)).toBe(expected);
  });
  it.each(['make it 7', 'no, Thursday', 'next Saturday', 'Friday or Saturday'])('"%s" → null (ask)', (text) => {
    expect(changedDate(text, now)).toBeNull();
  });
});
