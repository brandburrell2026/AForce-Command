/**
 * Notes are encrypted at rest, and this is the statement of it.
 *
 * The four `*_enc` columns existed since Phase 4 and were never read or
 * written. `noteEncryptionConfigured` checked that a string was at least 32
 * characters long and never used it as a key, so setting any sentence opened
 * the production gate onto plaintext writes.
 *
 * The first test below is the one that would have caught that: the stored
 * bytes must not contain the note.
 */
import { describe, expect, it } from "vitest";

import {
  NoteEncryptionError,
  decryptNoteField,
  encryptNoteField,
  noteEncryptionConfigured,
  noteEncryptionProblem,
} from "../noteCrypto";

const KEY_A = { MEDICAL_NOTE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };
const KEY_B = { MEDICAL_NOTE_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") };
const KEY_HEX = { MEDICAL_NOTE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("hex") };

const NOTE = "Athlete reports posterior thigh pain after sprinting. Grade 1 strain suspected.";

describe("stored note bytes are opaque", () => {
  it("does not contain the plaintext, nor any word of it", () => {
    const stored = encryptNoteField(NOTE, KEY_A)!;
    const asText = Buffer.from(stored).toString("utf8");
    const asBinary = Buffer.from(stored).toString("latin1");

    expect(asText).not.toContain(NOTE);
    for (const word of ["thigh", "pain", "strain", "sprinting", "Athlete"]) {
      expect(asText, word).not.toContain(word);
      expect(asBinary, word).not.toContain(word);
    }
  });

  it("round-trips exactly, including unicode and newlines", () => {
    for (const text of [NOTE, "", "line one\nline two", "Dončić · 中村 · 🙂", "a".repeat(20000)]) {
      expect(decryptNoteField(encryptNoteField(text, KEY_A), KEY_A)).toBe(text);
    }
  });

  it("produces different ciphertext for the same note each time", () => {
    // A deterministic ciphertext tells a reader which athletes share a note,
    // and which note was re-filed unchanged.
    const a = Buffer.from(encryptNoteField(NOTE, KEY_A)!).toString("utf8");
    const b = Buffer.from(encryptNoteField(NOTE, KEY_A)!).toString("utf8");
    expect(a).not.toBe(b);
    expect(decryptNoteField(encryptNoteField(NOTE, KEY_A), KEY_A)).toBe(NOTE);
  });

  it("keeps an absent field absent rather than encrypting nothing", () => {
    // Ciphertext of "" would tell a reader the field exists and is empty.
    expect(encryptNoteField(null, KEY_A)).toBeNull();
    expect(decryptNoteField(null, KEY_A)).toBeNull();
  });

  it("carries a version prefix, so a future key rotation can dispatch", () => {
    expect(Buffer.from(encryptNoteField(NOTE, KEY_A)!).toString("utf8")).toMatch(/^v1:/);
  });
});

describe("a note that has been altered does not read as though it had not", () => {
  it("refuses the wrong key rather than returning plausible text", () => {
    const stored = encryptNoteField(NOTE, KEY_A);
    expect(() => decryptNoteField(stored, KEY_B)).toThrow(NoteEncryptionError);
  });

  it("refuses tampered ciphertext", () => {
    const stored = Buffer.from(encryptNoteField(NOTE, KEY_A)!);
    const text = stored.toString("utf8");
    const parts = text.split(":");
    const body = Buffer.from(parts[3]!, "base64");
    body[0] = body[0]! ^ 0xff;
    const tampered = Buffer.from(
      [parts[0], parts[1], parts[2], body.toString("base64")].join(":"),
      "utf8",
    );
    expect(() => decryptNoteField(tampered, KEY_A)).toThrow(NoteEncryptionError);
  });

  it("refuses a format it does not recognise", () => {
    expect(() => decryptNoteField(Buffer.from("just some plaintext", "utf8"), KEY_A)).toThrow(
      NoteEncryptionError,
    );
    expect(() => decryptNoteField(Buffer.from("v2:a:b:c", "utf8"), KEY_A)).toThrow(
      NoteEncryptionError,
    );
  });

  it("answers a wrong key and a tampered note the same way", () => {
    // Two different messages here would be an oracle.
    const stored = Buffer.from(encryptNoteField(NOTE, KEY_A)!);
    const parts = stored.toString("utf8").split(":");
    const body = Buffer.from(parts[3]!, "base64");
    body[0] = body[0]! ^ 0xff;
    const tampered = Buffer.from([parts[0], parts[1], parts[2], body.toString("base64")].join(":"));

    const wrongKey = (() => {
      try {
        decryptNoteField(stored, KEY_B);
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    })();
    const altered = (() => {
      try {
        decryptNoteField(tampered, KEY_A);
      } catch (e) {
        return (e as Error).message;
      }
      return "";
    })();

    expect(wrongKey).toBe(altered);
  });
});

describe("the gate answers whether there is a USABLE key", () => {
  it("accepts a 32-byte key as base64 or hex", () => {
    expect(noteEncryptionConfigured(KEY_A)).toBe(true);
    expect(noteEncryptionConfigured(KEY_HEX)).toBe(true);
    // And both readings of the same key agree.
    expect(decryptNoteField(encryptNoteField(NOTE, KEY_A), KEY_HEX)).toBe(NOTE);
  });

  it.each([
    ["unset", {}],
    ["empty", { MEDICAL_NOTE_ENCRYPTION_KEY: "" }],
    // The exact shape the old gate accepted: 32+ characters, not a key.
    ["a 40-character passphrase", { MEDICAL_NOTE_ENCRYPTION_KEY: "correct horse battery staple and then some" }],
    ["a short key", { MEDICAL_NOTE_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64") }],
    ["an over-long key", { MEDICAL_NOTE_ENCRYPTION_KEY: Buffer.alloc(64, 1).toString("base64") }],
  ])("refuses %s", (_label, env) => {
    expect(noteEncryptionConfigured(env)).toBe(false);
    expect(noteEncryptionProblem(env)).toBeTruthy();
    expect(() => encryptNoteField(NOTE, env)).toThrow(NoteEncryptionError);
  });

  it("never puts key material in the reason or the error", () => {
    const secret = "correct horse battery staple and then some";
    const env = { MEDICAL_NOTE_ENCRYPTION_KEY: secret };
    expect(noteEncryptionProblem(env)).not.toContain(secret);
    try {
      encryptNoteField(NOTE, env);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toContain(secret);
      expect(JSON.stringify(e, Object.getOwnPropertyNames(e))).not.toContain(secret);
    }
  });
});
