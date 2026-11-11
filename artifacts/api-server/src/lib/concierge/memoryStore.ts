/**
 * AForce Concierge — in-memory ConciergeStore.
 *
 * Used by the unit lane (no Postgres) and by local runs before the concierge
 * tables have been pushed (`CONCIERGE_STORE_DRIVER=memory`). Same isolation
 * contract as the Drizzle repo: every lookup is keyed by userId first, so a
 * foreign conversation id is simply absent.
 */
import type {
  ConciergeConversationSummary,
  ConciergePreferencesRecord,
  ConciergeStore,
  ConciergeStoredMessage,
} from "@workspace/db";
import type { ConciergePreferencesJson } from "@workspace/db";

interface UserBucket {
  conversations: Map<string, ConciergeConversationSummary>;
  messages: Map<string, ConciergeStoredMessage[]>;
  prefs: ConciergePreferencesRecord | null;
}

export function createMemoryConciergeStore(): ConciergeStore {
  const users = new Map<string, UserBucket>();
  const bucket = (userId: string): UserBucket => {
    let b = users.get(userId);
    if (!b) {
      b = { conversations: new Map(), messages: new Map(), prefs: null };
      users.set(userId, b);
    }
    return b;
  };

  return {
    async listConversations(userId, limit) {
      return [...bucket(userId).conversations.values()]
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, limit);
    },
    async getConversation(userId, conversationId) {
      return bucket(userId).conversations.get(conversationId) ?? null;
    },
    async createConversation(userId, id, title) {
      const now = new Date().toISOString();
      const row = { id, title, createdAt: now, updatedAt: now };
      bucket(userId).conversations.set(id, row);
      bucket(userId).messages.set(id, []);
      return row;
    },
    async touchConversation(userId, conversationId, title) {
      const row = bucket(userId).conversations.get(conversationId);
      if (!row) return;
      row.updatedAt = new Date().toISOString();
      if (title !== undefined) row.title = title;
    },
    async deleteConversation(userId, conversationId) {
      const b = bucket(userId);
      const existed = b.conversations.delete(conversationId);
      b.messages.delete(conversationId);
      return existed;
    },
    async deleteAllConversations(userId) {
      const b = bucket(userId);
      const n = b.conversations.size;
      b.conversations.clear();
      b.messages.clear();
      return n;
    },
    async listMessages(userId, conversationId, limit) {
      const all = bucket(userId).messages.get(conversationId) ?? [];
      return all.slice(Math.max(0, all.length - limit));
    },
    async appendMessage(userId, message) {
      const b = bucket(userId);
      if (!b.conversations.has(message.conversationId)) return;
      const list = b.messages.get(message.conversationId) ?? [];
      list.push(message);
      b.messages.set(message.conversationId, list);
    },
    async getPreferences(userId) {
      return bucket(userId).prefs;
    },
    async setPreferences(userId, prefs: ConciergePreferencesJson, consentAt) {
      const rec = { prefs, consentAt, updatedAt: new Date().toISOString() };
      bucket(userId).prefs = rec;
      return rec;
    },
    async deletePreferences(userId) {
      const b = bucket(userId);
      const had = b.prefs !== null;
      b.prefs = null;
      return had;
    },
    async purgeUser(userId) {
      users.delete(userId);
    },
  };
}
