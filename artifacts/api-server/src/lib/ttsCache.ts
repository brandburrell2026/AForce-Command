/**
 * ttsCache — server-side cache policy + store for ElevenLabs TTS audio.
 *
 * The Voice Check-In ritual speaks two kinds of lines:
 *   • STATIC common phrases (intro, the 3 questions, generic acks) — identical
 *     for every user of a given coach + language, so they are cached here and
 *     served without spending an ElevenLabs credit on the repeat.
 *   • DYNAMIC personalized lines (the closing calibration) — unique per user,
 *     so they always hit ElevenLabs live and are NEVER cached.
 *
 * Caching is intentionally conservative: a request is only cacheable when it
 * explicitly opts in (`cachePolicy: 'static'`) AND its `(voiceId, phraseKey)`
 * pair is on a server-controlled allowlist. This prevents a client from
 * filling the cache with arbitrary text. The cache KEY additionally folds in
 * a hash of the exact text so the six launch languages (en/es/fr/de/pt/it)
 * each cache separately and a Spanish user can never be served English audio.
 *
 * The store is a tiny dependency-free in-memory LRU with per-entry TTL. It is
 * process-local (resets on deploy / restart) which is fine: a miss just
 * re-fetches from ElevenLabs and re-populates.
 */

import { createHash } from "node:crypto";

/** Opt-in policy sent by the client. Anything else is treated as dynamic. */
export type TtsCachePolicy = "static" | "dynamic";

/** Cache outcome surfaced to the client via the `X-TTS-Cache` header. */
export type TtsCacheStatus = "HIT" | "MISS" | "BYPASS";

/**
 * The static Voice Check-In phrase keys eligible for caching. These map to
 * the coach-spoken common lines that do not vary per user. The personalized
 * closing line has no key here on purpose — it must never be cached.
 */
export const CHECKIN_STATIC_PHRASE_KEYS = [
  "checkin.intro",
  "checkin.q_energy",
  "checkin.q_stress",
  "checkin.q_goal",
  "checkin.ack",
] as const;

export type CheckInStaticPhraseKey = (typeof CHECKIN_STATIC_PHRASE_KEYS)[number];

/**
 * The four AForce coach ElevenLabs voice IDs. Mirrors
 * `services/voiceCatalog.ts` on the client. Only these voices may be cached
 * so an attacker can't pin arbitrary voice IDs into the store.
 */
export const ALLOWED_COACH_VOICE_IDS = [
  "pNInz6obpgDQGcFmaJgB", // rock
  "IKne3meq5aSn9XLyUdCD", // bb
  "XrExE9yKIg1WjnnlVkGX", // surge
  "EXAVITQu4vr4xnSDxMaL", // sage
] as const;

const PHRASE_KEY_SET = new Set<string>(CHECKIN_STATIC_PHRASE_KEYS);
const VOICE_ID_SET = new Set<string>(ALLOWED_COACH_VOICE_IDS);

/**
 * Decide whether a request is allowed to use the cache. Returns true only for
 * an explicit static opt-in whose `(voiceId, phraseKey)` pair is allowlisted.
 */
export function isCacheable(
  cachePolicy: TtsCachePolicy | undefined,
  voiceId: string,
  phraseKey: string | undefined,
): boolean {
  if (cachePolicy !== "static") return false;
  if (!phraseKey) return false;
  if (!PHRASE_KEY_SET.has(phraseKey)) return false;
  if (!VOICE_ID_SET.has(voiceId)) return false;
  return true;
}

/**
 * Build the cache key. Includes a sha256 of the exact text so different
 * languages (or any copy revision) of the same phrase cache independently.
 */
export function buildCacheKey(
  voiceId: string,
  phraseKey: string,
  text: string,
): string {
  const textHash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  return `${voiceId}:${phraseKey}:${textHash}`;
}

export interface TtsCacheEntry {
  audio: Buffer;
  contentType: string;
}

interface StoredEntry extends TtsCacheEntry {
  expiresAt: number;
}

/**
 * Dependency-free in-memory LRU + TTL cache. Insertion order in a JS `Map`
 * is the LRU order: a `get` hit re-inserts to mark recency, and eviction
 * drops the oldest key when over capacity.
 */
export class TtsAudioCache {
  private readonly store = new Map<string, StoredEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(opts?: { maxEntries?: number; ttlMs?: number; now?: () => number }) {
    this.maxEntries = opts?.maxEntries ?? 64;
    this.ttlMs = opts?.ttlMs ?? 24 * 60 * 60 * 1000; // 24h
    this.now = opts?.now ?? Date.now;
  }

  get(key: string): TtsCacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Mark as most-recently-used.
    this.store.delete(key);
    this.store.set(key, entry);
    return { audio: entry.audio, contentType: entry.contentType };
  }

  set(key: string, value: TtsCacheEntry): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { ...value, expiresAt: this.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

/** Shared process-local cache instance used by the route. */
export const ttsAudioCache = new TtsAudioCache();
