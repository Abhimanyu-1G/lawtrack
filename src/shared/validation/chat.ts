import type { Language } from '../enums';
import { LANGUAGES } from '../enums';
import type { ValidationResult } from '../errors';
import type { Locale } from '../../i18n';
import { asRecord, charCount, readNumber, readString } from './fields';
import { invalid, localeOf } from './messages';
import { fail, ok } from './result';

/**
 * Chatbot input validation (AGENTS.md §8). Pure functions shared by the
 * composer and the route handler: strip control characters, cap the question
 * at 1000 characters, and accept only the two supported languages and the
 * 1–5 post-session rating.
 */

export const CHAT_QUESTION_MAX = 1000;
export const CHAT_HISTORY_QUERY_MAX = 100;
export const CHAT_RATING_MIN = 1;
export const CHAT_RATING_MAX = 5;

/** C0/C1 control characters except tab and newline (which become spaces). */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** Collapse whitespace and remove control characters from untrusted text. */
export function sanitizeChatText(value: string): string {
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

export interface ChatQuestionInput {
  question: string;
}

export function validateChatQuestion(
  input: unknown,
  localeInput: Locale,
): ValidationResult<ChatQuestionInput> {
  const record = asRecord(input);
  const locale = localeOf(localeInput);
  const question = readString(record, 'question');

  if (question.status === 'missing') {
    return fail([invalid('question', 'REQUIRED', locale, 'required')]);
  }
  if (question.status === 'invalid') {
    return fail([invalid('question', 'TYPE', locale, 'invalidType')]);
  }

  const sanitized = sanitizeChatText(question.value);
  if (sanitized.length === 0) {
    return fail([invalid('question', 'REQUIRED', locale, 'required')]);
  }
  if (charCount(sanitized) > CHAT_QUESTION_MAX) {
    return fail([
      invalid('question', 'LENGTH', locale, 'tooLong', { max: CHAT_QUESTION_MAX }),
    ]);
  }

  return ok({ question: sanitized });
}

export interface ChatSessionInput {
  language?: Language;
}

export function validateChatSessionInput(
  input: unknown,
  localeInput: Locale,
): ValidationResult<ChatSessionInput> {
  const record = asRecord(input);
  const locale = localeOf(localeInput);
  const language = readString(record, 'language');

  if (language.status === 'missing') return ok({});
  if (language.status === 'invalid') {
    return fail([invalid('language', 'TYPE', locale, 'invalidType')]);
  }
  if (!(LANGUAGES as readonly string[]).includes(language.value)) {
    return fail([
      invalid('language', 'ENUM', locale, 'invalidEnum', {
        allowed: LANGUAGES.join(', '),
      }),
    ]);
  }

  return ok({ language: language.value as Language });
}

export interface ChatRatingInput {
  rating: number;
}

export function validateChatRatingInput(
  input: unknown,
  localeInput: Locale,
): ValidationResult<ChatRatingInput> {
  const record = asRecord(input);
  const locale = localeOf(localeInput);
  const rating = readNumber(record, 'rating');

  if (rating.status === 'missing') {
    return fail([invalid('rating', 'REQUIRED', locale, 'required')]);
  }
  if (rating.status === 'invalid' || !Number.isInteger(rating.value)) {
    return fail([invalid('rating', 'TYPE', locale, 'invalidType')]);
  }
  if (rating.value < CHAT_RATING_MIN || rating.value > CHAT_RATING_MAX) {
    return fail([
      invalid('rating', 'ENUM', locale, 'invalidEnum', {
        allowed: `${CHAT_RATING_MIN}–${CHAT_RATING_MAX}`,
      }),
    ]);
  }

  return ok({ rating: rating.value });
}

/** History search is a plain text match; empty input yields no query. */
export function validateChatHistoryQuery(query: string | null | undefined): string {
  if (!query) return '';
  return sanitizeChatText(query).slice(0, CHAT_HISTORY_QUERY_MAX);
}
