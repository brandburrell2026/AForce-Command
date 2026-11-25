vi.mock('@clerk/expo',()=>({useAuth:()=>({isLoaded:true,isSignedIn:true,userId:'member'})}));
vi.mock('@/hooks/useMomentsFirstExperience',()=>({useMomentsFirstExperience:()=>true}));
vi.mock('@/components/oneBreath/OneBreathScreen',()=>({OneBreathScreen:()=>null}));
vi.mock('@/components/oneBreath/ConfirmMomentScreen',()=>({ConfirmMomentScreen:()=>null}));
vi.mock('@/components/oneBreath/MomentProposalPrefsControl',()=>({MomentProposalPrefsControl:()=>null}));
// @vitest-environment happy-dom
import React,{act} from 'react';
import {AccessibilityInfo,AppState,type AppStateStatus} from 'react-native';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Moment} from '@/types/moments';
const h=vi.hoisted(()=>({command:{id:'canonical',action:'Start with water.'},push:vi.fn(),sharedReads:vi.fn(),calendar:[] as Moment[],moments:[] as Moment[],params:{} as {momentId?:string;proposal?:string},back:vi.fn(),replace:vi.fn(),commit:vi.fn(),scope:true,preference:vi.fn(),beforeValidate:null as null|(()=>void),voiceAvailable:false,voiceBusy:false,voiceCancel:vi.fn()}));
vi.mock('expo-router',()=>({useRouter:()=>({push:h.push,back:h.back,replace:h.replace}),useLocalSearchParams:()=>h.params}));
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
vi.mock('@/services/haptics',()=>({hapticImpact:vi.fn(),hapticSelection:vi.fn()}));
vi.mock('@/services/textToSpeech',()=>({stopSpeaking:vi.fn(),speak:vi.fn()}));
vi.mock('@/components/oneBreath/PreparationOrb',()=>({PreparationOrb:({day,moon}:{day:boolean;moon?:boolean})=> <div aria-label={day?'Sun orb':moon?'Moon orb':'Orb'}/>}));
vi.mock('@/hooks/useOneBreathVoice',()=>{const voice={get available(){return h.voiceAvailable;},get busy(){return h.voiceBusy;},listening:false,error:'',start:async()=>{},stop:()=>{},cancel:()=>{h.voiceCancel();h.voiceBusy=false;}};return{useOneBreathVoice:()=>voice};});
vi.mock('@/components/moments/useMomentsData',async()=>{const {mergeReviewedCalendarMoments}=await import('@/services/momentRecommendation');return{useMomentsData:()=>{h.sharedReads();return{surfaced:mergeReviewedCalendarMoments(h.moments,h.calendar),nowIso:new Date().toISOString()};}};});
vi.mock('@/components/Icon',()=>({Icon:()=>null}));
vi.mock('@/components/oneBreath/SealRing',()=>({SealRing:({children}:{children?:React.ReactNode})=>children??null}));
vi.mock('@/services/momentNotifications',()=>({getMomentProposalPreferences:async()=>({records:[],neverTypes:[]}),recordMomentProposal:async(...args:unknown[])=>{return h.preference(...args);}}));
vi.mock('@/store/useAppStore',()=>({useAppStore:()=>({state:{engineOutput:{command:h.command}}})}));
vi.mock('@/services/scopedWriteQueue',()=>({captureScope:()=>({generation:1}),isScopeCurrent:()=>h.scope}));
vi.mock('@/services/userScope',()=>{const snapshot={status:'AUTHENTICATED',userId:'member'};return{getScopeState:()=>snapshot,subscribeScopeState:()=>()=>{},subscribeUserScope:()=>()=>{}};});
vi.mock('@/services/scopedStorage',()=>({scopedStorage:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}}}));
vi.mock('@/services/momentsStore',()=>({getMomentsState:()=>({moments:h.moments,hydrated:true}),hydrateMoments:async()=>{},pruneMomentSafetyContext:vi.fn(),useMomentsStore:()=>({moments:h.moments,hydrated:true}),commitReviewedMoment:async(m:Moment,expected?:Moment,valid?:()=>boolean)=>{h.beforeValidate?.();if(valid&&!valid())throw Error('Review changed');await h.commit(m,expected);h.moments=[...h.moments.filter(old=>old.id!==m.id),m];return m;}}));
vi.mock('@/services/demoMode',()=>({DEMO_MODE:true,CAPTURE_MODE:false}));
import {MomentPreparationScreen} from '../oneBreath/MomentPreparationScreen';
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root;let host:HTMLDivElement;
async function mount(){await act(async()=>root.render(<MomentPreparationScreen context="one_breath"/>));}
function button(label:string){const found=Array.from(host.querySelectorAll('[role="button"],button')).find(e=>e.textContent===label||e.getAttribute('aria-label')===label);if(!found)throw Error(`No button: ${label}`);return found as HTMLElement;}
const sample=():Moment=>({id:'demo-cal-2',source:'calendar',title:'Investor Call',type:'work',importance:'high',startAtIso:new Date(2027,0,8,14).toISOString(),calendarEventId:'demo-cal-evt-2',createdAtIso:'2027-01-08T08:00:00Z'});
beforeEach(()=>{
  vi.spyOn(AccessibilityInfo,'isReduceMotionEnabled').mockResolvedValue(true);
  h.command={id:'canonical',action:'Start with water.'};h.push.mockReset();h.calendar=[];h.moments=[];h.params={};h.scope=true;h.commit.mockReset();h.preference.mockReset();
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks();});
describe('sample calendar event in a DEMO/CAPTURE build: review, then stop before saving',()=>{
  it('opens on the noticed screen with its details and says it cannot be sealed',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date(2027,0,8,9));
    const m=sample();h.calendar=[m];h.params={momentId:m.id,proposal:'1'};await mount();
    expect(host.textContent).toContain('Investor Call?');
    expect(host.textContent).toContain('This is a sample event. It cannot be sealed.');
    expect(h.preference).not.toHaveBeenCalled();
  });
  it('Prepare shows the review with the sample filled in, keeps Continue off, and saves nothing',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date(2027,0,8,9));
    const m=sample();h.calendar=[m];h.params={momentId:m.id,proposal:'1'};await mount();
    await act(async()=>button('Prepare').click());
    expect(host.textContent).toContain('WHAT I HEARD');
    expect((host.querySelector('[aria-label="Moment"]') as HTMLInputElement).value).toBe('Investor Call');
    expect(host.textContent).toContain('This is a sample event. It cannot be sealed.');
    const cont=button('Continue');
    expect(cont.getAttribute('aria-disabled')).toBe('true');
    act(()=>cont.click());
    expect(host.textContent).not.toContain('YOUR PLAN');
    expect(h.commit).not.toHaveBeenCalled();expect(h.preference).not.toHaveBeenCalled();
  });
});
