import { describe, it, expect } from "vitest";
import {
  isCacheable,
  buildCacheKey,
  TtsAudioCache,
  CHECKIN_STATIC_PHRASE_KEYS,
  ALLOWED_COACH_VOICE_IDS,
} from "../ttsCache";

const ROCK = ALLOWED_COACH_VOICE_IDS[0];
const STATIC_KEY = CHECKIN_STATIC_PHRASE_KEYS[0];

describe("ttsCache · isCacheable policy", () => {
  it("caches only an explicit static opt-in on the allowlist", () => {
    expect(isCacheable("static", ROCK, STATIC_KEY)).toBe(true);
  });

  it("never caches dynamic (personalized) requests", () => {
    expect(isCacheable("dynamic", ROCK, STATIC_KEY)).toBe(false);
  });

  it("defaults to no-cache when policy is absent", () => {
    expect(isCacheable(undefined, ROCK, STATIC_KEY)).toBe(false);
  });

  it("rejects a static request with no phraseKey", () => {
    expect(isCacheable("static", ROCK, undefined)).toBe(false);
  });

  it("rejects a phraseKey not on the static allowlist", () => {
    expect(isCacheable("static", ROCK, "checkin.personalized_closing")).toBe(false);
    expect(isCacheable("static", ROCK, "arbitrary.key")).toBe(false);
  });

  it("rejects a voiceId outside the coach allowlist", () => {
    expect(isCacheable("static", "someRandomVoiceId123", STATIC_KEY)).toBe(false);
  });

  it("accepts every allowlisted coach voice for a static phrase", () => {
    for (const v of ALLOWED_COACH_VOICE_IDS) {
      expect(isCacheable("static", v, STATIC_KEY)).toBe(true);
    }
  });
});

describe("ttsCache · buildCacheKey", () => {
  it("is stable for identical inputs", () => {
    expect(buildCacheKey(ROCK, STATIC_KEY, "Hello")).toBe(
      buildCacheKey(ROCK, STATIC_KEY, "Hello"),
    );
  });

  it("separates different languages of the same phrase (text hash)", () => {
    const en = buildCacheKey(ROCK, STATIC_KEY, "How is your energy?");
    const es = buildCacheKey(ROCK, STATIC_KEY, "¿Cómo está tu energía?");
    expect(en).not.toBe(es);
  });

  it("separates different coaches", () => {
    const a = buildCacheKey(ALLOWED_COACH_VOICE_IDS[0], STATIC_KEY, "x");
    const b = buildCacheKey(ALLOWED_COACH_VOICE_IDS[1], STATIC_KEY, "x");
    expect(a).not.toBe(b);
  });

  it("separates different phrase keys", () => {
    const a = buildCacheKey(ROCK, CHECKIN_STATIC_PHRASE_KEYS[0], "x");
    const b = buildCacheKey(ROCK, CHECKIN_STATIC_PHRASE_KEYS[1], "x");
    expect(a).not.toBe(b);
  });

  it("embeds voiceId and phraseKey in the key prefix", () => {
    expect(buildCacheKey(ROCK, STATIC_KEY, "x").startsWith(`${ROCK}:${STATIC_KEY}:`)).toBe(
      true,
    );
  });
});

describe("ttsCache · TtsAudioCache (LRU + TTL)", () => {
  const entry = (s: string) => ({ audio: Buffer.from(s), contentType: "audio/mpeg" });

  it("stores and retrieves an entry", () => {
    const c = new TtsAudioCache();
    c.set("k", entry("hello"));
    expect(c.get("k")?.audio.toString()).toBe("hello");
  });

  it("returns undefined for a missing key", () => {
    const c = new TtsAudioCache();
    expect(c.get("nope")).toBeUndefined();
  });

  it("expires entries after the TTL", () => {
    let t = 1000;
    const c = new TtsAudioCache({ ttlMs: 500, now: () => t });
    c.set("k", entry("v"));
    t = 1400; // within TTL
    expect(c.get("k")?.audio.toString()).toBe("v");
    t = 1600; // past TTL (set at 1000 + 500 = 1500)
    expect(c.get("k")).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("evicts the least-recently-used entry past capacity", () => {
    const c = new TtsAudioCache({ maxEntries: 2 });
    c.set("a", entry("a"));
    c.set("b", entry("b"));
    // Touch "a" so "b" becomes the LRU.
    c.get("a");
    c.set("c", entry("c"));
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")?.audio.toString()).toBe("a");
    expect(c.get("c")?.audio.toString()).toBe("c");
    expect(c.size).toBe(2);
  });

  it("overwrites an existing key without growing size", () => {
    const c = new TtsAudioCache({ maxEntries: 2 });
    c.set("a", entry("a1"));
    c.set("a", entry("a2"));
    expect(c.get("a")?.audio.toString()).toBe("a2");
    expect(c.size).toBe(1);
  });
});
