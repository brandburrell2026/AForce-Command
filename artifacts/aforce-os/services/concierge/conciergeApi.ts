/**
 * AForce Concierge — API client.
 *
 * Thin, typed wrapper over the authenticated api-server routes. Every call
 * carries the Clerk bearer header (getAuthHeaders) and honours an
 * AbortSignal so the screen can cancel safely. Errors are classified into the
 * three states the UI has copy for: offline, rate-limited, unavailable.
 */
import { getAuthHeaders } from '@/services/authToken';
import { API_BASE } from '@/lib/apiBase';
import { CONCIERGE_REQUEST_TIMEOUT_MS } from '@/config/hydroStateModel';
import type {
  ConciergeAssistantTurn,
  ConciergeClientContext,
  ConciergeConversationSummary,
  ConciergePreferences,
  ConciergePreferencesRecord,
  ConciergeStoredMessage,
} from './conciergeTypes';

export type ConciergeErrorKind =
  | 'offline'
  | 'cancelled'
  | 'rate_limited'
  | 'daily_limit'
  | 'not_found'
  | 'unauthorized'
  | 'storage_unavailable'
  | 'unavailable';

export class ConciergeApiError extends Error {
  readonly kind: ConciergeErrorKind;
  readonly status: number | null;
  constructor(kind: ConciergeErrorKind, status: number | null, message: string) {
    super(message);
    this.name = 'ConciergeApiError';
    this.kind = kind;
    this.status = status;
  }
}

export function classifyConciergeError(err: unknown): ConciergeErrorKind {
  if (err instanceof ConciergeApiError) return err.kind;
  if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
  // fetch() rejects with a TypeError on a transport gap (no response at all).
  if (err instanceof TypeError) return 'offline';
  return 'unavailable';
}

function kindForStatus(status: number, code: string | null): ConciergeErrorKind {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 429) return code === 'daily_limit_reached' ? 'daily_limit' : 'rate_limited';
  if (status === 503 && code === 'concierge_storage_unavailable') return 'storage_unavailable';
  return 'unavailable';
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const auth = await getAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONCIERGE_REQUEST_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...auth,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw new ConciergeApiError('cancelled', null, 'cancelled');
    if (controller.signal.aborted) throw new ConciergeApiError('unavailable', null, 'timeout');
    throw err; // TypeError → offline (classified by the caller)
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
  if (!res.ok) {
    let code: string | null = null;
    let detail = '';
    try {
      const text = await res.text();
      detail = text;
      const json = JSON.parse(text) as { code?: string };
      code = json.code ?? null;
    } catch {
      /* non-JSON error body */
    }
    throw new ConciergeApiError(kindForStatus(res.status, code), res.status, `${method} ${path} → ${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

export interface SendMessageResult {
  conversationId: string;
  turn: ConciergeAssistantTurn;
  duplicate: boolean;
}

export const conciergeApi = {
  status: (signal?: AbortSignal) =>
    request<{ available: boolean; reason: string | null }>('GET', '/concierge/status', undefined, signal),

  sendMessage: (
    args: { conversationId?: string; clientTurnId: string; message: string; context: ConciergeClientContext },
    signal?: AbortSignal,
  ) => request<SendMessageResult>('POST', '/concierge/messages', args, signal),

  briefing: (context: ConciergeClientContext, signal?: AbortSignal) =>
    request<{ turn: ConciergeAssistantTurn; generatedAt: string }>('POST', '/concierge/briefing', { context }, signal),

  listConversations: (signal?: AbortSignal) =>
    request<{ conversations: ConciergeConversationSummary[] }>('GET', '/concierge/conversations', undefined, signal),

  getConversation: (id: string, signal?: AbortSignal) =>
    request<{ conversation: ConciergeConversationSummary; messages: ConciergeStoredMessage[] }>(
      'GET',
      `/concierge/conversations/${encodeURIComponent(id)}`,
      undefined,
      signal,
    ),

  deleteConversation: (id: string) =>
    request<{ deleted: boolean }>('DELETE', `/concierge/conversations/${encodeURIComponent(id)}`),

  deleteAllConversations: () => request<{ deleted: number }>('DELETE', '/concierge/conversations'),

  getPreferences: (signal?: AbortSignal) =>
    request<{ preferences: ConciergePreferencesRecord | null }>('GET', '/concierge/preferences', undefined, signal),

  /** Consent is explicit in the body — the server refuses a save without it. */
  savePreferences: (prefs: ConciergePreferences) =>
    request<{ preferences: ConciergePreferencesRecord }>('PUT', '/concierge/preferences', { consent: true, prefs }),

  forgetPreference: (key: 'primaryGoal' | 'routine' | 'tone' | 'notes' | `notes.${number}`) =>
    request<{ preferences: ConciergePreferencesRecord }>('DELETE', `/concierge/preferences/${key}`),

  forgetAllPreferences: () => request<{ deleted: boolean }>('DELETE', '/concierge/preferences'),
};
