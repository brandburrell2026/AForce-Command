/**
 * AForce Concierge — repository (Section 64 surface).
 *
 * `ConciergeStore` is the one interface the api-server routes talk to. Two
 * implementations exist:
 *   - `createConciergeRepo(db)` here: Drizzle over Postgres (production).
 *   - `createMemoryConciergeStore()` in api-server lib/concierge/memoryStore.ts:
 *     process-local, for tests and for local runs before the schema is pushed.
 *
 * Isolation invariant: EVERY query is scoped by `userId`. A conversation id
 * belonging to another member reads as "not found" — never as "forbidden",
 * which would confirm the id exists.
 */
import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  aforceConciergeConversations,
  aforceConciergeMessages,
  aforceConciergePreferences,
  type ConciergeMessageRole,
  type ConciergePreferencesJson,
} from "./schema/concierge";

export interface ConciergeConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConciergeStoredMessage {
  id: string;
  conversationId: string;
  role: ConciergeMessageRole;
  content: Record<string, unknown>;
  createdAt: string;
}

export interface ConciergePreferencesRecord {
  prefs: ConciergePreferencesJson;
  consentAt: string | null;
  updatedAt: string;
}

export interface ConciergeStore {
  listConversations(userId: string, limit: number): Promise<ConciergeConversationSummary[]>;
  getConversation(userId: string, conversationId: string): Promise<ConciergeConversationSummary | null>;
  createConversation(userId: string, id: string, title: string | null): Promise<ConciergeConversationSummary>;
  touchConversation(userId: string, conversationId: string, title?: string | null): Promise<void>;
  deleteConversation(userId: string, conversationId: string): Promise<boolean>;
  deleteAllConversations(userId: string): Promise<number>;
  listMessages(userId: string, conversationId: string, limit: number): Promise<ConciergeStoredMessage[]>;
  appendMessage(userId: string, message: ConciergeStoredMessage): Promise<void>;
  getPreferences(userId: string): Promise<ConciergePreferencesRecord | null>;
  setPreferences(userId: string, prefs: ConciergePreferencesJson, consentAt: string | null): Promise<ConciergePreferencesRecord>;
  deletePreferences(userId: string): Promise<boolean>;
  /** Account-deletion cascade: everything for the member, all three tables. */
  purgeUser(userId: string): Promise<void>;
}

const iso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export function createConciergeRepo(
  dbx: NodePgDatabase<Record<string, unknown>>,
): ConciergeStore {
  return {
    async listConversations(userId, limit) {
      const rows = await dbx
        .select()
        .from(aforceConciergeConversations)
        .where(eq(aforceConciergeConversations.userId, userId))
        .orderBy(desc(aforceConciergeConversations.updatedAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
      }));
    },

    async getConversation(userId, conversationId) {
      const rows = await dbx
        .select()
        .from(aforceConciergeConversations)
        .where(
          and(
            eq(aforceConciergeConversations.userId, userId),
            eq(aforceConciergeConversations.id, conversationId),
          ),
        )
        .limit(1);
      const r = rows[0];
      if (!r) return null;
      return { id: r.id, title: r.title, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt) };
    },

    async createConversation(userId, id, title) {
      const now = new Date();
      await dbx
        .insert(aforceConciergeConversations)
        .values({ id, userId, title, createdAt: now, updatedAt: now });
      return { id, title, createdAt: now.toISOString(), updatedAt: now.toISOString() };
    },

    async touchConversation(userId, conversationId, title) {
      await dbx
        .update(aforceConciergeConversations)
        .set({ updatedAt: new Date(), ...(title !== undefined ? { title } : {}) })
        .where(
          and(
            eq(aforceConciergeConversations.userId, userId),
            eq(aforceConciergeConversations.id, conversationId),
          ),
        );
    },

    async deleteConversation(userId, conversationId) {
      const deleted = await dbx
        .delete(aforceConciergeConversations)
        .where(
          and(
            eq(aforceConciergeConversations.userId, userId),
            eq(aforceConciergeConversations.id, conversationId),
          ),
        )
        .returning({ id: aforceConciergeConversations.id });
      if (deleted.length === 0) return false;
      await dbx
        .delete(aforceConciergeMessages)
        .where(
          and(
            eq(aforceConciergeMessages.userId, userId),
            eq(aforceConciergeMessages.conversationId, conversationId),
          ),
        );
      return true;
    },

    async deleteAllConversations(userId) {
      const deleted = await dbx
        .delete(aforceConciergeConversations)
        .where(eq(aforceConciergeConversations.userId, userId))
        .returning({ id: aforceConciergeConversations.id });
      await dbx.delete(aforceConciergeMessages).where(eq(aforceConciergeMessages.userId, userId));
      return deleted.length;
    },

    async listMessages(userId, conversationId, limit) {
      // Newest `limit` rows, returned oldest → newest for the transcript.
      const rows = await dbx
        .select()
        .from(aforceConciergeMessages)
        .where(
          and(
            eq(aforceConciergeMessages.userId, userId),
            eq(aforceConciergeMessages.conversationId, conversationId),
          ),
        )
        .orderBy(desc(aforceConciergeMessages.createdAt), desc(aforceConciergeMessages.id))
        .limit(limit);
      return rows
        .reverse()
        .map((r) => ({
          id: r.id,
          conversationId: r.conversationId,
          role: r.role,
          content: r.content,
          createdAt: iso(r.createdAt),
        }));
    },

    async appendMessage(userId, message) {
      await dbx.insert(aforceConciergeMessages).values({
        id: message.id,
        conversationId: message.conversationId,
        userId,
        role: message.role,
        content: message.content,
        createdAt: new Date(message.createdAt),
      });
    },

    async getPreferences(userId) {
      const rows = await dbx
        .select()
        .from(aforceConciergePreferences)
        .where(eq(aforceConciergePreferences.userId, userId))
        .limit(1);
      const r = rows[0];
      if (!r) return null;
      return {
        prefs: r.prefs,
        consentAt: r.consentAt ? iso(r.consentAt) : null,
        updatedAt: iso(r.updatedAt),
      };
    },

    async setPreferences(userId, prefs, consentAt) {
      const now = new Date();
      const consent = consentAt ? new Date(consentAt) : null;
      await dbx
        .insert(aforceConciergePreferences)
        .values({ userId, prefs, consentAt: consent, updatedAt: now })
        .onConflictDoUpdate({
          target: aforceConciergePreferences.userId,
          set: { prefs, consentAt: consent, updatedAt: now },
        });
      return { prefs, consentAt: consent ? consent.toISOString() : null, updatedAt: now.toISOString() };
    },

    async deletePreferences(userId) {
      const deleted = await dbx
        .delete(aforceConciergePreferences)
        .where(eq(aforceConciergePreferences.userId, userId))
        .returning({ userId: aforceConciergePreferences.userId });
      return deleted.length > 0;
    },

    async purgeUser(userId) {
      await dbx.delete(aforceConciergeMessages).where(eq(aforceConciergeMessages.userId, userId));
      await dbx
        .delete(aforceConciergeConversations)
        .where(eq(aforceConciergeConversations.userId, userId));
      await dbx
        .delete(aforceConciergePreferences)
        .where(eq(aforceConciergePreferences.userId, userId));
    },
  };
}
