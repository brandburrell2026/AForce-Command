/**
 * Eligibility for "Prepare for this" and for the in-app proposal (widened
 * 2026-11-21: work, training and performance join travel and social-word
 * personal events). Every existing safety refusal stays.
 */
import { describe, expect, it } from 'vitest';
import {
  calendarPrepareSuggestions,
  isRealPreparationMoment,
  isSampleCalendarMoment,
  preparationProposalCandidate,
} from '../momentPreparation';
import { EMPTY_MOMENT_PROPOSAL_PREFS } from '../momentProposalPreferences';
import type { Moment } from '../../types/moments';

const now = new Date(2026, 10, 21, 12).getTime();
const iso = new Date(now).toISOString();
const cal = (over: Partial<Moment> & { hours?: number } = {}): Moment => {
  const { hours = 3, ...rest } = over;
  return {
    id: 'cal-e1@1',
    source: 'calendar',
    title: 'Investor call',
    type: 'work',
    importance: 'high',
    startAtIso: new Date(now + hours * 3_600_000).toISOString(),
    calendarEventId: 'e1',
    createdAtIso: iso,
    ...rest,
  };
};

describe('which calendar events can be offered for preparation', () => {
  it.each([
    ['work', 'Investor call'],
    ['training', 'Track session'],
    ['performance', 'Race day'],
    ['travel', 'Flight to Denver'],
  ] as const)('offers a %s event', (type, title) => {
    expect(calendarPrepareSuggestions([cal({ type, title })], iso)).toHaveLength(1);
    expect(preparationProposalCandidate([cal({ type, title })], EMPTY_MOMENT_PROPOSAL_PREFS, iso)?.type).toBe(type);
  });

  it('offers personal events only with an explicit social word', () => {
    expect(calendarPrepareSuggestions([cal({ type: 'personal', title: 'Team dinner' })], iso)).toHaveLength(1);
    expect(calendarPrepareSuggestions([cal({ type: 'personal', title: 'Personal time' })], iso)).toHaveLength(0);
  });

  it('does not offer recovery events (outside the approved set)', () => {
    expect(calendarPrepareSuggestions([cal({ type: 'recovery', title: 'Sauna' })], iso)).toHaveLength(0);
  });

  it.each([
    ['masked', { masked: true, title: '' }],
    ['untitled', { title: '   ' }],
    ['tentative', { title: 'Maybe investor call' }],
    ['cancelled', { title: 'Cancelled: investor call' }],
    ['declined', { title: 'Declined investor call' }],
    ['already prepared', { preparedAtIso: iso }],
    ['already planned', { preparation: { sealedAtIso: iso } as Moment['preparation'] }],
    ['low importance', { importance: 'low' as const }],
    ['too soon to prepare', { hours: 0.2 }],
    ['already started', { hours: -1 }],
  ])('refuses a %s event', (_name, over) => {
    expect(calendarPrepareSuggestions([cal(over)], iso)).toHaveLength(0);
  });

  it('refuses an event whose title the Decision Guard does not approve', () => {
    expect(calendarPrepareSuggestions([cal({ title: 'Bring an AFORCE stick to the call' })], iso)).toHaveLength(0);
  });

  it('lists soonest first and ignores manual Moments', () => {
    const later = cal({ id: 'cal-e2@2', calendarEventId: 'e2', hours: 9, title: 'Board meeting' });
    const sooner = cal({ hours: 2 });
    const manual = cal({ id: 'm', source: 'manual', hours: 1 });
    expect(calendarPrepareSuggestions([later, manual, sooner], iso).map((s) => s.moment.id)).toEqual([
      'cal-e1@1',
      'cal-e2@2',
    ]);
  });

  it('a work event is proposed by the in-app proposal too, but not a low-importance or masked one', () => {
    expect(preparationProposalCandidate([cal({ importance: 'low' })], EMPTY_MOMENT_PROPOSAL_PREFS, iso)).toBeNull();
    expect(preparationProposalCandidate([cal({ masked: true })], EMPTY_MOMENT_PROPOSAL_PREFS, iso)).toBeNull();
    expect(preparationProposalCandidate([cal({ hours: 30 })], EMPTY_MOMENT_PROPOSAL_PREFS, iso)).toBeNull();
  });
});

describe('sample events', () => {
  const sample = cal({ id: 'demo-cal-2', calendarEventId: 'demo-cal-evt-2', title: 'Investor Call' });
  it('are never a real preparation input', () => {
    expect(isRealPreparationMoment(sample)).toBe(false);
    expect(isSampleCalendarMoment(sample)).toBe(true);
    expect(isSampleCalendarMoment(cal())).toBe(false);
  });
  it('are not offered unless a sample build asks for them, and never by the proposal', () => {
    expect(calendarPrepareSuggestions([sample], iso)).toHaveLength(0);
    expect(preparationProposalCandidate([sample], EMPTY_MOMENT_PROPOSAL_PREFS, iso)).toBeNull();
  });
  it('are offered, marked as samples, when a sample build asks for them', () => {
    const out = calendarPrepareSuggestions([sample, cal({ hours: 5 })], iso, { includeSamples: true });
    expect(out.find((s) => s.moment.id === 'demo-cal-2')?.sample).toBe(true);
    expect(out.find((s) => s.moment.id === 'cal-e1@1')?.sample).toBe(false);
  });
  it('a sample is still judged by the safety rules (masked sample is not offered)', () => {
    expect(calendarPrepareSuggestions([{ ...sample, masked: true }], iso, { includeSamples: true })).toHaveLength(0);
  });
});
