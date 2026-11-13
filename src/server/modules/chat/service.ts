import 'server-only';

import { formatMessage, getDictionary, type Locale } from '../../../i18n';
import type { Language } from '../../../shared/enums';
import {
  validateChatHistoryQuery,
  validateChatQuestion,
  validateChatRatingInput,
  validateChatSessionInput,
} from '../../../shared/validation';
import type { AiProvider, AnswerPassage } from '../../adapters/ai/provider';
import { getEnv } from '../../config/env';
import type { Repositories } from '../../db/repositories';
import type { Clock } from '../../lib/clock';
import { AppError, notFound, validationFailed } from '../../lib/errors';
import type { ChatMessageRow, ChatSessionListRow, ChatSessionRow } from './repo';
import { rankByEmbedding, rankLexically, selectGrounded, type RankedGuide } from './retrieval';

/**
 * Chatbot business rules (AGENTS.md §8, UC-02).
 *
 * Flow: validate → retrieve curator-validated passages (session language, then
 * the other language) → answer only from those passages → persist the exchange
 * with compact source refs → record latency and grounding metrics. Ownership is
 * checked on every session operation; a citizen never sees another citizen's
 * chat, including through history search.
 */

export interface ChatSourceDto {
  guideId: number;
  title: string;
  category: string;
  statute: string;
}

export interface ChatMessageDto {
  id: number;
  question: string;
  answer: string;
  grounded: boolean;
  sources: ChatSourceDto[];
  timestamp: string;
}

export interface ChatSessionSummaryDto {
  id: number;
  language: Language;
  startTime: string;
  endTime: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  preview: string | null;
}

export interface ChatSessionDetailDto extends ChatSessionSummaryDto {
  messages: ChatMessageDto[];
  rating: number | null;
  escalated: boolean;
}

export interface ChatHistoryResultDto {
  messageId: number;
  sessionId: number;
  question: string;
  answer: string;
  timestamp: string;
}

export interface HelpRequestDto {
  sessionId: number;
  citizenName: string;
  preview: string;
  requestedAt: string;
}

export interface ChatAskResultDto {
  message: ChatMessageDto;
  grounded: boolean;
  demo: boolean;
}

export interface ChatService {
  readonly demoMode: boolean;
  createSession(
    citizenId: number,
    input: unknown,
    locale: Locale,
  ): Promise<ChatSessionSummaryDto>;
  listSessions(citizenId: number): Promise<ChatSessionSummaryDto[]>;
  getSession(citizenId: number, sessionId: number, locale: Locale): Promise<ChatSessionDetailDto>;
  ask(
    citizenId: number,
    sessionId: number,
    input: unknown,
    locale: Locale,
  ): Promise<ChatAskResultDto>;
  endSession(
    citizenId: number,
    sessionId: number,
    locale: Locale,
  ): Promise<ChatSessionSummaryDto>;
  searchHistory(citizenId: number, query: string | null): Promise<ChatHistoryResultDto[]>;
  rateSession(
    citizenId: number,
    sessionId: number,
    input: unknown,
    locale: Locale,
  ): Promise<{ rating: number }>;
  escalate(
    citizenId: number,
    sessionId: number,
    locale: Locale,
  ): Promise<{ notified: number; alreadyRequested: boolean }>;
  helpRequests(lawyerId: number): Promise<HelpRequestDto[]>;
}

const PREVIEW_CHARS = 90;

function truncate(value: string, max = PREVIEW_CHARS): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function parseCitedSources(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => /^g\d+$/.test(entry))
    .map((entry) => Number(entry.slice(1)))
    .filter((id, index, list) => id > 0 && list.indexOf(id) === index);
}

function toPassage(entry: RankedGuide): AnswerPassage {
  return {
    guideId: entry.row.guide_id,
    title: entry.row.title,
    category: entry.row.category,
    summary: entry.row.plain_summary,
    statute: entry.row.source_statute,
    excerpt: entry.row.source_excerpt,
  };
}

function toSourceDto(row: RankedGuide['row']): ChatSourceDto {
  return {
    guideId: row.guide_id,
    title: row.title,
    category: row.category,
    statute: row.source_statute,
  };
}

function summariseSession(
  row: ChatSessionRow,
  messageCount: number,
  lastMessageAt: string | null,
  preview: string | null,
): ChatSessionSummaryDto {
  return {
    id: row.session_id,
    language: row.language,
    startTime: row.start_time,
    endTime: row.end_time,
    messageCount,
    lastMessageAt,
    preview,
  };
}

export function createChatService(options: {
  repos: Repositories;
  clock: Clock;
  ai: AiProvider;
}): ChatService {
  const { repos, clock, ai } = options;

  function sessionNotFound(locale: Locale): AppError {
    return new AppError('NOT_FOUND', getDictionary(locale).chat.sessionNotFound);
  }

  async function requireOwnedSession(
    citizenId: number,
    sessionId: number,
    locale: Locale,
  ): Promise<ChatSessionRow> {
    const row = await repos.chat.findOwnedSession(citizenId, sessionId);
    if (!row) throw sessionNotFound(locale);
    return row;
  }

  async function summaryFor(
    row: ChatSessionRow,
    messageCount?: number,
    lastMessageAt?: string | null,
  ): Promise<ChatSessionSummaryDto> {
    const latest = await repos.chat.latestMessage(row.session_id);
    return summariseSession(
      row,
      messageCount ?? (latest ? 1 : 0),
      lastMessageAt ?? latest?.timestamp ?? null,
      latest ? truncate(latest.question) : null,
    );
  }

  async function summaryFromListRow(row: ChatSessionListRow): Promise<ChatSessionSummaryDto> {
    const latest = await repos.chat.latestMessage(row.session_id);
    return summariseSession(
      row,
      Number(row.message_count),
      row.last_message_at ?? null,
      latest ? truncate(latest.question) : null,
    );
  }

  async function rank(
    question: string,
    language: Language,
  ): Promise<RankedGuide[]> {
    const topK = getEnv().RAG_TOP_K;
    const similarityThreshold = await repos.settings.getNumber('rag_similarity_threshold', 0.35);
    const lexicalThreshold = await repos.settings.getNumber('rag_lexical_threshold', 3);
    const candidates = await repos.guides.listValidWithEmbeddings(language);
    if (candidates.length === 0) return [];

    if (ai.demo) {
      return selectGrounded(rankLexically(question, candidates), lexicalThreshold, topK);
    }

    const embedding = await ai.embed([question], { purpose: 'query' });
    const queryVector = embedding.vectors[0];
    const byVector = queryVector
      ? selectGrounded(
          rankByEmbedding(queryVector, embedding.model, candidates),
          similarityThreshold,
          topK,
        )
      : [];

    // A stale lexical index (for example a database seeded offline and then
    // given a Gemini key) must not silence the chatbot.
    if (byVector.length > 0) return byVector;
    return selectGrounded(rankLexically(question, candidates), lexicalThreshold, topK);
  }

  /** Retrieval with the language fallback required by AGENTS.md §8. */
  async function retrieve(question: string, language: Language): Promise<RankedGuide[]> {
    const primary = await rank(question, language);
    if (primary.length > 0) return primary;

    const fallback: Language = language === 'English' ? 'Hindi' : 'English';
    return rank(question, fallback);
  }

  async function resolveMessageSources(
    rows: ChatMessageRow[],
  ): Promise<Map<number, ChatSourceDto[]>> {
    const ids = [...new Set(rows.flatMap((row) => parseCitedSources(row.sources_cited)))];
    const guides = await repos.guides.findByIds(ids);
    const byId = new Map(guides.map((guide) => [guide.guide_id, guide]));

    const result = new Map<number, ChatSourceDto[]>();
    for (const row of rows) {
      const sources = parseCitedSources(row.sources_cited)
        .map((id) => byId.get(id))
        .filter((guide) => guide !== undefined)
        .map((guide) => toSourceDto(guide));
      result.set(row.message_id, sources);
    }
    return result;
  }

  function toMessageDto(row: ChatMessageRow, sources: ChatSourceDto[]): ChatMessageDto {
    return {
      id: row.message_id,
      question: row.question,
      answer: row.answer,
      grounded: sources.length > 0,
      sources,
      timestamp: row.timestamp,
    };
  }

  return {
    demoMode: ai.demo,

    async createSession(citizenId, input, locale) {
      const validation = validateChatSessionInput(input, locale);
      if (!validation.ok) throw validationFailed(validation.errors);

      const user = await repos.users.findById(citizenId);
      if (!user) throw notFound(getDictionary(locale).chat.sessionNotFound);

      const row = await repos.chat.createSession({
        citizenId,
        language: validation.value.language ?? user.language,
        startTime: clock.nowIso(),
      });

      return summaryFor(row, 0, null);
    },

    async listSessions(citizenId) {
      const rows = await repos.chat.listSessions(citizenId);
      return Promise.all(rows.map(summaryFromListRow));
    },

    async getSession(citizenId, sessionId, locale) {
      const row = await requireOwnedSession(citizenId, sessionId, locale);
      const messages = await repos.chat.listMessages(sessionId);
      const sources = await resolveMessageSources(messages);
      const [rating, escalation] = await Promise.all([
        repos.metrics.findForRef('chat_csat', `session:${sessionId}`),
        repos.metrics.findForRef('chat_escalation', String(sessionId)),
      ]);

      const summary = await summaryFor(row, messages.length, messages.at(-1)?.timestamp ?? null);
      return {
        ...summary,
        messages: messages.map((message) =>
          toMessageDto(message, sources.get(message.message_id) ?? []),
        ),
        rating: rating ? Math.round(rating.value) : null,
        escalated: escalation !== undefined,
      };
    },

    async ask(citizenId, sessionId, input, locale) {
      const validation = validateChatQuestion(input, locale);
      if (!validation.ok) throw validationFailed(validation.errors);

      const dictionary = getDictionary(locale);
      const session = await requireOwnedSession(citizenId, sessionId, locale);
      if (session.end_time) {
        throw new AppError('CONFLICT', dictionary.chat.sessionEnded);
      }

      const startedAt = Date.now();
      const ranked = await retrieve(validation.value.question, session.language);
      const grounded = ranked.length > 0;

      let answer = dictionary.chat.ungroundedAnswer;
      if (grounded) {
        const generated = await ai.generateAnswer({
          question: validation.value.question,
          language: session.language,
          passages: ranked.map(toPassage),
        });
        answer = generated.text.trim();
        if (answer.length === 0) {
          throw new AppError('AI_UNAVAILABLE', dictionary.chat.aiUnavailable);
        }
      }

      const timestamp = clock.nowIso();
      const message = await repos.chat.addMessage({
        sessionId,
        question: validation.value.question,
        answer,
        sourcesCited: grounded ? ranked.map((entry) => `g${entry.row.guide_id}`).join(';') : null,
        timestamp,
      });

      const latencyMs = Date.now() - startedAt;
      await repos.metrics.record({
        metric: 'chat_latency_ms',
        value: latencyMs,
        refId: `message:${message.message_id}`,
        at: timestamp,
      });
      await repos.metrics.record({
        metric: 'chat_grounded',
        value: grounded ? 1 : 0,
        refId: `message:${message.message_id}`,
        at: timestamp,
      });

      const sources = grounded ? ranked.map((entry) => toSourceDto(entry.row)) : [];
      return {
        message: toMessageDto(message, sources),
        grounded,
        demo: ai.demo,
      };
    },

    async endSession(citizenId, sessionId, locale) {
      const session = await requireOwnedSession(citizenId, sessionId, locale);
      if (!session.end_time) {
        await repos.chat.endSession(citizenId, sessionId, clock.nowIso());
      }
      const updated = await requireOwnedSession(citizenId, sessionId, locale);
      return summaryFor(updated);
    },

    async searchHistory(citizenId, query) {
      const term = validateChatHistoryQuery(query);
      if (term.length < 2) return [];

      const rows = await repos.chat.searchMessages(citizenId, term);
      return rows.map((row) => ({
        messageId: row.message_id,
        sessionId: row.session_id,
        question: row.question,
        answer: row.answer,
        timestamp: row.timestamp,
      }));
    },

    async rateSession(citizenId, sessionId, input, locale) {
      await requireOwnedSession(citizenId, sessionId, locale);
      const validation = validateChatRatingInput(input, locale);
      if (!validation.ok) throw validationFailed(validation.errors);

      await repos.metrics.upsert({
        metric: 'chat_csat',
        value: validation.value.rating,
        refId: `session:${sessionId}`,
        at: clock.nowIso(),
      });

      return { rating: validation.value.rating };
    },

    async escalate(citizenId, sessionId, locale) {
      await requireOwnedSession(citizenId, sessionId, locale);
      const existing = await repos.metrics.findForRef('chat_escalation', String(sessionId));
      if (existing) return { notified: 0, alreadyRequested: true };

      const [citizen, lawyers, latest] = await Promise.all([
        repos.users.findById(citizenId),
        repos.users.availableLawyers(),
        repos.chat.latestMessage(sessionId),
      ]);

      const at = clock.nowIso();
      const preview = latest ? truncate(latest.question, 80) : '';

      for (const lawyer of lawyers) {
        const lawyerLocale: Locale = lawyer.language === 'Hindi' ? 'hi' : 'en';
        const dictionary = getDictionary(lawyerLocale);
        const message = formatMessage(dictionary.notifications.helpRequest, {
          name: citizen?.name ?? dictionary.roles.Citizen,
          preview,
        }).slice(0, 255);

        await repos.notifications.create({
          userId: lawyer.userId,
          message,
          channel: 'In-App',
          status: 'Unread',
          timestamp: at,
        });

        // A per-lawyer event powers the "Help requests" list on the lawyer
        // dashboard; the notification alone cannot be filtered by origin.
        await repos.metrics.record({
          metric: 'help_request',
          value: 1,
          refId: `lawyer:${lawyer.userId}:session:${sessionId}`,
          at,
        });
      }

      await repos.metrics.upsert({
        metric: 'chat_escalation',
        value: 1,
        refId: String(sessionId),
        at,
      });

      return { notified: lawyers.length, alreadyRequested: false };
    },

    async helpRequests(lawyerId) {
      const events = await repos.metrics.listByRefPrefix(
        'help_request',
        `lawyer:${lawyerId}:session:`,
      );

      const requests: HelpRequestDto[] = [];
      for (const event of events) {
        const sessionId = Number(event.ref_id?.split(':').pop());
        if (!Number.isInteger(sessionId) || sessionId < 1) continue;

        const session = await repos.chat.findSessionById(sessionId);
        if (!session) continue;

        const [citizen, latest] = await Promise.all([
          repos.users.findById(session.citizen_id),
          repos.chat.latestMessage(sessionId),
        ]);

        requests.push({
          sessionId,
          citizenName: citizen?.name ?? '',
          preview: latest ? truncate(latest.question, 90) : '',
          requestedAt: event.created_at,
        });
      }

      return requests;
    },
  };
}
