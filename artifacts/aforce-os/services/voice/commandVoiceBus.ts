/**
 * AForce Command Voice Engine — last-spoken bus.
 *
 * Module-level singleton that records every utterance the engine
 * speaks (across score bands, risk timers, system commands, and
 * completion rewards) so the UI can:
 *
 *   - render a "Last Command" line in the Voice Status module,
 *   - offer a one-tap Replay control,
 *   - subscribe and re-render when a new line lands.
 *
 * The bus wraps `services/textToSpeech.speak()` so the underlying
 * persona / scope / enabled gating + ElevenLabs ↔ device fallback
 * remain authoritative — this layer only adds *recording* and
 * *replay*. It is React-free so it can be unit-tested without the RN
 * bundle.
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

/**
 * Speak a line, then record it for replay + notify subscribers.
 * Returns the recorded SpokenCommand so callers can chain.
 */
export function commandSpeak(line: string, opts: CommandSpeakOpts = {}): SpokenCommand | null {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();
  speakerImpl(trimmed, opts.level ? { level: opts.level } : {});
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
 * replay does not artificially refresh "just now".
 */
export function replayLastCommand(): SpokenCommand | null {
  if (!last) return null;
  speakerImpl(last.line, last.level ? { level: last.level } : {});
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

/** Reset bus state (last + listeners) and restore the noop speaker. */
export function _resetForTests(): void {
  last = null;
  listeners.clear();
  speakerImpl = NOOP_SPEAKER;
}

/** Inject a fake speaker (jest/vitest spy) for unit tests. */
export function _setSpeakerForTests(impl: Speaker): void {
  speakerImpl = impl;
}
