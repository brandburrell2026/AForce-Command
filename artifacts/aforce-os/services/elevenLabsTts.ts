/**
 * ElevenLabs TTS client.
 *
 * The mobile client never sees the ElevenLabs API key — it asks our
 * api-server (`POST /api/voice/tts`) which proxies to ElevenLabs and
 * streams the MP3 back. We then play it via expo-audio (cross-platform
 * including web).
 *
 * If the network call or playback fails for any reason, the caller
 * (`textToSpeech.ts`) falls back to expo-speech so the coach is never
 * silent — that's the whole point of having a fallback at this layer.
 */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { getApiBase } from '../lib/api';

let activePlayer: AudioPlayer | null = null;

function disposeActive(): void {
  if (!activePlayer) return;
  try {
    activePlayer.pause();
    activePlayer.remove();
  } catch {
    // Player may already be torn down — safe to ignore.
  }
  activePlayer = null;
}

export interface ElevenLabsSpeakOptions {
  text: string;
  voiceId: string;
  /** Optional auth token (Clerk). If omitted, the request is anonymous
   *  — the server route is currently public-with-rate-limit. */
  authToken?: string | null;
  /**
   * Server cache opt-in. `'static'` lets the server serve a cached MP3 for
   * an allowlisted `(voiceId, phraseKey)` pair (the common Voice Check-In
   * lines), spending no ElevenLabs credit on the repeat. Personalized lines
   * pass `'dynamic'` (or omit) so they always hit ElevenLabs live and are
   * never cached. Ignored unless paired with a `phraseKey`.
   */
  cachePolicy?: 'static' | 'dynamic';
  /** Allowlisted phrase key (e.g. `checkin.intro`) — required for caching. */
  phraseKey?: string;
}

/**
 * Fetch MP3 audio from our proxy and play it. Returns when playback
 * starts (not when it finishes) so the caller doesn't block. Throws on
 * network / server errors so the caller can fall back.
 */
export async function speakWithElevenLabs(opts: ElevenLabsSpeakOptions): Promise<void> {
  const text = opts.text?.trim();
  if (!text) return;

  const base = getApiBase();
  const url = `${base}/voice/tts`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'audio/mpeg',
  };
  if (opts.authToken) {
    headers.Authorization = `Bearer ${opts.authToken}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      voiceId: opts.voiceId,
      ...(opts.cachePolicy ? { cachePolicy: opts.cachePolicy } : {}),
      ...(opts.phraseKey ? { phraseKey: opts.phraseKey } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs TTS failed: ${res.status}`);
  }

  // We need a playable URI for expo-audio. On web we can hand it a
  // blob: URL; on native we get the bytes as a base64 data URI. Both
  // work because expo-audio's web backend uses HTML5 Audio and the
  // native backend buffers the URI before play().
  let playUri: string;
  if (typeof window !== 'undefined' && typeof URL !== 'undefined' && 'createObjectURL' in URL) {
    const blob = await res.blob();
    playUri = URL.createObjectURL(blob);
  } else {
    const buf = await res.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    playUri = `data:audio/mpeg;base64,${b64}`;
  }

  // Tear down any previous utterance so a rapid second command doesn't
  // overlap — matches the de-dupe behavior in ttsService.
  disposeActive();

  const player = createAudioPlayer({ uri: playUri });
  activePlayer = player;
  player.play();
}

export function stopElevenLabs(): void {
  disposeActive();
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  // RN runtime: fall back to global Buffer if available.
  const g = globalThis as unknown as { Buffer?: { from(b: string, enc: string): { toString(enc: string): string } } };
  if (g.Buffer) {
    return g.Buffer.from(binary, 'binary').toString('base64');
  }
  throw new Error('No base64 encoder available');
}
