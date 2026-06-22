/**
 * Thin REST client used by services that talk to the api-server at the
 * `/api` root (battles, circle, privacy). Mirrors the private helpers
 * inside `realApi.ts` (which target `/api/aforce`) so each service only
 * imports the verbs it needs and we don't bend `realApi.ts`'s shape.
 *
 * Auth uses the shared Clerk token bridge (`authToken.ts`); when Clerk
 * isn't configured the api-server's `requireAuth` middleware falls back
 * to DEFAULT_USER_ID, so unauthenticated dev still works.
 */

import { getAuthHeaders } from './authToken';

function resolveApiBase(): string {
  const explicit = process.env['EXPO_PUBLIC_API_BASE'];
  if (explicit) return explicit.replace(/\/$/, '');
  const domain = process.env['EXPO_PUBLIC_DOMAIN'];
  if (domain) return `https://${domain}/api`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
}

const API_BASE = resolveApiBase();

/**
 * Error thrown for non-2xx api-server responses. Subclass of `Error`
 * with the SAME message shape as before (so existing `catch (e)` /
 * `e.message` consumers are unaffected) plus a structured `status` so
 * callers can branch on the HTTP code — e.g. the Garmin service maps a
 * 404 (route not mounted = credentials not configured) to a benign
 * "credentials missing" state instead of a hard failure.
 */
export class AforceApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AforceApiError';
    this.status = status;
  }
}

async function readJsonOrThrow<T>(res: Response, method: string, path: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new AforceApiError(
      res.status,
      `${method} ${path} → ${res.status}${detail ? ` ${detail}` : ''}`,
    );
  }
  return (await res.json()) as T;
}

export async function getJsonAforceApi<T>(path: string): Promise<T> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json', ...auth },
  });
  return readJsonOrThrow<T>(res, 'GET', path);
}

export async function postJsonAforceApi<T>(path: string, body: unknown): Promise<T> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  return readJsonOrThrow<T>(res, 'POST', path);
}

export async function putJsonAforceApi<T>(path: string, body: unknown): Promise<T> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  return readJsonOrThrow<T>(res, 'PUT', path);
}

export async function deleteJsonAforceApi<T>(path: string): Promise<T> {
  const auth = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { accept: 'application/json', ...auth },
  });
  return readJsonOrThrow<T>(res, 'DELETE', path);
}
