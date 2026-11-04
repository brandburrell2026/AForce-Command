// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ events: {} as Record<string, (event?: any) => void>, app: undefined as undefined | ((state: string) => void), scope: undefined as undefined | (() => void), current: true, supported: true, permission: vi.fn(), start: vi.fn(), stop: vi.fn(), abort: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { addEventListener: (_: string, fn: any) => { h.app = fn; return { remove: vi.fn() }; } } }));
vi.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: {
  isRecognitionAvailable: () => true, supportsOnDeviceRecognition: () => h.supported,
  addListener: (name: string, fn: any) => { h.events[name] = fn; return { remove: vi.fn() }; },
  requestMicrophonePermissionsAsync: h.permission, start: h.start, stop: h.stop, abort: h.abort,
} }));
vi.mock('@/services/scopedWriteQueue', () => ({ captureScope: () => ({ generation: 1 }), isScopeCurrent: () => h.current }));
vi.mock('@/services/userScope', () => ({ getScopeState: () => ({ status: 'AUTHENTICATED' }), subscribeScopeState: (fn: any) => { h.scope = fn; return vi.fn(); } }));
import { useOneBreathVoice } from '../../hooks/useOneBreathVoice.native';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let host: HTMLDivElement; let voice: ReturnType<typeof useOneBreathVoice>; const transcript = vi.fn();
function Harness() { voice = useOneBreathVoice(transcript); return null; }
beforeEach(() => { transcript.mockReset(); vi.useFakeTimers(); h.current = true; h.supported = true; h.events = {}; vi.clearAllMocks(); h.permission.mockResolvedValue({ granted: true }); host = document.createElement('div'); root = createRoot(host); act(() => root.render(React.createElement(Harness))); });
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });
describe('One Breath native capture lifecycle', () => {
  it('starts only on request, transcribes locally without persisting audio, and stops after 30 seconds', async () => {
    expect(h.permission).not.toHaveBeenCalled();
    await act(async () => voice.start());
    expect(h.start).toHaveBeenCalledWith(expect.objectContaining({ requiresOnDeviceRecognition: true, recordingOptions: { persist: false } }));
    act(() => h.events.start!()); expect(voice.listening).toBe(true);
    act(() => h.events.result!({ results: [{ transcript: 'Dinner tomorrow at 7 PM' }] }));
    expect(transcript).toHaveBeenCalledWith('Dinner tomorrow at 7 PM');
    act(() => vi.advanceTimersByTime(30_000)); expect(h.stop).toHaveBeenCalledOnce();
    act(() => h.events.end!()); expect(voice.busy).toBe(false);
  });
  it('keeps typing available when permission is denied or offline recognition is unsupported', async () => {
    h.permission.mockResolvedValue({ granted: false }); await act(async () => voice.start());
    expect(h.start).not.toHaveBeenCalled(); expect(voice.error).toContain('type');
    h.supported = false; act(() => root.render(React.createElement(Harness))); expect(voice.available).toBe(false);
  });
  it('does not start after a pending permission request is cancelled', async () => {
    let resolve!: (value: any) => void; h.permission.mockImplementation(() => new Promise((r) => { resolve = r; }));
    let pending!: Promise<void>; act(() => { pending = voice.start(); }); act(() => voice.stop());
    await act(async () => { resolve({ granted: true }); await pending; }); expect(h.start).not.toHaveBeenCalled();
  });
  it('keeps a partial draft on interruption, ignores later results, and permits a fresh capture after end', async () => {
    await act(async () => voice.start());
    act(() => h.events.result!({ results: [{ transcript: 'Team meeting' }] }));
    act(() => h.events.error!({ error: 'interrupted' }));
    expect(voice.busy).toBe(false); expect(voice.error).toContain('Review');
    act(() => h.events.result!({ results: [{ transcript: 'late result' }] }));
    expect(transcript).toHaveBeenCalledTimes(1);
    await act(async () => voice.start()); expect(h.start).toHaveBeenCalledTimes(1);
    act(() => h.events.end!()); await act(async () => voice.start()); expect(h.start).toHaveBeenCalledTimes(2);
  });
  it('does not capture after permission resolves on a different account', async () => {
    let resolve!: (value: any) => void; h.permission.mockImplementation(() => new Promise((r) => { resolve = r; }));
    let pending!: Promise<void>; act(() => { pending = voice.start(); });
    h.current = false; act(() => h.scope!());
    await act(async () => { resolve({ granted: true }); await pending; });
    expect(h.start).not.toHaveBeenCalled(); expect(transcript).not.toHaveBeenCalled();
  });
  it('aborts on background/account changes and ignores late transcripts', async () => {
    await act(async () => voice.start()); act(() => h.app!('background'));
    act(() => h.events.result!({ results: [{ transcript: 'late' }] })); expect(transcript).not.toHaveBeenCalled();
    act(() => h.events.end!()); await act(async () => voice.start()); h.current = false; act(() => h.scope!());
    expect(h.abort).toHaveBeenCalled(); act(() => h.events.result!({ results: [{ transcript: 'another account' }] })); expect(transcript).not.toHaveBeenCalled();
  });
});

it('ignores late transcripts after a member cancels voice to type, including permission wait',async()=>{
 await act(async()=>voice.start());act(()=>h.events.result!({results:[{transcript:'Voice draft'}]}));expect(transcript).toHaveBeenCalledWith('Voice draft');act(()=>voice.cancel());act(()=>h.events.result!({results:[{transcript:'Late overwrite'}]}));expect(transcript).toHaveBeenCalledTimes(1);expect(voice.busy).toBe(false);expect(h.abort).toHaveBeenCalledOnce();act(()=>h.events.end!());let resolve!:(value:any)=>void;h.permission.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));let pending!:Promise<void>;act(()=>{pending=voice.start();});act(()=>voice.cancel());await act(async()=>{resolve({granted:true});await pending;});expect(h.start).toHaveBeenCalledTimes(1);expect(transcript).toHaveBeenCalledTimes(1);
});

it('keeps existing words through empty recognition and failure, then accepts a fresh successful capture',async()=>{
 let draft='Typed team dinner';transcript.mockImplementation((text:string)=>{draft=text;});
 await act(async()=>voice.start());
 for(const results of [[],[{transcript:''}],[{transcript:'   '}]] as const)act(()=>h.events.result!({results}));
 expect(draft).toBe('Typed team dinner');expect(transcript).not.toHaveBeenCalled();
 act(()=>h.events.error!({error:'no-speech'}));expect(draft).toBe('Typed team dinner');expect(voice.busy).toBe(false);expect(voice.error).toContain('Review');
 act(()=>h.events.end!());await act(async()=>voice.start());act(()=>h.events.result!({results:[{transcript:'Dinner with Julius'}]}));expect(draft).toBe('Dinner with Julius');
 act(()=>h.events.result!({results:[{transcript:'\n  '}]}));expect(draft).toBe('Dinner with Julius');
});
it('does not erase a valid partial transcript with an empty final result',async()=>{
 await act(async()=>voice.start());act(()=>h.events.result!({results:[{transcript:'Pool party tomorrow'}]}));act(()=>h.events.result!({isFinal:true,results:[]}));act(()=>h.events.end!());expect(transcript).toHaveBeenCalledTimes(1);expect(transcript).toHaveBeenLastCalledWith('Pool party tomorrow');expect(voice.busy).toBe(false);
});
