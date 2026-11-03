import { describe, expect, it } from 'vitest';
import { suggestMomentDraft } from '../oneBreathDraft';
import { validateMomentDraft } from '../momentDraft';
const now = new Date(2026, 10, 2, 12);
describe('One Breath editable local suggestions', () => {
  it('extracts tomorrow and an explicit meridiem without creating a Moment', () => {
    expect(suggestMomentDraft('Dinner tomorrow at 7:30 PM', now)).toMatchObject({ title: 'Dinner tomorrow at 7:30 PM', date: '2026-11-03', time: '19:30', type: 'personal' });
    expect(suggestMomentDraft('Meeting Friday at 9 a.m.', now)).toMatchObject({ date: '2026-11-06', time: '09:00' });
    expect(suggestMomentDraft('Review day after tomorrow at 12 PM', now)).toMatchObject({ date: '2026-11-04', time: '12:00' });
    expect(suggestMomentDraft('Review 2026-11-05 at 12 AM', now)).toMatchObject({ date: '2026-11-05', time: '00:00' });
  });
  it('leaves missing or competing schedule details for the member', () => {
    for (const text of ['Dinner at 7:30', 'Dinner next Friday', 'Dinner Monday', 'Today or tomorrow', '2026-11-05 or 2026-11-06']) {
      expect(suggestMomentDraft(text, now).date).toBe('');
    }
    expect(suggestMomentDraft('Tomorrow at 7:30', now).time).toBe('');
    expect(suggestMomentDraft('Tomorrow at 8 AM or 9 AM', now).time).toBe('');
    expect(suggestMomentDraft('Flight tomorrow at 9 AM EDT', now)).toMatchObject({ date: '', time: '' });
  });
  it('passes proposed times through existing validation instead of silently correcting them', () => {
    const draft = suggestMomentDraft('Review 2026-02-30 at 9 AM', now);
    expect(validateMomentDraft(draft, now.getTime()).ok).toBe(false);
    expect(suggestMomentDraft('x'.repeat(500), now).title).toHaveLength(160);
  });
});
