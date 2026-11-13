import { describe, expect, it } from 'vitest';

import type { ValidationCode, ValidationResult } from '../../src/shared/errors';
import {
  CHAT_QUESTION_MAX,
  sanitizeChatText,
  validateChatHistoryQuery,
  validateChatQuestion,
  validateChatRatingInput,
  validateChatSessionInput,
} from '../../src/shared/validation';

/** Chatbot input validation (AGENTS.md §8). */

function expectIssue(
  result: ValidationResult<unknown>,
  field: string,
  code: ValidationCode,
): void {
  expect(result.ok, `expected ${field} to fail with ${code}`).toBe(false);
  if (result.ok) return;
  expect(result.errors.find((error) => error.field === field)?.code).toBe(code);
}

describe('Chat validation (UT_CHAT)', () => {
  it('UT_CHAT_01 question accepts a normal question and trims it', () => {
    const result = validateChatQuestion(
      { question: '  How do I file an RTI application?  ' },
      'en',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.question).toBe('How do I file an RTI application?');
  });

  it('UT_CHAT_02 question is required', () => {
    expectIssue(validateChatQuestion({ question: '   ' }, 'en'), 'question', 'REQUIRED');
    expectIssue(validateChatQuestion({}, 'en'), 'question', 'REQUIRED');
  });

  it('UT_CHAT_03 question strips control characters and collapses whitespace', () => {
    const sanitized = sanitizeChatText('My landlord\u0000 will not\r\nreturn the deposit');
    expect(sanitized).toBe('My landlord will not return the deposit');
  });

  it('UT_CHAT_04 question rejects more than 1000 characters', () => {
    expectIssue(
      validateChatQuestion({ question: 'x'.repeat(CHAT_QUESTION_MAX + 1) }, 'en'),
      'question',
      'LENGTH',
    );
  });

  it('UT_CHAT_05 question accepts exactly 1000 characters', () => {
    expect(validateChatQuestion({ question: 'x'.repeat(CHAT_QUESTION_MAX) }, 'en').ok).toBe(true);
  });

  it('UT_CHAT_06 session language accepts Hindi and defaults when omitted', () => {
    const hindi = validateChatSessionInput({ language: 'Hindi' }, 'en');
    expect(hindi.ok).toBe(true);
    if (hindi.ok) expect(hindi.value.language).toBe('Hindi');

    const omitted = validateChatSessionInput({}, 'en');
    expect(omitted.ok).toBe(true);
    if (omitted.ok) expect(omitted.value.language).toBeUndefined();
  });

  it('UT_CHAT_07 session language rejects French with ENUM', () => {
    expectIssue(validateChatSessionInput({ language: 'French' }, 'en'), 'language', 'ENUM');
  });

  it('UT_CHAT_08 rating accepts 1, 3 and 5', () => {
    for (const rating of [1, 3, 5]) {
      const result = validateChatRatingInput({ rating }, 'en');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.rating).toBe(rating);
    }
  });

  it('UT_CHAT_09 rating rejects 0 and 6 with ENUM and a non-number with TYPE', () => {
    expectIssue(validateChatRatingInput({ rating: 0 }, 'en'), 'rating', 'ENUM');
    expectIssue(validateChatRatingInput({ rating: 6 }, 'en'), 'rating', 'ENUM');
    expectIssue(validateChatRatingInput({ rating: '4' }, 'en'), 'rating', 'TYPE');
    expectIssue(validateChatRatingInput({}, 'en'), 'rating', 'REQUIRED');
  });

  it('UT_CHAT_10 history query is sanitised, capped and empty when blank', () => {
    expect(validateChatHistoryQuery('  deposit\u0001  ')).toBe('deposit');
    expect(validateChatHistoryQuery(null)).toBe('');
    expect(validateChatHistoryQuery('a'.repeat(200))).toHaveLength(100);
  });
});
