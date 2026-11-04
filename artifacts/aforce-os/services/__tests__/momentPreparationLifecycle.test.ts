import {describe,it,expect} from 'vitest';
import type {Moment,MomentPreparation} from '@/types/moments';
import {preparationClosed} from '../momentPreparationLifecycle';
import {surfaceableMoments,nextMoment} from '../momentRecommendation';
import {preparationProposalCandidate} from '../momentPreparation';
import {activeAlcoholContext} from '../momentSafetyContext';
import {planMomentNotifications,DEFAULT_MOMENT_NOTIFY_PREFS} from '../momentNotifications';
const now=new Date(2027,0,8,17).toISOString();
const cancelled:Moment={id:'cancelled',source:'manual',title:'Dinner',type:'personal',importance:'high',startAtIso:new Date(2027,0,8,19,30).toISOString(),endAtIso:new Date(2027,0,8,22).toISOString(),createdAtIso:now,preparation:{version:1,context:'social',transactionId:'cancel',reviewedAtIso:now,sealedAtIso:now,lockedInAtIso:now,cancelledAtIso:now,returnMethod:'none',destination:'',emergencyNumber:'911',steps:[],policyVersion:'social-v0.4-phase-a'}};
describe('shared terminal preparation outcomes',()=>{
 it('closes on cancellation or Return, leaving active plans open',()=>{expect(preparationClosed(undefined)).toBe(false);expect(preparationClosed({...cancelled.preparation!,cancelledAtIso:undefined})).toBe(false);expect(preparationClosed(cancelled.preparation)).toBe(true);expect(preparationClosed({returnedAtIso:now} as MomentPreparation)).toBe(true);});
 it('keeps cancelled records out of upcoming surfaces and preparation reminders',()=>{expect(surfaceableMoments([cancelled],now)).toEqual([]);expect(nextMoment([cancelled],now)).toBeNull();expect(planMomentNotifications([cancelled],DEFAULT_MOMENT_NOTIFY_PREFS,now)).toEqual([]);});
 it('does not let a cancelled ongoing record suppress another eligible proposal',()=>{const old={...cancelled,startAtIso:new Date(2027,0,8,16).toISOString()};const other={...cancelled,id:'next',title:'Dinner with team',preparation:undefined};expect(preparationProposalCandidate([old,other],{records:[],neverTypes:[]},now)?.id).toBe('next');});
 it('does not treat cancellation as an active private-context source',()=>{const m={...cancelled,safetyContext:{mentionedAtIso:now,expiresAtIso:new Date(Date.parse(now)+3600000).toISOString(),region:'test',policyVersion:'test'}};expect(activeAlcoholContext(m,Date.parse(now))).toBe(false);});
});
