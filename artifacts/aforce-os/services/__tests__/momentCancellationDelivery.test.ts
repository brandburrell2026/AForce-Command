import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import type {Moment} from '@/types/moments';
const h=vi.hoisted(()=>({moments:[] as Moment[],schedule:vi.fn(),cancel:vi.fn()}));
vi.mock('react-native',()=>({Platform:{OS:'ios'}}));
vi.mock('../momentsStore',()=>({getMomentsState:()=>({moments:h.moments,hydrated:true}),hydrateMoments:async()=>{}}));
vi.mock('../scopedStorage',()=>({scopedStorage:{getItem:async()=>null,setItem:async()=>{}}}));
vi.mock('expo-notifications',()=>({getAllScheduledNotificationsAsync:async()=>[],cancelScheduledNotificationAsync:h.cancel,scheduleNotificationAsync:h.schedule,SchedulableTriggerInputTypes:{TIME_INTERVAL:'timeInterval'}}));
import {planMomentNotifications,DEFAULT_MOMENT_NOTIFY_PREFS,syncMomentNotifications} from '../momentNotifications';
const now=new Date(2027,0,8,12).toISOString();
const m:Moment={id:'one',source:'manual',title:'Team meeting',type:'work',importance:'high',startAtIso:new Date(2027,0,8,15).toISOString(),createdAtIso:now};
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date(now));h.moments=[m];h.schedule.mockReset().mockResolvedValue('aforce.moment.one');h.cancel.mockReset().mockResolvedValue(undefined);});
afterEach(()=>vi.useRealTimers());
const cancel=()=>{h.moments=[{...m,preparation:{cancelledAtIso:now} as Moment['preparation']}];};
describe('cancelled Moment native notification races',()=>{
 it('drops a stale plan cancelled before scheduling drains',async()=>{const plan=planMomentNotifications([m],DEFAULT_MOMENT_NOTIFY_PREFS,now);cancel();await syncMomentNotifications(plan,()=> 'Team meeting');expect(h.schedule).not.toHaveBeenCalled();});
 it('cancels a native acknowledgement arriving after cancellation',async()=>{const plan=planMomentNotifications([m],DEFAULT_MOMENT_NOTIFY_PREFS,now);let release!:(id:string)=>void;h.schedule.mockImplementationOnce(()=>new Promise<string>(resolve=>{release=resolve;}));const syncing=syncMomentNotifications(plan,()=> 'Team meeting');await vi.waitFor(()=>expect(h.schedule).toHaveBeenCalledTimes(1));cancel();release('aforce.moment.one');await syncing;expect(h.cancel).toHaveBeenCalledWith('aforce.moment.one');});
 it('does not replay a stale preparation schedule in a burst',async()=>{const plan=planMomentNotifications([m],DEFAULT_MOMENT_NOTIFY_PREFS,now);vi.setSystemTime(new Date(2027,0,8,16));await syncMomentNotifications(plan,()=> 'Team meeting');expect(h.schedule).not.toHaveBeenCalled();});
});
