import {describe,expect,it} from 'vitest';
import {reviewedPreparationSteps,isDayMoment,rideHandoffUrl} from '../momentPreparation';
import {evaluateMomentSafety} from '@/utils/intelligence/decisionGuard';
import type {Moment} from '@/types/moments';
const moment:Moment={id:'real',source:'manual',title:'Pool party',type:'personal',importance:'high',createdAtIso:'2026-11-04T08:00:00Z',startAtIso:new Date(2026,10,4,14).toISOString()};
describe('Social views reuse existing preparation authority',()=>{
  it('mirrors an eligible command exactly, with no drink count',()=>{const action='Start with water.';const steps=reviewedPreparationSteps(moment,{id:'canonical',action},moment.createdAtIso);expect(steps).toContainEqual(expect.objectContaining({commandId:'canonical',action}));expect(steps.length).toBeLessThanOrEqual(4);});
  it('never uses Social context to steer a product',()=>{const steps=reviewedPreparationSteps(moment,{id:'product',action:'20 oz water + 2 sticks.'},moment.createdAtIso);expect(steps.every(s=>!s.commandId)).toBe(true);});
  it('selects the sun from the actual Moment time',()=>{expect(isDayMoment(moment)).toBe(true);expect(isDayMoment({startAtIso:new Date(2026,10,4,20).toISOString()})).toBe(false);});
  it('handoffs include no health, alcohol, contact, or location data',()=>{expect(rideHandoffUrl('uber')).toBe('https://m.uber.com/');expect(rideHandoffUrl('lyft')).toBe('https://ride.lyft.com/');});
});
describe('universal Plans Changed safety gate',()=>{
  it.each(['I had tequila and I am driving','I am drinking wine and driving home','I am too tired to drive'])('does not approve driving: %s',words=>{expect(evaluateMomentSafety(words)).toBe('driving');});
  it('keeps alcohol-only context out of the coaching UI',()=>{expect(evaluateMomentSafety('I had a beer at dinner')).toBeNull();});
  it('remembers an earlier disclosure during the conversation',()=>{expect(evaluateMomentSafety('I am driving',true)).toBe('driving');});
  it('prioritizes severe symptoms',()=>{expect(evaluateMomentSafety("My friend is unconscious and I am driving")).toBe('emergency');});
  it('offers a break from water activities',()=>{expect(evaluateMomentSafety('I had wine and want to swim')).toBe('water');});
});
