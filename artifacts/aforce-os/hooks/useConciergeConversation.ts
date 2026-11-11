/**
 * AForce Concierge — conversation state machine.
 *
 * Owns: the active conversation id, the rendered items, in-flight state, the
 * AbortController for safe cancellation, history (list / open / delete), and
 * the on-demand briefing. Every network failure becomes a LOCAL item with a
 * retry handle; nothing is silently dropped and nothing is fabricated while
 * waiting.
 *
 * Duplicate protection: a turn's `clientTurnId` is minted once per send and
 * reused on retry, so the server replays the stored reply instead of running
 * the model twice.
 */
import React from 'react';
import { classifyConciergeError, conciergeApi, type ConciergeErrorKind } from '@/services/concierge/conciergeApi';
import type {
  ConciergeAssistantTurn,
  ConciergeChatItem,
  ConciergeClientContext,
  ConciergeConversationSummary,
  ConciergeStoredMessage,
} from '@/services/concierge/conciergeTypes';

function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // RFC4122-shaped fallback (Hermes without crypto.randomUUID).
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const s = (n: number) => Array.from({ length: n }, hex).join('');
  return `${s(8)}-${s(4)}-4${s(3)}-${((Math.random() * 4) | 8).toString(16)}${s(3)}-${s(12)}`;
}

export interface ConciergeState {
  conversationId: string | null;
  items: ConciergeChatItem[];
  sending: boolean;
  loadingTranscript: boolean;
  history: { list: ConciergeConversationSummary[]; loading: boolean; error: ConciergeErrorKind | null };
}

type Act =
  | { type: 'reset' }
  | { type: 'append'; item: ConciergeChatItem }
  | { type: 'remove'; id: string }
  | { type: 'sending'; value: boolean }
  | { type: 'conversation'; id: string | null }
  | { type: 'transcript'; id: string; items: ConciergeChatItem[] }
  | { type: 'loadingTranscript'; value: boolean }
  | { type: 'history'; patch: Partial<ConciergeState['history']> };

const initial: ConciergeState = {
  conversationId: null,
  items: [],
  sending: false,
  loadingTranscript: false,
  history: { list: [], loading: false, error: null },
};

function reducer(s: ConciergeState, a: Act): ConciergeState {
  switch (a.type) {
    case 'reset':
      return { ...initial, history: s.history };
    case 'append':
      return { ...s, items: [...s.items, a.item] };
    case 'remove':
      return { ...s, items: s.items.filter((i) => i.id !== a.id) };
    case 'sending':
      return { ...s, sending: a.value };
    case 'conversation':
      return { ...s, conversationId: a.id };
    case 'transcript':
      return { ...s, conversationId: a.id, items: a.items, loadingTranscript: false };
    case 'loadingTranscript':
      return { ...s, loadingTranscript: a.value };
    case 'history':
      return { ...s, history: { ...s.history, ...a.patch } };
  }
}

/** Map stored rows → chat items (assistant turns come back as their content). */
export function itemsFromStored(messages: ConciergeStoredMessage[]): ConciergeChatItem[] {
  const out: ConciergeChatItem[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({
        id: m.id,
        role: 'user',
        text: String(m.content['text'] ?? ''),
        clientTurnId: String(m.content['clientTurnId'] ?? m.id),
        createdAt: m.createdAt,
      });
    } else {
      out.push({ id: m.id, role: 'assistant', turn: m.content as unknown as ConciergeAssistantTurn, createdAt: m.createdAt });
    }
  }
  return out;
}

export function localKindFor(kind: ConciergeErrorKind): 'offline' | 'error' | 'rate_limited' | 'daily_limit' {
  if (kind === 'offline') return 'offline';
  if (kind === 'rate_limited') return 'rate_limited';
  if (kind === 'daily_limit') return 'daily_limit';
  return 'error';
}

export function useConciergeConversation(buildContext: () => ConciergeClientContext) {
  const [state, dispatch] = React.useReducer(reducer, initial);
  const abortRef = React.useRef<AbortController | null>(null);
  const conversationRef = React.useRef<string | null>(null);
  const mounted = React.useRef(true);
  React.useEffect(() => () => {
    mounted.current = false;
    abortRef.current?.abort();
  }, []);

  const setConversation = (id: string | null) => {
    conversationRef.current = id;
    dispatch({ type: 'conversation', id });
  };

  const cancel = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: 'sending', value: false });
  }, []);

  const sendTurn = React.useCallback(
    async (text: string, clientTurnId: string, userItemId: string) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      dispatch({ type: 'sending', value: true });
      try {
        const res = await conciergeApi.sendMessage(
          {
            ...(conversationRef.current ? { conversationId: conversationRef.current } : {}),
            clientTurnId,
            message: text,
            context: buildContext(),
          },
          controller.signal,
        );
        if (!mounted.current || controller.signal.aborted) return;
        if (conversationRef.current !== res.conversationId) setConversation(res.conversationId);
        dispatch({
          type: 'append',
          item: { id: `${userItemId}.reply`, role: 'assistant', turn: res.turn, createdAt: new Date().toISOString() },
        });
      } catch (err) {
        if (!mounted.current) return;
        const kind = classifyConciergeError(err);
        if (kind === 'cancelled') return;
        if (kind === 'not_found') {
          // Conversation vanished (deleted elsewhere) — start fresh without losing the text.
          setConversation(null);
        }
        dispatch({
          type: 'append',
          item: {
            id: `${userItemId}.error`,
            role: 'local',
            kind: localKindFor(kind),
            retryOf: userItemId,
            createdAt: new Date().toISOString(),
          },
        });
      } finally {
        if (mounted.current && abortRef.current === controller) {
          abortRef.current = null;
          dispatch({ type: 'sending', value: false });
        }
      }
    },
    [buildContext],
  );

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || state.sending) return;
      const clientTurnId = uuid();
      const id = uuid();
      dispatch({
        type: 'append',
        item: { id, role: 'user', text: trimmed, clientTurnId, createdAt: new Date().toISOString() },
      });
      await sendTurn(trimmed, clientTurnId, id);
    },
    [sendTurn, state.sending],
  );

  const retry = React.useCallback(
    async (localItemId: string) => {
      const local = state.items.find((i) => i.id === localItemId);
      if (!local || local.role !== 'local' || !local.retryOf) return;
      const user = state.items.find((i) => i.id === local.retryOf);
      if (!user || user.role !== 'user') return;
      dispatch({ type: 'remove', id: localItemId });
      await sendTurn(user.text, user.clientTurnId, user.id);
    },
    [sendTurn, state.items],
  );

  const newChat = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setConversation(null);
    dispatch({ type: 'reset' });
  }, []);

  const refreshHistory = React.useCallback(async () => {
    dispatch({ type: 'history', patch: { loading: true, error: null } });
    try {
      const res = await conciergeApi.listConversations();
      if (!mounted.current) return;
      dispatch({ type: 'history', patch: { list: res.conversations, loading: false } });
    } catch (err) {
      if (!mounted.current) return;
      dispatch({ type: 'history', patch: { loading: false, error: classifyConciergeError(err) } });
    }
  }, []);

  const open = React.useCallback(async (conversationId: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: 'loadingTranscript', value: true });
    try {
      const res = await conciergeApi.getConversation(conversationId);
      if (!mounted.current) return;
      conversationRef.current = res.conversation.id;
      dispatch({ type: 'transcript', id: res.conversation.id, items: itemsFromStored(res.messages) });
    } catch (err) {
      if (!mounted.current) return;
      dispatch({ type: 'loadingTranscript', value: false });
      dispatch({ type: 'history', patch: { error: classifyConciergeError(err) } });
    }
  }, []);

  const deleteConversation = React.useCallback(
    async (conversationId: string) => {
      try {
        await conciergeApi.deleteConversation(conversationId);
      } catch (err) {
        if (classifyConciergeError(err) !== 'not_found') throw err;
      }
      if (!mounted.current) return;
      if (conversationRef.current === conversationId) {
        setConversation(null);
        dispatch({ type: 'reset' });
      }
      dispatch({
        type: 'history',
        patch: { list: state.history.list.filter((c) => c.id !== conversationId) },
      });
    },
    [state.history.list],
  );

  const deleteAll = React.useCallback(async () => {
    await conciergeApi.deleteAllConversations();
    if (!mounted.current) return;
    setConversation(null);
    dispatch({ type: 'reset' });
    dispatch({ type: 'history', patch: { list: [] } });
  }, []);

  return {
    state,
    send,
    retry,
    cancel,
    newChat,
    open,
    refreshHistory,
    deleteConversation,
    deleteAll,
  };
}

export type ConciergeConversation = ReturnType<typeof useConciergeConversation>;
