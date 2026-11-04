// @vitest-environment happy-dom
import React,{act} from 'react';
import {AccessibilityInfo} from 'react-native';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Moment} from '@/types/moments';
const h=vi.hoisted(()=>({moments:[] as Moment[],params:{} as {momentId?:string},replace:vi.fn(),commit:vi.fn(),scope:true}));
vi.mock('expo-router',()=>({useRouter:()=>({back:vi.fn(),replace:h.replace}),useLocalSearchParams:()=>h.params}));
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
vi.mock('@/services/haptics',()=>({hapticImpact:vi.fn(),hapticSelection:vi.fn()}));
vi.mock('@/services/textToSpeech',()=>({stopSpeaking:vi.fn()}));
vi.mock('@/components/oneBreath/PreparationOrb',()=>({PreparationOrb:()=> <div aria-label="Orb"/>}));
vi.mock('@/hooks/useOneBreathVoice',()=>{const voice={available:false,busy:false,listening:false,error:'',start:async()=>{},stop:()=>{},cancel:()=>{}};return{useOneBreathVoice:()=>voice};});
vi.mock('@/store/useAppStore',()=>({useAppStore:()=>({state:{engineOutput:{command:{id:'canonical',action:'Start with water.'}}}})}));
vi.mock('@/services/scopedWriteQueue',()=>({captureScope:()=>({generation:1}),isScopeCurrent:()=>h.scope}));
vi.mock('@/services/userScope',()=>({getScopeState:()=>({status:'AUTHENTICATED'})}));
vi.mock('@/services/momentsStore',()=>({hydrateMoments:async()=>{},pruneMomentSafetyContext:vi.fn(),useMomentsStore:()=>({moments:h.moments,hydrated:true}),commitReviewedMoment:async(m:Moment,expected?:Moment)=>{h.commit(m,expected);h.moments=[m];return m;}}));
import {MomentPreparationScreen} from '../oneBreath/MomentPreparationScreen';
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root;let host:HTMLDivElement;
async function mount(){await act(async()=>root.render(<MomentPreparationScreen context="social"/>));}
function button(label:string){const found=Array.from(host.querySelectorAll('[role="button"],button')).find(e=>e.textContent===label);if(!found)throw Error(`No button: ${label}`);return found as HTMLElement;}
function click(label:string){act(()=>button(label).click());}
function field(label:string,value:string){const el=host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;const setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!;act(()=>{setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
const existing=():Moment=>({id:'real',source:'manual',title:'Team dinner',type:'personal',importance:'high',startAtIso:'2027-01-08T19:30:00Z',createdAtIso:'2026-11-04T12:00:00Z',preparation:{version:1,context:'social',transactionId:'review',reviewedAtIso:'2026-11-04T12:00:00Z',sealedAtIso:'2026-11-04T12:00:01Z',returnMethod:'ride',destination:'Hotel',emergencyNumber:'911',steps:[],policyVersion:'social-v0.4-phase-a'}});
beforeEach(()=>{vi.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(true);h.moments=[];h.params={};h.scope=true;h.commit.mockReset();h.replace.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks();});
describe('Social v0.4 shared Moment screen interactions',async()=>{
  it('typing reaches Mirror, Plan and Seal without saving or requiring voice',async()=>{await mount();field('Your moment','Dinner tomorrow at 7:30 PM');click('Review my moment');expect(host.textContent).toContain('HERE’S WHAT I HEARD');field('Date · YYYY-MM-DD','2027-01-08');click('Continue');expect(host.textContent).toContain('YOUR PLAN · NOT SEALED YET');expect(host.textContent).toContain('Start with water.');click('Review & seal');expect(host.textContent).toContain('Only what you approve');expect(h.commit).not.toHaveBeenCalled();});
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

});
