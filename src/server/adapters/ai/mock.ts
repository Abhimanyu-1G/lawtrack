import 'server-only';

import { LEXICAL_EMBEDDING_MODEL, lexicalEmbedding } from '../../lib/embeddings';
import { composeDraft } from './draftTemplate';
import { resimplifyText } from './simplify';
import type {
  AiProvider,
  AnswerContext,
  AnswerResult,
  DraftGenerationContext,
} from './provider';

/**
 * Offline provider (AGENTS.md §10): deterministic, no network, stable in tests.
 *
 * - Embeddings are the same hashed lexical vectors the seed uses, so a database
 *   seeded offline is immediately searchable in Mock AI mode.
 * - Chat answers are extractive: they quote the curator-validated passages the
 *   retrieval step selected, never invent a section number, and never follow
 *   instructions embedded in the passages or the question.
 * - Re-simplify only tidies wording and never invents facts.
 */

export const DEMO_ANSWER_MODEL = 'demo-extractive-v1';
export const DEMO_DRAFT_MODEL = 'demo-draft-v1';
const PASSAGE_CHARS = 1200;

function trimPassage(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= PASSAGE_CHARS ? text : `${text.slice(0, PASSAGE_CHARS - 1).trimEnd()}…`;
}

export function composeExtractiveAnswer(context: AnswerContext): string {
  const passages = context.passages.slice(0, 2);
  if (passages.length === 0) return '';

  const intro =
    context.language === 'Hindi'
      ? 'सत्यापित गाइडों के आधार पर, यह जानकारी आपके प्रश्न से सबसे अधिक मेल खाती है:'
      : 'Based on the curator-verified guides, this is the information that best matches your question:';

  const blocks = passages.map((passage) => {
    const label =
      context.language === 'Hindi'
        ? `«${passage.title}»`
        : `“${passage.title}”`;
    return `${label}\n${trimPassage(passage.summary)}`;
  });

  return [intro, ...blocks].join('\n\n');
}

export function createMockAiProvider(): AiProvider {
  return {
    name: 'mock',
    demo: true,

    async embed(texts) {
      return {
        model: LEXICAL_EMBEDDING_MODEL,
        vectors: texts.map((text) => lexicalEmbedding(text)),
        demo: true,
      };
    },

    async simplifyText(text) {
      return resimplifyText(text);
    },

    async generateAnswer(context: AnswerContext): Promise<AnswerResult> {
      return {
        text: composeExtractiveAnswer(context),
        model: DEMO_ANSWER_MODEL,
        demo: true,
      };
    },

    async generateDraft(context: DraftGenerationContext): Promise<AnswerResult> {
      return {
        text: composeDraft(context),
        model: DEMO_DRAFT_MODEL,
        demo: true,
      };
    },

    async regenerateDraft(context: DraftGenerationContext): Promise<AnswerResult> {
      return {
        text: composeDraft({ ...context, regenerated: true }),
        model: DEMO_DRAFT_MODEL,
        demo: true,
      };
    },
  };
}
