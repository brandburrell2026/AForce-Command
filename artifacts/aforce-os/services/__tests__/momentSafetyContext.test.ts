import {afterEach,describe,expect,it,vi} from 'vitest';
import {activeAlcoholContext,alcoholDisclosure,configuredMomentSafetyPolicy,withAlcoholContext,withoutExpiredSafetyContext} from '../momentSafetyContext';
import {evaluateMomentSafety} from '@/utils/intelligence/decisionGuard';
import type {Moment} from '@/types/moments';
const now=Date.parse('2026-11-04T12:00:00Z');
const moment:Moment={id:'one',source:'manual',title:'Team dinner',type:'personal',importance:'high',startAtIso:'2026-11-04T19:00:00Z',createdAtIso:'2026-11-04T10:00:00Z'};
const policy={region:'test-region',retentionHours:3,version:'test-policy'};
afterEach(()=>vi.unstubAllEnvs());
describe('private expiring Moment safety context',()=>{
 it('requires explicit regional policy rather than inventing a lifetime',()=>{vi.stubEnv('EXPO_PUBLIC_SOCIAL_POLICY_REGION','');expect(configuredMomentSafetyPolicy()).toBeNull();vi.stubEnv('EXPO_PUBLIC_SOCIAL_POLICY_REGION','test');vi.stubEnv('EXPO_PUBLIC_SOCIAL_CONTEXT_RETENTION_HOURS','3');vi.stubEnv('EXPO_PUBLIC_SOCIAL_POLICY_VERSION','reviewed-test');expect(configuredMomentSafetyPolicy()?.retentionHours).toBe(3);});
 it('retains a volunteered disclosure across JSON restart without amount or words',()=>{const saved=JSON.parse(JSON.stringify(withAlcoholContext(moment,policy,now)));expect(activeAlcoholContext(saved,now+60000)).toBe(true);expect(evaluateMomentSafety('I am still driving',activeAlcoholContext(saved,now+60000))).toBe('driving');expect(saved.safetyContext).toEqual({mentionedAtIso:'2026-11-04T12:00:00.000Z',expiresAtIso:'2026-11-04T15:00:00.000Z',region:'test-region',policyVersion:'test-policy'});});
 it('does not extend retention simply by reading or updating the same plan',()=>{const saved=withAlcoholContext(moment,policy,now);expect(withAlcoholContext(saved,policy,now+60000)).toBe(saved);});
 it('drops expired metadata without providing driving clearance',()=>{const saved=withAlcoholContext(moment,policy,now);expect(activeAlcoholContext(saved,now+3*3600000)).toBe(false);expect(withoutExpiredSafetyContext(saved,now+3*3600000).safetyContext).toBeUndefined();});
 it('fails closed on malformed expiry and never infers context from venue',()=>{expect(activeAlcoholContext({...moment,safetyContext:{mentionedAtIso:'bad',expiresAtIso:'bad',region:'test',policyVersion:'test'}},now)).toBe(false);expect(alcoholDisclosure('Dinner at a bar')).toBe(false);expect(alcoholDisclosure('I drank and I am driving')).toBe(true);expect(evaluateMomentSafety('I drank and I am driving')).toBe('driving');});
});
