import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import type { Language } from '../../../shared/enums';
import type {
  ChatMessageTable,
  ChatSessionTable,
  Database,
} from '../../db/schema';

export type ChatSessionRow = Selectable<ChatSessionTable>;
export type ChatMessageRow = Selectable<ChatMessageTable>;

export type ChatSessionListRow = ChatSessionRow & {
  message_count: number;
  last_message_at: string | null;
};

/**
 * Chat persistence (AGENTS.md §8). Ownership is enforced by filtering on
 * `citizen_id` in every query; the service never trusts an id alone.
 */
export function createChatRepo(db: Kysely<Database>) {
  return {
    async createSession(input: {
      citizenId: number;
      language: Language;
      startTime: string;
    }): Promise<ChatSessionRow> {
      return db
        .insertInto('Chat_Session')
        .values({
          citizen_id: input.citizenId,
          language: input.language,
          start_time: input.startTime,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findOwnedSession(
      citizenId: number,
      sessionId: number,
    ): Promise<ChatSessionRow | undefined> {
      return db
        .selectFrom('Chat_Session')
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('citizen_id', '=', citizenId)
        .executeTakeFirst();
    },

    async findSessionById(sessionId: number): Promise<ChatSessionRow | undefined> {
      return db
        .selectFrom('Chat_Session')
        .selectAll()
        .where('session_id', '=', sessionId)
        .executeTakeFirst();
    },

    async listSessions(citizenId: number, limit = 30): Promise<ChatSessionListRow[]> {
      return db
        .selectFrom('Chat_Session')
        .leftJoin('Chat_Message', 'Chat_Message.session_id', 'Chat_Session.session_id')
        .selectAll('Chat_Session')
        .select((eb) => [
          eb.fn.count<number>('Chat_Message.message_id').as('message_count'),
          eb.fn.max('Chat_Message.timestamp').as('last_message_at'),
        ])
        .where('Chat_Session.citizen_id', '=', citizenId)
        .groupBy('Chat_Session.session_id')
        .orderBy('Chat_Session.start_time', 'desc')
        .orderBy('Chat_Session.session_id', 'desc')
        .limit(limit)
        .execute();
    },

    async endSession(citizenId: number, sessionId: number, at: string): Promise<boolean> {
      const result = await db
        .updateTable('Chat_Session')
        .set({ end_time: at })
        .where('session_id', '=', sessionId)
        .where('citizen_id', '=', citizenId)
        .where('end_time', 'is', null)
        .executeTakeFirst();

      return Number(result.numUpdatedRows ?? 0) > 0;
    },

    async addMessage(input: {
      sessionId: number;
      question: string;
      answer: string;
      sourcesCited: string | null;
      timestamp: string;
    }): Promise<ChatMessageRow> {
      return db
        .insertInto('Chat_Message')
        .values({
          session_id: input.sessionId,
          question: input.question,
          answer: input.answer,
          sources_cited: input.sourcesCited,
          timestamp: input.timestamp,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async listMessages(sessionId: number): Promise<ChatMessageRow[]> {
      return db
        .selectFrom('Chat_Message')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('message_id', 'asc')
        .execute();
    },

    async latestMessage(sessionId: number): Promise<ChatMessageRow | undefined> {
      return db
        .selectFrom('Chat_Message')
        .selectAll()
        .where('session_id', '=', sessionId)
        .orderBy('message_id', 'desc')
        .executeTakeFirst();
    },

    async searchMessages(
      citizenId: number,
      query: string,
      limit = 20,
    ): Promise<ChatMessageRow[]> {
      const pattern = `%${query}%`;
      return db
        .selectFrom('Chat_Message')
        .innerJoin('Chat_Session', 'Chat_Session.session_id', 'Chat_Message.session_id')
        .selectAll('Chat_Message')
        .where('Chat_Session.citizen_id', '=', citizenId)
        .where((eb) =>
          eb.or([
            eb('Chat_Message.question', 'like', pattern),
            eb('Chat_Message.answer', 'like', pattern),
          ]),
        )
        .orderBy('Chat_Message.timestamp', 'desc')
        .orderBy('Chat_Message.message_id', 'desc')
        .limit(limit)
        .execute();
    },
  };
}

export type ChatRepo = ReturnType<typeof createChatRepo>;
