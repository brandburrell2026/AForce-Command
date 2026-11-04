vi.mock('@/components/oneBreath/MomentProposalPrefsControl',()=>({MomentProposalPrefsControl:()=>null}));
// @vitest-environment happy-dom
import React,{act} from 'react';
import {AccessibilityInfo} from 'react-native';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Moment} from '@/types/moments';
const h=vi.hoisted(()=>({command:{id:'canonical',action:'Start with water.'},push:vi.fn(),sharedReads:vi.fn(),calendar:[] as Moment[],moments:[] as Moment[],params:{} as {momentId?:string;proposal?:string},back:vi.fn(),replace:vi.fn(),commit:vi.fn(),scope:true,preference:vi.fn()}));
vi.mock('expo-router',()=>({useRouter:()=>({push:h.push,back:h.back,replace:h.replace}),useLocalSearchParams:()=>h.params}));
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
vi.mock('@/services/haptics',()=>({hapticImpact:vi.fn(),hapticSelection:vi.fn()}));
vi.mock('@/services/textToSpeech',()=>({stopSpeaking:vi.fn()}));
vi.mock('@/components/oneBreath/PreparationOrb',()=>({PreparationOrb:()=> <div aria-label="Orb"/>}));
vi.mock('@/hooks/useOneBreathVoice',()=>{const voice={available:false,busy:false,listening:false,error:'',start:async()=>{},stop:()=>{},cancel:()=>{}};return{useOneBreathVoice:()=>voice};});
vi.mock('@/components/moments/useMomentsData',async()=>{const {mergeReviewedCalendarMoments}=await import('@/services/momentRecommendation');return{useMomentsData:()=>{h.sharedReads();return{surfaced:mergeReviewedCalendarMoments(h.moments,h.calendar),nowIso:new Date().toISOString()};}};});
vi.mock('@/services/momentNotifications',()=>({getMomentProposalPreferences:async()=>({records:[],neverTypes:[]}),recordMomentProposal:async(...args:unknown[])=>{return h.preference(...args);}}));
vi.mock('@/store/useAppStore',()=>({useAppStore:()=>({state:{engineOutput:{command:h.command}}})}));
vi.mock('@/services/scopedWriteQueue',()=>({captureScope:()=>({generation:1}),isScopeCurrent:()=>h.scope}));
vi.mock('@/services/userScope',()=>({getScopeState:()=>({status:'AUTHENTICATED'})}));
vi.mock('@/services/momentsStore',()=>({getMomentsState:()=>({moments:h.moments,hydrated:true}),hydrateMoments:async()=>{},pruneMomentSafetyContext:vi.fn(),useMomentsStore:()=>({moments:h.moments,hydrated:true}),commitReviewedMoment:async(m:Moment,expected?:Moment,valid?:()=>boolean)=>{if(valid&&!valid())throw Error('Review changed');h.commit(m,expected);h.moments=[...h.moments.filter(old=>old.id!==m.id),m];return m;}}));
import {MomentPreparationScreen} from '../oneBreath/MomentPreparationScreen';
import {SocialProtocolEntry} from '../oneBreath/SocialProtocolEntry';
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root;let host:HTMLDivElement;
async function mount(){await act(async()=>root.render(<MomentPreparationScreen context="social"/>));}
function button(label:string){const found=Array.from(host.querySelectorAll('[role="button"],button')).find(e=>e.textContent===label);if(!found)throw Error(`No button: ${label}`);return found as HTMLElement;}
function click(label:string){act(()=>button(label).click());}
function field(label:string,value:string){const el=host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;const setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!;act(()=>{setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
const existing=():Moment=>({id:'real',source:'manual',title:'Team dinner',type:'personal',importance:'high',startAtIso:'2027-01-08T19:30:00Z',createdAtIso:'2026-11-04T12:00:00Z',preparation:{version:1,context:'social',transactionId:'review',reviewedAtIso:'2026-11-04T12:00:00Z',sealedAtIso:'2026-11-04T12:00:01Z',returnMethod:'ride',destination:'Hotel',emergencyNumber:'911',steps:[],policyVersion:'social-v0.4-phase-a'}});
beforeEach(()=>{vi.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(true);h.command={id:'canonical',action:'Start with water.'};h.push.mockReset();h.sharedReads.mockReset();h.calendar=[];h.moments=[];h.params={};h.scope=true;h.commit.mockReset();h.preference.mockReset();h.back.mockReset();h.replace.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();});
describe('Social v0.4 shared Moment screen interactions',()=>{
  it('typing reaches Mirror, Plan and Seal without saving or requiring voice',async()=>{await mount();field('Your moment','Dinner tomorrow at 7:30 PM');click('Review my moment');expect(host.textContent).toContain('HERE’S WHAT I HEARD');field('Date · YYYY-MM-DD','2027-01-08');click('Continue');expect(host.textContent).toContain('YOUR PLAN · NOT SEALED YET');expect(host.textContent).not.toContain('Start with water.');expect(host.textContent).toContain('Check your current guidance');click('Review & seal');expect(host.textContent).toContain('Only what you approve');expect(h.commit).not.toHaveBeenCalled();});
  it('puts driving risk ahead of Mirror and offers no driving approval',async()=>{await mount();field('Your moment','I had tequila and I am driving');click('Review my moment');expect(host.textContent).toContain('AFORCE can’t assess');expect(button('Get a ride')).toBeTruthy();expect(button('Contact someone')).toBeTruthy();expect(button('Stay here')).toBeTruthy();expect(h.commit).not.toHaveBeenCalled();});
  it('resumes a sealed Moment in Lock In and persists Quiet through the shared commit',async()=>{h.moments=[existing()];await mount();expect(host.textContent).toContain('Go perform.');await act(async()=>button('Lock In').click());expect(host.textContent).toContain('Phone down.');expect(h.moments[0]!.preparation!.lockedInAtIso).toBeTruthy();expect(h.moments).toHaveLength(1);click('Heading back?');expect(host.textContent).toContain('Made it back.');await act(async()=>button('Made it back ✓').click());expect(host.textContent).toContain('Did it go the way you wanted?');expect(h.moments[0]!.preparation!.returnedAtIso).toBeTruthy();});
  it('notices only an actual selected Moment',async()=>{const m=existing();delete m.preparation;h.moments=[m];h.params={momentId:m.id};await mount();expect(host.textContent).toContain('Team dinner?');expect(button('Prepare')).toBeTruthy();expect(h.commit).not.toHaveBeenCalled();});
  it('requires an explicit happening-now choice for an ongoing Moment',async()=>{await mount();field('Your moment',"Dinner with my team");click('Review my moment');click('Continue');expect(host.textContent).toContain('Choose a date');click('This is happening now');expect(host.textContent).toContain('Happening now');click('Continue');expect(host.textContent).toContain('YOUR PLAN · NOT SEALED YET');expect(h.commit).not.toHaveBeenCalled();});
  it('uses persisted safety context after reopening',async()=>{const m=existing();m.preparation!.lockedInAtIso='2026-11-04T12:00:02Z';const now=Date.now();m.safetyContext={mentionedAtIso:new Date(now-1000).toISOString(),expiresAtIso:new Date(now+3600000).toISOString(),region:'test',policyVersion:'test'};h.moments=[m];await mount();click('Plans changed?');field('What changed?','I am still driving');expect(host.textContent).toContain('AFORCE can’t assess');expect(button('Get a ride')).toBeTruthy();});

  it('cancels an early release and commits only after a completed hold',async()=>{
    vi.useFakeTimers();await mount();field('Your moment','Dinner tomorrow at 7:30 PM');click('Review my moment');field('Date · YYYY-MM-DD','2027-01-08');click('Continue');click('Review & seal');
    const ring=host.querySelector('[aria-label="Hold to seal"]') as HTMLElement;
    act(()=>ring.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
    act(()=>vi.advanceTimersByTime(700));
    act(()=>document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0})));
    act(()=>vi.advanceTimersByTime(1500));expect(h.commit).not.toHaveBeenCalled();
    act(()=>ring.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
    await act(async()=>{vi.advanceTimersByTime(1400);});expect(h.commit).toHaveBeenCalledTimes(1);expect(host.textContent).toContain('Go perform.');
  });

  it('rejects changed command copy under the same ID during a Seal hold',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date(2027,0,8,19,15));await mount();field('Your moment','Dinner today at 7:30 PM');click('Review my moment');field('Date · YYYY-MM-DD','2027-01-08');click('Continue');click('Review & seal');
    const ring=host.querySelector('[aria-label="Hold to seal"]') as HTMLElement;
    act(()=>ring.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
    act(()=>vi.advanceTimersByTime(600));h.command={id:'canonical',action:'Take a break.'};await mount();
    await act(async()=>vi.advanceTimersByTime(800));expect(h.commit).not.toHaveBeenCalled();expect(host.textContent).toContain('upcoming context changed');expect(host.querySelector('[aria-label="Moment"]')).toBeTruthy();click('Continue');click('Review & seal');const retry=host.querySelector('[aria-label="Hold to seal"]') as HTMLElement;act(()=>retry.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));await act(async()=>vi.advanceTimersByTime(1400));expect(h.commit).toHaveBeenCalledTimes(1);expect(host.textContent).toContain('Go perform.');
  });
  it('requires re-review when the next event changes during the hold',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2027-01-08T17:00:00Z'));h.moments=[{id:'next',source:'manual',title:'Team meeting',type:'work',importance:'high',startAtIso:'2027-01-09T10:00:00Z',createdAtIso:'2027-01-08T12:00:00Z'}];
    await mount();field('Your moment','Dinner today at 7:30 PM');click('Review my moment');click('Continue');click('Review & seal');
    const ring=host.querySelector('[aria-label="Hold to seal"]') as HTMLElement;act(()=>ring.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));
    h.moments=[{...h.moments[0]!,startAtIso:'2027-01-09T11:00:00Z'}];await mount();await act(async()=>vi.advanceTimersByTime(1400));expect(h.commit).not.toHaveBeenCalled();expect(host.textContent).toContain('Review the plan again');
  });
  it('keeps a calendar candidate read-only until Seal, then saves only reviewed manual fields',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date(2027,0,8,17));const m=existing();delete m.preparation;m.source='calendar';m.id='calendar-source';m.calendarEventId='private-calendar-id';m.startAtIso=new Date(2027,0,8,19,30).toISOString();h.calendar=[m];h.params={momentId:m.id,proposal:'1'};
    await mount();expect(host.textContent).toContain('Team dinner?');expect(h.moments).toHaveLength(0);await act(async()=>button('Prepare').click());click('Continue');expect(h.commit).not.toHaveBeenCalled();click('Review & seal');const ring=host.querySelector('[aria-label="Hold to seal"]') as HTMLElement;act(()=>ring.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));await act(async()=>vi.advanceTimersByTime(1400));expect(h.commit).toHaveBeenCalledTimes(1);const saved=h.commit.mock.calls[0]![0] as Moment;expect(saved.source).toBe('manual');expect(saved.id).not.toBe(m.id);expect(saved.calendarEventId).toBeUndefined();expect(saved.calendarSource).toEqual({eventId:m.calendarEventId,startAtIso:m.startAtIso});expect(saved.title).toBe(m.title);expect(h.calendar).toEqual([m]);h.calendar=[];await mount();expect(host.textContent).toContain('Go perform.');
  });
  it('rejects a calendar source changed during the hold',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date(2027,0,8,17));const m=existing();delete m.preparation;m.source='calendar';m.startAtIso=new Date(2027,0,8,19,30).toISOString();h.calendar=[m];h.params={momentId:m.id};await mount();await act(async()=>button('Prepare').click());click('Continue');click('Review & seal');const ring=host.querySelector('[aria-label="Hold to seal"]') as HTMLElement;act(()=>ring.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));h.calendar=[{...m,title:'Changed dinner'}];await mount();await act(async()=>vi.advanceTimersByTime(1400));expect(h.commit).not.toHaveBeenCalled();expect(host.textContent).toContain('Review the plan again');
  });
  it('never converts synthetic calendar fixtures into saved history',async()=>{const m=existing();delete m.preparation;m.source='calendar';m.id='demo-cal-event';m.calendarEventId='demo-cal-source';h.calendar=[m];h.params={momentId:m.id};await mount();expect(host.textContent).not.toContain('Team dinner?');expect(host.querySelector('[aria-label="Your moment"]')).toBeTruthy();expect(h.commit).not.toHaveBeenCalled();});
  it('clears source words when calendar visibility is revoked',async()=>{const m=existing();delete m.preparation;m.source='calendar';h.calendar=[m];h.params={momentId:m.id};await mount();expect(host.textContent).toContain('Team dinner?');h.calendar=[];await mount();expect(host.textContent).toContain('no longer available');expect(host.textContent).not.toContain('Team dinner');expect((host.querySelector('[aria-label="Your moment"]') as HTMLTextAreaElement).value).toBe('');expect(h.commit).not.toHaveBeenCalled();});
  it('remembers a proposal decline without writing a Moment',async()=>{const m=existing();delete m.preparation;h.moments=[m];h.params={momentId:m.id,proposal:'1'};await mount();expect(h.preference).toHaveBeenCalledWith(m,'shown');await act(async()=>button('Not this one').click());expect(h.preference).toHaveBeenCalledWith(m,'declined',false);expect(h.commit).not.toHaveBeenCalled();});
  it('stays on Noticed when saving a decline fails, then permits retry',async()=>{const m=existing();delete m.preparation;h.moments=[m];h.params={momentId:m.id,proposal:'1'};await mount();h.preference.mockRejectedValueOnce(new Error('disk unavailable'));await act(async()=>button('Not this one').click());expect(host.textContent).toContain('Could not save that preference');expect(h.back).not.toHaveBeenCalled();expect(h.commit).not.toHaveBeenCalled();await act(async()=>button('Not this one').click());expect(h.back).toHaveBeenCalledTimes(1);});
  it('offers an accessible category opt-out as well as long press',async()=>{const m=existing();delete m.preparation;h.moments=[m];h.params={momentId:m.id,proposal:'1'};await mount();click('Suggestion options');expect(host.textContent).toContain('personal Moments');await act(async()=>button('Never for things like this').click());expect(h.preference).toHaveBeenCalledWith(m,'declined',true);});
  it('does not mistake an earlier event for what follows the reviewed Moment',async()=>{const m=existing();delete m.preparation;m.startAtIso='2027-01-08T19:30:00Z';const earlier={...m,id:'earlier',title:'Earlier meeting',startAtIso:'2027-01-08T18:00:00Z'};const later={...m,id:'later',title:'Next morning meeting',startAtIso:'2027-01-09T15:00:00Z'};h.moments=[earlier,m,later];h.params={momentId:m.id};vi.useFakeTimers();vi.setSystemTime(new Date('2027-01-08T17:00:00Z'));await mount();await act(async()=>button('Prepare').click());expect(host.textContent).toContain('Next morning meeting');expect(host.textContent).not.toContain('Earlier meeting');});

});

describe('Social entry uses the existing calendar consent boundary',()=>{
 it('does not mount shared data readers with the internal gate off',async()=>{vi.stubEnv('EXPO_PUBLIC_SOCIAL_V04','false');await act(async()=>root.render(<SocialProtocolEntry/>));expect(h.sharedReads).not.toHaveBeenCalled();expect(host.textContent).toBe('');});
 it('routes an available calendar candidate to review without writing a Moment',async()=>{vi.stubEnv('EXPO_PUBLIC_SOCIAL_V04','true');vi.stubEnv('EXPO_PUBLIC_INTERNAL_TESTFLIGHT','true');vi.useFakeTimers();vi.setSystemTime(new Date(2027,0,8,12));const m=existing();delete m.preparation;m.id='consented-calendar';m.source='calendar';m.startAtIso=new Date(2027,0,8,14).toISOString();h.calendar=[m];await act(async()=>root.render(<SocialProtocolEntry/>));await act(async()=>(host.querySelector('[role="button"]') as HTMLElement).click());expect(h.push).toHaveBeenCalledWith({pathname:'/social',params:{momentId:m.id,proposal:'1'}});expect(h.commit).not.toHaveBeenCalled();expect(h.moments).toHaveLength(0);});
});
