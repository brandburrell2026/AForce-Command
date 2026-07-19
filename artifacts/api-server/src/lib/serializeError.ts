/**
 * Serialize an unknown thrown value into a readable `{ type, message, stack }`
 * (the pino `stdSerializers.err` shape) for logging — so a swallowed failure is
 * diagnosable in the logs, not just its class name.
 *
 * Token-ish strings are REDACTED from the message + stack so surfacing the error
 * can never leak a WHOOP access/refresh token or a Bearer header. Real error
 * text (e.g. "Wrong key or corrupt data", "HTTP 401") contains no token and is
 * preserved intact.
 */
export interface SerializedError {
  type: string;
  message: string;
  stack?: string;
}

function redactSecrets(s: string): string {
  return (
    s
      // JWT-style tokens (three base64url segments).
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
      // `Bearer <token>` in any echoed header.
      .replace(/[Bb]earer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
      // Standalone long opaque tokens / ciphertext (40+ token chars).
      .replace(/\b[A-Za-z0-9._-]{40,}\b/g, "[REDACTED]")
  );
}

export function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    return {
      type: err.name,
      message: redactSecrets(err.message),
      ...(err.stack ? { stack: redactSecrets(err.stack) } : {}),
    };
  }
  return { type: "unknown_error", message: redactSecrets(String(err)) };
}
