'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormAlert } from '../../components/ui/FormAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { formatMessage, type Dictionary, type Locale } from '../../i18n';
import type { Language } from '../../shared/enums';
import { CHAT_QUESTION_MAX, charCount } from '../../shared/validation';
import { ApiRequestError, apiRequest } from '../auth/api';

/**
 * Chatbot workspace (AGENTS.md §8, §15, UC-02).
 *
 * The thread is server state (TanStack Query): a session list on the left, the
 * open conversation on the right. Answers only ever come from curator-validated
 * guides and carry source chips back to the guide page. "Ask a lawyer",
 * end-session and the 1–5 CSAT prompt complete the journey.
 */

interface ChatSource {
  guideId: number;
  title: string;
  category: string;
  statute: string;
}

interface ChatMessage {
  id: number;
  question: string;
  answer: string;
  grounded: boolean;
  sources: ChatSource[];
  timestamp: string;
}

interface ChatSessionSummary {
  id: number;
  language: Language;
  startTime: string;
  endTime: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  preview: string | null;
}

interface ChatSessionDetail extends ChatSessionSummary {
  messages: ChatMessage[];
  rating: number | null;
  escalated: boolean;
}

interface SessionsResponse {
  sessions: ChatSessionSummary[];
  demo: boolean;
}

interface SessionResponse {
  session: ChatSessionDetail;
  demo: boolean;
}

interface SessionSummaryResponse {
  session: ChatSessionSummary;
  demo?: boolean;
}

interface AskResponse {
  message: ChatMessage;
  grounded: boolean;
  demo: boolean;
}

interface HistoryResult {
  messageId: number;
  sessionId: number;
  question: string;
  answer: string;
  timestamp: string;
}

interface Feedback {
  tone: 'success' | 'info' | 'danger';
  text: string;
}

function formatWhen(value: string, locale: Locale): string {
  const date = new Date(`${value.trim().replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function errorText(error: unknown, dict: Dictionary): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'RATE_LIMITED') return dict.chat.rateLimited;
    if (error.code === 'AI_UNAVAILABLE') return dict.chat.aiUnavailable;
    if (error.code === 'CONFLICT') return dict.chat.sessionEnded;
    if (error.status === 0) return dict.chat.errorGeneric;
    return error.message || dict.chat.errorGeneric;
  }
  return dict.chat.errorGeneric;
}

function SourceChips({
  sources,
  locale,
  dict,
}: {
  sources: ChatSource[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (sources.length === 0) {
    return <p className="mt-2 text-xs leading-5 text-muted">{dict.chat.ungroundedNote}</p>;
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {dict.chat.sourcesTitle}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <li key={source.guideId}>
            <Link
              href={{ pathname: `/knowledge/${source.guideId}`, query: { lang: locale } }}
              aria-label={`${dict.chat.readSource}: ${source.title}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-primary/30 bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23V5.5Zm16 0A2.5 2.5 0 0 0 17.5 3H12v18h5.5A2.5 2.5 0 0 1 20 23V5.5Z" />
              </svg>
              <span className="truncate">{source.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RatingPanel({ session, locale, dict }: { session: ChatSessionDetail; locale: Locale; dict: Dictionary }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const rate = useMutation({
    mutationFn: (rating: number) =>
      apiRequest<{ rating: number }>(`/api/chat/sessions/${session.id}/rating`, {
        method: 'POST',
        body: { rating },
        locale,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<SessionResponse>(['chat-session', session.id], (old) =>
        old ? { ...old, session: { ...old.session, rating: data.rating } } : old,
      );
      setFeedback(dict.chat.ratingThanks);
    },
    onError: () => setFeedback(dict.chat.ratingError),
  });

  return (
    <div className="mx-auto max-w-xl rounded-card border border-line bg-canvas px-5 py-5 text-center">
      <p className="font-serif text-lg text-ink">{dict.chat.rateTitle}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{dict.chat.rateBody}</p>
      <div className="mt-3 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => {
          const selected = (session.rating ?? 0) >= value;
          return (
            <button
              key={value}
              type="button"
              aria-label={formatMessage(dict.chat.rateLabel, { count: value })}
              aria-pressed={session.rating === value}
              disabled={rate.isPending}
              onClick={() => rate.mutate(value)}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-input text-2xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                selected ? 'text-warning' : 'text-muted hover:text-warning'
              }`}
            >
              <span aria-hidden="true">★</span>
            </button>
          );
        })}
      </div>
      {feedback ? (
        <p role="status" className="mt-2 text-sm font-medium text-success">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function ChatWorkspaceInner({
  locale,
  dict,
  defaultLanguage,
}: {
  locale: Locale;
  dict: Dictionary;
  defaultLanguage: Language;
}) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => apiRequest<SessionsResponse>('/api/chat/sessions', { method: 'GET', locale }),
  });

  const sessionQuery = useQuery({
    queryKey: ['chat-session', activeId],
    queryFn: () =>
      apiRequest<SessionResponse>(`/api/chat/sessions/${activeId}`, { method: 'GET', locale }),
    enabled: activeId !== null,
  });

  const searchQuery = useQuery({
    queryKey: ['chat-search', searchTerm],
    queryFn: () =>
      apiRequest<{ results: HistoryResult[] }>(
        `/api/chat/history/search?q=${encodeURIComponent(searchTerm)}`,
        { method: 'GET', locale },
      ),
    enabled: searchTerm.length >= 2,
  });

  const createSession = useMutation({
    mutationFn: () =>
      apiRequest<SessionResponse>('/api/chat/sessions', {
        method: 'POST',
        body: { language: defaultLanguage },
        locale,
      }),
    onSuccess: (data) => {
      setActiveId(data.session.id);
      setFeedback(null);
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (error) => setFeedback({ tone: 'danger', text: errorText(error, dict) }),
  });

  const send = useMutation({
    mutationFn: (variables: { sessionId: number; question: string }) =>
      apiRequest<AskResponse>(`/api/chat/sessions/${variables.sessionId}/messages`, {
        method: 'POST',
        body: { question: variables.question },
        locale,
      }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData<SessionResponse>(['chat-session', variables.sessionId], (old) =>
        old
          ? {
              ...old,
              session: {
                ...old.session,
                messages: [...old.session.messages, data.message],
                messageCount: old.session.messageCount + 1,
                lastMessageAt: data.message.timestamp,
                preview: data.message.question.slice(0, 90),
              },
            }
          : old,
      );
      setDraft('');
      setFeedback(null);
      void queryClient.invalidateQueries({ queryKey: ['chat-session', variables.sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (error) => setFeedback({ tone: 'danger', text: errorText(error, dict) }),
  });

  const endSession = useMutation({
    mutationFn: (sessionId: number) =>
      apiRequest<SessionSummaryResponse>(`/api/chat/sessions/${sessionId}/end`, {
        method: 'POST',
        locale,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<SessionResponse>(['chat-session', data.session.id], (old) =>
        old ? { ...old, session: { ...old.session, endTime: data.session.endTime } } : old,
      );
      setFeedback(null);
      void queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (error) => setFeedback({ tone: 'danger', text: errorText(error, dict) }),
  });

  const escalate = useMutation({
    mutationFn: (sessionId: number) =>
      apiRequest<{ notified: number; alreadyRequested: boolean }>(
        `/api/chat/sessions/${sessionId}/escalate`,
        { method: 'POST', locale },
      ),
    onSuccess: (data, sessionId) => {
      queryClient.setQueryData<SessionResponse>(['chat-session', sessionId], (old) =>
        old ? { ...old, session: { ...old.session, escalated: true } } : old,
      );
      setFeedback({
        tone: 'info',
        text: data.alreadyRequested ? dict.chat.lawyerAlreadyRequested : dict.chat.lawyerRequested,
      });
    },
    onError: () => setFeedback({ tone: 'danger', text: dict.chat.escalateError }),
  });

  const session = sessionQuery.data?.session ?? null;
  const sessions = sessionsQuery.data?.sessions ?? [];
  const demo = sessionsQuery.data?.demo ?? sessionQuery.data?.demo ?? false;
  const ended = session?.endTime !== null && session?.endTime !== undefined;
  const messages = session?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [activeId, messages.length, send.isPending]);

  function openSession(id: number): void {
    setActiveId(id);
    setHistoryOpen(false);
    setFeedback(null);
  }

  function submitQuestion(): void {
    const question = draft.trim();
    if (!question || activeId === null || send.isPending || ended) return;
    send.mutate({ sessionId: activeId, question });
  }

  async function startWithPrompt(prompt: string): Promise<void> {
    setFeedback(null);
    try {
      const id = activeId ?? (await createSession.mutateAsync()).session.id;
      send.mutate({ sessionId: id, question: prompt });
    } catch {
      // createSession.onError already surfaced the message.
    }
  }

  const suggestions = [
    dict.chat.suggestionOne,
    dict.chat.suggestionTwo,
    dict.chat.suggestionThree,
    dict.chat.suggestionFour,
  ];

  function renderHistory(): ReactNode {
    return (
      <div className="space-y-4">
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchTerm(searchInput.trim());
          }}
        >
          <label htmlFor="chat-history-search" className="text-sm font-medium text-ink">
            {dict.chat.historySearchLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="chat-history-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={dict.chat.historySearchPlaceholder}
              className="min-h-10 w-full rounded-input border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-primary"
            />
            <button type="submit" className={buttonClasses('secondary', 'sm')}>
              {dict.chat.historySearchAction}
            </button>
          </div>
          {searchTerm.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchInput('');
              }}
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              {dict.chat.searchClear}
            </button>
          ) : null}
        </form>

        {searchTerm.length >= 2 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {dict.chat.searchResultsTitle}
            </p>
            {searchQuery.isPending ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : searchQuery.isError ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {dict.chat.errorGeneric}
              </p>
            ) : (searchQuery.data?.results.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-muted">{dict.chat.searchNoResults}</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {searchQuery.data?.results.map((result) => (
                  <li key={result.messageId}>
                    <button
                      type="button"
                      onClick={() => openSession(result.sessionId)}
                      className="w-full rounded-input px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="line-clamp-2">{result.question}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {formatWhen(result.timestamp, locale)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {dict.chat.historyTitle}
            </p>
            {sessionsQuery.isPending ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : sessionsQuery.isError ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {dict.chat.loadError}
              </p>
            ) : sessions.length === 0 ? (
              <div className="mt-2 rounded-input border border-dashed border-line px-3 py-4">
                <p className="text-sm font-medium text-ink">{dict.chat.noSessionsTitle}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{dict.chat.noSessionsBody}</p>
              </div>
            ) : (
              <ul className="mt-2 space-y-1">
                {sessions.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => openSession(entry.id)}
                      aria-current={entry.id === activeId ? 'true' : undefined}
                      className={`w-full rounded-input px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        entry.id === activeId
                          ? 'bg-primary-tint'
                          : 'hover:bg-primary-tint/60'
                      }`}
                    >
                      <span className="line-clamp-2 text-sm leading-5 text-ink">
                        {entry.preview ?? dict.chat.previewFallback}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                        <span>{formatWhen(entry.lastMessageAt ?? entry.startTime, locale)}</span>
                        <span>{entry.language === 'Hindi' ? dict.common.hindi : dict.common.english}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {dict.chat.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{dict.chat.title}</h1>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">{dict.chat.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {demo ? <Badge tone="primary">{dict.chat.demoBadge}</Badge> : null}
          <button
            type="button"
            onClick={() => createSession.mutate()}
            disabled={createSession.isPending}
            className={buttonClasses('primary', 'sm')}
          >
            {createSession.isPending ? dict.chat.starting : dict.chat.newChat}
          </button>
        </div>
      </div>

      {demo ? (
        <p className="mt-2 text-xs leading-5 text-muted">{dict.chat.demoNote}</p>
      ) : null}

      {feedback ? (
        <div className="mt-4">
          <FormAlert tone={feedback.tone}>{feedback.text}</FormAlert>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[17rem_1fr]">
        <aside className="hidden lg:block">
          <Card>
            <CardBody>{renderHistory()}</CardBody>
          </Card>
        </aside>

        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen((value) => !value)}
            aria-expanded={historyOpen}
            className={buttonClasses('secondary', 'sm')}
          >
            {historyOpen ? dict.chat.closeHistory : dict.chat.openHistory}
          </button>
          {historyOpen ? (
            <Card className="mt-2">
              <CardBody>{renderHistory()}</CardBody>
            </Card>
          ) : null}
        </div>

        <Card className="flex min-h-[32rem] flex-col">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle as="h2" className="text-lg">
              {dict.chat.conversationTitle}
            </CardTitle>
            {session ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">
                  {session.language === 'Hindi' ? dict.common.hindi : dict.common.english}
                </Badge>
                <button
                  type="button"
                  onClick={() => escalate.mutate(session.id)}
                  disabled={escalate.isPending || session.escalated || messages.length === 0}
                  className={buttonClasses('secondary', 'sm')}
                >
                  {escalate.isPending ? dict.chat.askingLawyer : dict.chat.askLawyer}
                </button>
                {!ended ? (
                  <button
                    type="button"
                    onClick={() => endSession.mutate(session.id)}
                    disabled={endSession.isPending}
                    className={buttonClasses('ghost', 'sm')}
                  >
                    {endSession.isPending ? dict.chat.ending : dict.chat.endChat}
                  </button>
                ) : null}
              </div>
            ) : null}
          </CardHeader>

          <CardBody className="flex-1">
            {activeId === null ? (
              <div>
                <EmptyState
                  title={dict.chat.emptyTitle}
                  body={dict.chat.emptyBody}
                  icon={
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6Z" />
                    </svg>
                  }
                />
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {dict.chat.suggestionsTitle}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {suggestions.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void startWithPrompt(prompt)}
                        disabled={createSession.isPending || send.isPending}
                        className="rounded-input border border-line bg-canvas px-3.5 py-2.5 text-left text-sm leading-6 text-ink transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : sessionQuery.isPending ? (
              <div className="space-y-4" aria-busy="true">
                <Skeleton className="ml-auto h-16 w-3/4 max-w-sm" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="ml-auto h-12 w-2/3 max-w-xs" />
              </div>
            ) : sessionQuery.isError ? (
              <div className="space-y-3">
                <FormAlert>{dict.chat.sessionLoadError}</FormAlert>
                <button
                  type="button"
                  onClick={() => void sessionQuery.refetch()}
                  className={buttonClasses('secondary', 'sm')}
                >
                  {dict.error.retry}
                </button>
              </div>
            ) : session ? (
              <div aria-live="polite" aria-relevant="additions">
                {messages.length === 0 ? (
                  <div>
                    <p className="text-sm leading-6 text-muted">{dict.chat.emptyBody}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {suggestions.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void startWithPrompt(prompt)}
                          disabled={send.isPending}
                          className="rounded-input border border-line bg-canvas px-3.5 py-2.5 text-left text-sm leading-6 text-ink transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-6">
                  {messages.map((message) => (
                    <div key={message.id} className="space-y-3">
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-card rounded-br-sm bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">
                          <span className="sr-only">{dict.chat.youLabel}: </span>
                          {message.question}
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[92%] rounded-card rounded-bl-sm border border-line bg-surface px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {dict.chat.assistantLabel}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                            {message.answer}
                          </p>
                          <SourceChips sources={message.sources} locale={locale} dict={dict} />
                          <p className="mt-3 border-t border-line pt-2 text-xs leading-5 text-muted">
                            {dict.chat.answerDisclaimer}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {send.isPending ? (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-card rounded-br-sm bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground opacity-80">
                          <span className="sr-only">{dict.chat.youLabel}: </span>
                          {send.variables?.question}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <span
                          aria-hidden="true"
                          className="inline-flex gap-1"
                        >
                          <span className="h-1.5 w-1.5 animate-bounce rounded-pill bg-primary" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-pill bg-primary [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-pill bg-primary [animation-delay:240ms]" />
                        </span>
                        {dict.chat.typing}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div ref={bottomRef} />
              </div>
            ) : null}
          </CardBody>

          {session ? (
            ended ? (
              <div className="border-t border-line px-5 py-5 sm:px-6">
                <p className="text-sm font-medium text-ink">{dict.chat.endedTitle}</p>
                <p className="mt-1 text-sm text-muted">{dict.chat.endedBody}</p>
                <div className="mt-4">
                  <RatingPanel session={session} locale={locale} dict={dict} />
                </div>
              </div>
            ) : (
              <div className="border-t border-line px-5 py-4 sm:px-6">
                <TextAreaField
                  id="chat-question"
                  label={dict.chat.inputLabel}
                  hint={formatMessage(dict.chat.inputHint, { max: CHAT_QUESTION_MAX })}
                  rows={2}
                  value={draft}
                  maxLength={CHAT_QUESTION_MAX}
                  counter={formatMessage(dict.chat.charCounter, {
                    count: charCount(draft),
                    max: CHAT_QUESTION_MAX,
                  })}
                  placeholder={dict.chat.inputPlaceholder}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submitQuestion();
                    }
                  }}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={submitQuestion}
                    disabled={send.isPending || draft.trim().length === 0}
                    className={buttonClasses('primary', 'sm')}
                  >
                    {send.isPending ? dict.chat.sending : dict.chat.send}
                  </button>
                </div>
              </div>
            )
          ) : null}
        </Card>
      </div>
    </div>
  );
}

export function ChatWorkspace(props: {
  locale: Locale;
  dict: Dictionary;
  defaultLanguage: Language;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 0, staleTime: 15_000 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ChatWorkspaceInner {...props} />
    </QueryClientProvider>
  );
}
