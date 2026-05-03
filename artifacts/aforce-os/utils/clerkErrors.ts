/**
 * Shared helper for surfacing Clerk's structured error payloads as a
 * single user-facing string. Clerk throws errors with an `errors[]`
 * array (each entry having `message` / `longMessage`); falls back to
 * the top-level `.message` if the array is missing.
 */
export function extractClerkError(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { errors?: Array<{ message?: string; longMessage?: string }>; message?: string };
  if (Array.isArray(e.errors) && e.errors.length > 0) {
    return e.errors[0]?.longMessage ?? e.errors[0]?.message ?? null;
  }
  return e.message ?? null;
}
