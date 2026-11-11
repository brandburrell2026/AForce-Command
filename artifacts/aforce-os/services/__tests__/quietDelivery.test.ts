import {beforeEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({quiet:false,fail:false,cancel:vi.fn(),pending:[{identifier:'prep',content:{data:{}}},{identifier:'help',content:{data:{kind:'safety'}}}]}));
vi.mock('react-native',()=>({Platform:{OS:'ios'}}));
vi.mock('../momentsStore',()=>({getMomentsState:()=>({moments:h.quiet?[{preparation:{lockedInAtIso:'now'}}]:[]})}));
vi.mock('expo-notifications',()=>({getAllScheduledNotificationsAsync:async()=>h.pending,cancelScheduledNotificationAsync:async(id:string)=>{h.cancel(id);if(h.fail)throw Error('native failure');}}));
import {lockInWithoutReminders,scheduleOutsideQuiet} from '../quietDelivery';
beforeEach(()=>{h.quiet=false;h.fail=false;h.cancel.mockReset();});
describe('Quiet native delivery barrier',()=>{
 it('cancels existing ordinary schedules before committing Quiet, preserving safety',async()=>{await lockInWithoutReminders(async()=>{expect(h.cancel).toHaveBeenCalledWith('prep');expect(h.cancel).not.toHaveBeenCalledWith('help');h.quiet=true;});const schedule=vi.fn();await scheduleOutsideQuiet(schedule);expect(schedule).not.toHaveBeenCalled();});
 it('does not claim Quiet when native cancellation fails',async()=>{h.fail=true;const commit=vi.fn();await expect(lockInWithoutReminders(commit)).rejects.toThrow();expect(commit).not.toHaveBeenCalled();});
 it('orders an in-flight schedule before cancellation and suppresses a queued late schedule',async()=>{let release!:()=>void;const blocked=new Promise<void>(r=>release=r);const first=scheduleOutsideQuiet(async()=>{await blocked;return 'first';});const lock=lockInWithoutReminders(async()=>{h.quiet=true;});const late=vi.fn();const last=scheduleOutsideQuiet(late);release();expect(await first).toBe('first');await lock;await last;expect(late).not.toHaveBeenCalled();});
 it('allows fresh scheduling after the member returns',async()=>{h.quiet=true;expect(await scheduleOutsideQuiet(async()=> 'hidden')).toBeUndefined();h.quiet=false;expect(await scheduleOutsideQuiet(async()=> 'fresh')).toBe('fresh');});
});
