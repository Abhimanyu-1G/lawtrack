import 'server-only';

import type { DraftType, Language } from '../../../shared/enums';
import type { DraftAnswers } from '../../../shared/validation';

/**
 * AI provider contract (AGENTS.md §10).
 *
 * Embeddings power the guide index and chat retrieval, simplifyText powers the
 * curator console, generateAnswer composes grounded chatbot answers, and the
 * draft methods are added by the drafts phase behind the same interface.
 */

export interface EmbeddingResult {
  /** Model that produced the vectors; stored with the guide index. */
  model: string;
  vectors: number[][];
  /** True when the offline deterministic provider answered. */
  demo: boolean;
}

export interface SimplifyResult {
  text: string;
  model: string;
  demo: boolean;
}

export interface AnswerPassage {
  guideId: number;
  title: string;
  category: string;
  summary: string;
  statute: string;
  excerpt: string | null;
}

export interface AnswerContext {
  question: string;
  language: Language;
  /** Already ranked; the provider must answer from these only. */
  passages: AnswerPassage[];
}

export interface AnswerResult {
  text: string;
  model: string;
  demo: boolean;
}

export interface EmbedOptions {
  /** Retrieval queries are embedded with the same model as documents. */
  purpose?: 'document' | 'query';
}

export interface DraftGenerationContext {
  type: DraftType;
  language: Language;
  /** Sanitised wizard answers; the only facts the model may use. */
  answers: DraftAnswers;
  citizenName: string;
  /** Asia/Kolkata date `YYYY-MM-DD`, used in the signature block. */
  today: string;
  /** Present only when regenerating after a rejection. */
  remarks?: string;
  previousText?: string;
}

export interface AiProvider {
  readonly name: 'mock' | 'gemini';
  readonly demo: boolean;
  embed(texts: string[], options?: EmbedOptions): Promise<EmbeddingResult>;
  simplifyText(text: string, language: Language): Promise<SimplifyResult>;
  generateAnswer(context: AnswerContext): Promise<AnswerResult>;
  generateDraft(context: DraftGenerationContext): Promise<AnswerResult>;
  regenerateDraft(context: DraftGenerationContext): Promise<AnswerResult>;
}
