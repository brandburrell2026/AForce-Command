/**
 * AForce Command Voice Engine — last-spoken bus + playback lifecycle.
 *
 * Module-level singleton that records every utterance the engine
 * speaks (across score bands, risk timers, system commands, and
 * completion rewards) so the UI can:
 *
 *   - render a "Last Command" line in the Voice Status module,
 *   - offer a one-tap Replay control,
 *   - subscribe and re-render when a new line lands,
 *   - drive cinematic UI states (received → playing → executed)
 *     through a parallel playback-state pub/sub channel.
 *
 * The bus wraps `services/textToSpeech.speak()` so the underlying
 * persona / scope / enabled gating + ElevenLabs ↔ device fallback
 * remain authoritative — this layer only adds *recording*, *replay*,
 * and *lifecycle*. It is React-free so it can be unit-tested without
 * the RN bundle.
 */

import type { PerformanceLevel } from '../../types';
import type { VoiceCategory, VoiceIntensity } from './commandVoice';

/* ------------------------------------------------------------------ *
 * Speaker injection
 *
 * The bus is intentionally decoupled from `services/textToSpeech` at
 * module load time so it can be unit-tested in a Node/Vitest
 * environment without dragging in the React Native runtime. The app
 * wires the real speaker (`textToSpeech.speak`) once at boot via
 * `setSpeakerImpl()`; until that happens, every speak is a silent
 * no-op (the bus still records + notifies subscribers, which is the
 * correct behaviour during SSR / hot-reload windows).
 * ------------------------------------------------------------------ */

type Speaker = (text: string, opts?: { level?: PerformanceLevel }) => void;
const NOOP_SPEAKER: Speaker = () => {};
let speakerImpl: Speaker = NOOP_SPEAKER;

/** Wire the app-side TTS implementation. Pass `null` to reset to noop. */
export function setSpeakerImpl(impl: Speaker | null): void {
  speakerImpl = impl ?? NOOP_SPEAKER;
}

export interface SpokenCommand {
  /** The full line that was spoken. */
  line: string;
  /** Epoch ms when the line was spoken. */
  at: number;
  /** Performance level used to drive rate/pitch. Optional. */
  level?: PerformanceLevel;
  /** The intensity at the moment of speaking. Optional. */
  intensity?: VoiceIntensity;
  /** The category of this utterance — drives UI badging. */
  category: VoiceCategory;
}

export interface CommandSpeakOpts {
  level?: PerformanceLevel;
  intensity?: VoiceIntensity;
  /** Defaults to `'system_command'` if not specified. */
  category?: VoiceCategory;
}

type Listener = (latest: SpokenCommand | null) => void;

let last: SpokenCommand | null = null;
const listeners = new Set<Listener>();

/* ------------------------------------------------------------------ *
 * Playback lifecycle — drives the cinematic UI states (orb glow,
 * breathing border, COMMAND RECEIVED / EXECUTED / ERROR badges).
 *
 * State machine:
 *   idle ──commandSpeak()──▶ received ──~220ms──▶ playing ──~estMs──▶ idle
 *   any  ──markCycleExecuted()──▶ executed ──~2400ms──▶ idle
 *   any  ──markVoiceError()──▶ error    ──~2400ms──▶ idle
 *
 * Every transition fires the playbackListeners so the UI can re-render
 * without polling. Timers are tracked centrally and replaced on every
 * new transition so we never "double-end" a state from a stale timer.
 * ------------------------------------------------------------------ */

export type PlaybackState = 'idle' | 'received' | 'playing' | 'executed' | 'error';

type PlaybackListener = (state: PlaybackState) => void;

let playbackState: PlaybackState = 'idle';
const playbackListeners = new Set<PlaybackListener>();
type TimerHandle = ReturnType<typeof setTimeout>;
let activeTimer: TimerHandle | null = null;
let nextTimer: TimerHandle | null = null;

/** Estimate how long ElevenLabs/Expo TTS will take to speak this line. */
function estimateSpeakMs(text: string): number {
  // ~70ms per character with a 1400ms floor and 8000ms ceiling. Errs
  // slightly long so the "playing" state never disappears mid-utterance.
  return Math.min(8000, Math.max(1400, text.length * 70));
}

function clearActiveTimers(): void {
  if (activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
  if (nextTimer)   { clearTimeout(nextTimer);   nextTimer   = null; }
}

function setPlaybackState(next: PlaybackState): void {
  playbackState = next;
  for (const fn of playbackListeners) {
    try { fn(next); } catch { /* never let one bad subscriber break the bus */ }
  }
}

/** Current playback state — UI can read this on mount before subscribing. */
export function getPlaybackState(): PlaybackState {
  return playbackState;
}

/** Subscribe to playback-state transitions. Returns an unsubscribe fn. */
export function subscribePlayback(listener: PlaybackListener): () => void {
  playbackListeners.add(listener);
  return () => { playbackListeners.delete(listener); };
}

/**
 * Mark that the user just completed a hydration cycle. Pulses the UI
 * into the `executed` state for ~2.4s before returning to idle. Safe
 * to call regardless of whether voice is currently playing — it
 * supersedes the in-flight playback timeline.
 */
export function markCycleExecuted(): void {
  clearActiveTimers();
  setPlaybackState('executed');
  activeTimer = setTimeout(() => {
    activeTimer = null;
    setPlaybackState('idle');
  }, 2400);
}

/**
 * Mark that the speaker layer hit an unrecoverable error (e.g. network
 * failure with no device-TTS fallback). UI surfaces a brief "AUDIO
 * RETRY" badge before returning to idle.
 */
export function markVoiceError(): void {
  clearActiveTimers();
  setPlaybackState('error');
  activeTimer = setTimeout(() => {
    activeTimer = null;
    setPlaybackState('idle');
  }, 2400);
}

/* ------------------------------------------------------------------ *
 * Command speak / replay
 * ------------------------------------------------------------------ */

function startPlaybackCycle(line: string): void {
  clearActiveTimers();
  setPlaybackState('received');
  // Pre-roll: ~220ms of "RECEIVED" before the voice actually begins.
  // Matches the cinematic feel of high-end command UIs.
  nextTimer = setTimeout(() => {
    nextTimer = null;
    setPlaybackState('playing');
    activeTimer = setTimeout(() => {
      activeTimer = null;
      setPlaybackState('idle');
    }, estimateSpeakMs(line));
  }, 220);
}

/**
 * Speak a line, then record it for replay + notify subscribers.
 * Returns the recorded SpokenCommand so callers can chain.
 */
export function commandSpeak(line: string, opts: CommandSpeakOpts = {}): SpokenCommand | null {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  let speakerThrew = false;
  try {
    speakerImpl(trimmed, opts.level ? { level: opts.level } : {});
  } catch {
    speakerThrew = true;
  }

  const record: SpokenCommand = {
    line: trimmed,
    at: Date.now(),
    category: opts.category ?? 'system_command',
    ...(opts.level !== undefined ? { level: opts.level } : {}),
    ...(opts.intensity !== undefined ? { intensity: opts.intensity } : {}),
  };
  last = record;
  for (const fn of listeners) {
    try { fn(last); } catch { /* never let one bad subscriber break the bus */ }
  }

  if (speakerThrew) {
    markVoiceError();
  } else {
    startPlaybackCycle(trimmed);
  }
  return record;
}

/** Most-recent utterance, or null if the engine has not spoken yet. */
export function getLastCommand(): SpokenCommand | null {
  return last;
}

/**
 * Replay the most-recent utterance verbatim using the same level.
 * Returns the SpokenCommand that was replayed, or null when there is
 * nothing to replay. Replays *do not* overwrite the original `at`
 * timestamp — the UI keeps showing the original "spoken at" so a
 * replay does not artificially refresh "just now". The playback
 * lifecycle still cycles through received → playing → idle so the UI
 * pulse fires for the replay too.
 */
export function replayLastCommand(): SpokenCommand | null {
  if (!last) return null;
  let speakerThrew = false;
  try {
    speakerImpl(last.line, last.level ? { level: last.level } : {});
  } catch {
    speakerThrew = true;
  }
  if (speakerThrew) {
    markVoiceError();
  } else {
    startPlaybackCycle(last.line);
  }
  return last;
}

/**
 * Subscribe to bus updates. Returns an unsubscribe function. Listener
 * is invoked with the new latest record on every successful speak.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/* ------------------------------------------------------------------ *
 * Test helpers — kept on the public surface so unit tests can isolate
 * the bus without poking module internals via TS-ignore.
 * ------------------------------------------------------------------ */

/** Reset bus state (last + listeners + playback) and restore the noop speaker. */
export function _resetForTests(): void {
  last = null;
  listeners.clear();
  playbackListeners.clear();
  clearActiveTimers();
  playbackState = 'idle';
  speakerImpl = NOOP_SPEAKER;
}

/** Inject a fake speaker (jest/vitest spy) for unit tests. */
export function _setSpeakerForTests(impl: Speaker): void {
  speakerImpl = impl;
}
