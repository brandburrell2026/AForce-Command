import {describe,it,expect} from 'vitest';
import {suggestReservationDraft} from '../reservationDraft';
import {validateMomentDraft} from '../momentDraft';
const confirmation='Restaurant: Lilia\nDate: November 6, 2026\nTime: 7:30 PM';
describe('member-pasted reservation candidates',()=>{
 it('extracts labelled fields into the existing manual draft',()=>{expect(suggestReservationDraft(confirmation)).toEqual({title:'Lilia',date:'2026-11-06',time:'19:30',type:'personal',prepGoal:''});});
 it('ignores body, guests, links and confirmation numbers',()=>{const raw=confirmation+'\nGuest: Private Person\nConfirmation: SECRET123\nEmail: private@example.com\nMenu: wine and cocktails\nhttps://example.com/manage';const draft=suggestReservationDraft(raw);expect(draft).toEqual(suggestReservationDraft(confirmation));expect(JSON.stringify(draft)).not.toMatch(/SECRET123|Private Person|wine|example.com/);});
 it('requires labelled details instead of treating an email subject as a title',()=>{expect(suggestReservationDraft('Your dinner is tomorrow at 7 PM')).toMatchObject({title:'',date:'',time:''});});
 it('accepts explicit ISO dates and 24-hour local times',()=>{expect(suggestReservationDraft('Venue: Gallery\nDate: 2027-01-08\nTime: 14:05')).toMatchObject({title:'Gallery',date:'2027-01-08',time:'14:05'});});
 it('leaves competing fields blank and permits exact duplicate labels',()=>{expect(suggestReservationDraft(confirmation+'\nTime: 8 PM\nDate: 2026-11-07\nVenue: Another place')).toMatchObject({title:'',date:'',time:''});expect(suggestReservationDraft(confirmation+'\nRestaurant: Lilia\nTime: 7:30 PM')).toEqual(suggestReservationDraft(confirmation));});
 it.each(['EDT','Europe/London','UTC+01:00','cancelled','rescheduled'])('requires explicit timing review for %s',token=>{expect(suggestReservationDraft(confirmation+'\n'+token)).toMatchObject({date:'',time:''});});
 it('does not guess a year, numeric-date convention or missing meridiem',()=>{expect(suggestReservationDraft('Restaurant: Lilia\nDate: 11/06/26\nTime: 7:30')).toMatchObject({date:'',time:''});expect(suggestReservationDraft('Date: November 6\nTime: 7 PM').date).toBe('');});
 it('leaves invalid and past dates to shared validation',()=>{const now=new Date(2026,10,4).getTime();for(const date of ['2026-02-30','2026-01-01'])expect(validateMomentDraft(suggestReservationDraft(`Event: Dinner\nDate: ${date}\nTime: 19:30`),now).ok).toBe(false);});
 it('bounds the input and never truncates an overlong label into a saved title',()=>{expect(suggestReservationDraft(confirmation+'x'.repeat(4000))).toMatchObject({title:'',date:'',time:''});expect(suggestReservationDraft('Event: '+'x'.repeat(161)).title).toBe('');});
});
