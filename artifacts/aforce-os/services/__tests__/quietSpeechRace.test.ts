import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({quiet:false,play:vi.fn(),create:vi.fn(),fetch:vi.fn()}));
vi.mock('../quietDelivery',()=>({ordinaryDeliveryBlocked:()=>h.quiet}));
vi.mock('../../lib/api',()=>({getApiBase:()=> 'https://example.invalid/api'}));
vi.mock('expo-audio',()=>({createAudioPlayer:h.create}));
import {speakWithElevenLabs,stopElevenLabs} from '../elevenLabsTts';
beforeEach(()=>{h.quiet=false;h.play.mockReset();h.create.mockReset().mockReturnValue({play:h.play,pause:vi.fn(),remove:vi.fn()});h.fetch.mockReset();vi.stubGlobal('fetch',h.fetch);});
afterEach(()=>{stopElevenLabs();vi.unstubAllGlobals();});
describe('Quiet with in-flight speech',()=>{
 it('never starts a new network utterance during Quiet',async()=>{h.quiet=true;await speakWithElevenLabs({text:'Check in',voiceId:'test'});expect(h.fetch).not.toHaveBeenCalled();expect(h.play).not.toHaveBeenCalled();});
 it('does not start audio when a pre-Quiet request completes late',async()=>{let resolve!:(r:unknown)=>void;h.fetch.mockReturnValue(new Promise(r=>resolve=r));const pending=speakWithElevenLabs({text:'Check in',voiceId:'test'});h.quiet=true;stopElevenLabs();resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});await pending;expect(h.create).not.toHaveBeenCalled();});
 it('does not revive cancelled audio even if Quiet has ended before fetch completes',async()=>{let resolve!:(r:unknown)=>void;h.fetch.mockReturnValue(new Promise(r=>resolve=r));const pending=speakWithElevenLabs({text:'Old coaching',voiceId:'test'});stopElevenLabs();resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});await pending;expect(h.play).not.toHaveBeenCalled();});
});
