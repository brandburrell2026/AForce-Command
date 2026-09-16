/**
 * Medical note encryption at rest — AES-256-GCM, in this process.
 *
 * WHAT THIS REPLACES. Four `*_enc` bytea columns have existed since Phase 4
 * and were never read or written by anything. `noteEncryptionConfigured`
 * checked that an environment variable was at least 32 characters long and
 * never used it as a key. So production refused a note write without a key,
 * and then, once any 32-character string was set, wrote every note in the
 * clear — readable from a replica, a `pg_dump`, a backup, or a read-only
 * analytics grant. The module header asserted the opposite, which is worse
 * than having no gate: it manufactured confidence that the classification was
 * satisfied.
 *
 * WHY IN THE APPLICATION AND NOT IN PGCRYPTO. `pgp_sym_encrypt(text, key)`
 * puts the key in the SQL statement. Postgres logs statements on error, and
 * `log_min_duration_statement` logs them on latency, so the key ends up in a
 * log stream with different retention and a different access list from the
 * data it protects. Encrypting here means the key never leaves the process
 * and the database only ever receives ciphertext. It is also testable without
 * a database, which is why this module has a suite and pgcrypto would not.
 *
 * FORMAT. `v1:<iv>:<tag>:<ciphertext>`, each part base64, stored as UTF-8
 * bytes in the existing bytea column. The version prefix is what makes a key
 * rotation or an algorithm change possible without guessing at old rows: a
 * reader dispatches on it and refuses anything it does not recognise.
 *
 * THE KEY. `MEDICAL_NOTE_ENCRYPTION_KEY`, 32 bytes, supplied base64 or hex.
 * A passphrase is NOT accepted — deriving a key from whatever string someone
 * set is how the previous gate came to mean nothing. This module never logs
 * the key, never includes it in an error, and never returns it.
 *
 * LOSING THE KEY LOSES THE NOTES. That is the trade this makes, deliberately.
 * The key belongs in a managed secret store with the same backup and rotation
 * discipline as the database itself, and the runbook has to say so.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits, the GCM nominal
const KEY_BYTES = 32;
const VERSION = "v1";

/**
 * Read the key, or explain why there isn't one.
 *
 * Deliberately returns a reason string rather than throwing with the value
 * anywhere near it. No branch here can print, log or return key material.
 */
function readKey(env: NodeJS.ProcessEnv): { ok: true; key: Buffer } | { ok: false; reason: string } {
  const raw = env["MEDICAL_NOTE_ENCRYPTION_KEY"];
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, reason: "MEDICAL_NOTE_ENCRYPTION_KEY is not set" };
  }

  // Hex first: a 64-character hex string is also valid base64-ish input to a
  // lenient decoder, and hex is the unambiguous reading of it.
  let key: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else if (/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === KEY_BYTES) key = decoded;
  }

  if (!key || key.length !== KEY_BYTES) {
    return {
      ok: false,
      reason: `MEDICAL_NOTE_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (base64 or hex)`,
    };
  }
  return { ok: true, key };
}

/**
 * Is note encryption configured with a USABLE key?
 *
 * The previous implementation of this name answered "is some string at least
 * 32 characters long", which a caller could satisfy with a sentence. This one
 * answers the question the route is actually asking before it refuses a write.
 */
export function noteEncryptionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return readKey(env).ok;
}

/** The reason encryption is unavailable, for an operator. Never the key. */
export function noteEncryptionProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  const result = readKey(env);
  return result.ok ? null : result.reason;
}

export class NoteEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteEncryptionError";
  }
}

/**
 * Encrypt one note field. `null` in, `null` out — an absent field stays
 * absent rather than becoming ciphertext of the empty string, which would
 * leak that the field exists.
 */
export function encryptNoteField(
  plaintext: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Buffer | null {
  if (plaintext === null) return null;

  const result = readKey(env);
  if (!result.ok) throw new NoteEncryptionError(result.reason);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, result.key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.from(
    [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":"),
    "utf8",
  );
}

/**
 * Decrypt one note field.
 *
 * A tampered or truncated value fails here rather than returning something
 * plausible: GCM authenticates, and a medical record that has been altered
 * must not be readable as though it had not.
 */
export function decryptNoteField(
  stored: Uint8Array | null,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (stored === null) return null;

  const result = readKey(env);
  if (!result.ok) throw new NoteEncryptionError(result.reason);

  const parts = Buffer.from(stored).toString("utf8").split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new NoteEncryptionError("unrecognised note ciphertext format");
  }

  const iv = Buffer.from(parts[1]!, "base64");
  const tag = Buffer.from(parts[2]!, "base64");
  const ciphertext = Buffer.from(parts[3]!, "base64");
  if (iv.length !== IV_BYTES) throw new NoteEncryptionError("unrecognised note ciphertext format");

  try {
    const decipher = createDecipheriv(ALGORITHM, result.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Deliberately not the underlying message: it varies by failure mode and
    // is an oracle. Wrong key and altered ciphertext answer the same way.
    throw new NoteEncryptionError("note could not be decrypted");
  }
}
