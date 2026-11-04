// @vitest-environment happy-dom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect,vi} from 'vitest';
const h=vi.hoisted(()=>({moment:undefined as {id:string;preparation?:{cancelledAtIso?:string;returnedAtIso?:string}}|undefined,hydrated:true,rec:vi.fn()}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>({id:'one'}),Redirect:({href}:{href:string})=><div data-redirect={href}/> }));
vi.mock('@/store/useAppStore',()=>({useAppStore:()=>({state:{featureFlags:{moments_enabled:true,editorial_moments_enabled:false}}})}));
vi.mock('@/components/moments/useMomentsData',()=>({useMomentsData:()=>({hydrated:h.hydrated,momentById:()=>h.moment,recFor:h.rec,nowIso:'2027-01-08T17:00:00Z'})}));
vi.mock('@/hooks/useTravelIntelligence',()=>({useTravelIntelligence:()=>({})}));
vi.mock('@/services/travel/intelligence',()=>({markTravelPrepared:vi.fn()}));
vi.mock('@/components/ui',()=>({AFScreen:({children}:{children:React.ReactNode})=><div>{children}</div>}));
vi.mock('@/components/moments/MomentsSkeleton',()=>({MomentRitualSkeleton:()=> <div data-loading/>}));
vi.mock('@/components/editorial/moments/EditorialMomentDetailScreen',()=>({EditorialMomentDetailScreen:()=>null}));
vi.mock('@/components/moments/MomentDetailScreen',()=>({MomentDetailScreen:()=> <div data-detail/>}));
import MomentDetailRoute from '../../app/moment/[id]';
(globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
describe('cancelled Moment deep links',()=>{
 async function render(){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(<MomentDetailRoute/>));return{host,cleanup:()=>{act(()=>root.unmount());host.remove();}};}
 it('redirects a cancelled record before constructing preparation advice',async()=>{h.rec.mockClear();h.hydrated=true;h.moment={id:'one',preparation:{cancelledAtIso:'2027-01-08T17:00:00Z'}};const v=await render();try{expect(v.host.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/moments');expect(h.rec).not.toHaveBeenCalled();expect(v.host.querySelector('[data-detail]')).toBeNull();}finally{v.cleanup();}});
 it('preserves the existing detail path for ordinary records',async()=>{h.rec.mockClear();h.hydrated=true;h.moment={id:'one'};const v=await render();try{expect(v.host.querySelector('[data-detail]')).toBeTruthy();expect(h.rec).toHaveBeenCalledTimes(1);}finally{v.cleanup();}});
 it('still waits for hydration before rejecting an unknown ID',async()=>{h.hydrated=false;h.moment=undefined;const v=await render();try{expect(v.host.querySelector('[data-loading]')).toBeTruthy();expect(v.host.querySelector('[data-redirect]')).toBeNull();}finally{v.cleanup();}});
});
