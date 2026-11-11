import { describe, it, expect } from 'vitest';
import { createConfirmedMoment, validateMomentDraft, type MomentDraft } from '../momentDraft';
const draft: MomentDraft = { title: 'Team dinner', date: '2026-10-30', time: '19:30', type: 'personal', prepGoal: 'Arrive relaxed' };
const now = new Date(2026, 9, 28).getTime();
describe('explicit Moment confirmation', () => {
  it('rejects missing/ambiguous inputs instead of inventing a schedule', () => {
    for (const change of [{ title: ' ' }, { date: '' }, { time: '' }, { time: '7:30' }, { date: '2026-02-30' }, { time: '25:00' }, { date: '2026-10-27' }]) {
      expect(validateMomentDraft({ ...draft, ...change }, now).ok).toBe(false);
    }
  });
  it('uses the device local wall time and saves only explicit Moment fields', () => {
    const result = validateMomentDraft(draft, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const at = new Date(result.startAtIso);
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2026, 9, 30, 19, 30]);
    const moment = createConfirmedMoment(draft, result.startAtIso);
    expect(moment).toMatchObject({ source: 'manual', title: draft.title, type: 'personal', startAtIso: result.startAtIso, prepGoal: draft.prepGoal });
    expect(moment).not.toHaveProperty('preparedAtIso');
  });
  it('refuses nonexistent and repeated daylight-saving times', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(validateMomentDraft({ ...draft, date: '2027-03-14', time: '02:30' }, now).ok).toBe(false);
      expect(validateMomentDraft({ ...draft, date: '2026-11-01', time: '01:30' }, now).ok).toBe(false);
    } finally { process.env.TZ = previous; }
  });
});
