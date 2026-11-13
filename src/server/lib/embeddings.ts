import 'server-only';

/**
 * Deterministic lexical embeddings (Phase 3).
 *
 * The product must work offline (AGENTS.md §10), so the guide index is built
 * from a small hashed bag-of-words vector rather than a network call. It is
 * deliberately simple: tokenise, drop common English/Hindi stop words, hash each
 * token into a fixed bucket, term-frequency weight and L2-normalise. The chat
 * layer can use the same vector for cosine retrieval when no Gemini key exists;
 * with a real key, validation can overwrite the row with the model vector.
 */

export const LEXICAL_EMBEDDING_MODEL = 'lexical-v1';
export const LEXICAL_EMBEDDING_DIMENSIONS = 256;

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'were',
  'will',
  'with',
  'you',
  'your',
  'है',
  'हैं',
  'का',
  'की',
  'के',
  'को',
  'और',
  'में',
  'से',
  'पर',
  'यह',
  'वह',
  'था',
  'थी',
  'हो',
  'कर',
  'लिए',
  'एक',
]);

export function tokenizeForEmbedding(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** FNV-1a 32-bit hash; stable across processes and platforms. */
function hashToken(token: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalise(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  if (magnitude === 0) return vector;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

export function lexicalEmbedding(text: string): number[] {
  const vector = new Array<number>(LEXICAL_EMBEDDING_DIMENSIONS).fill(0);
  for (const token of tokenizeForEmbedding(text)) {
    const index = hashToken(token) % LEXICAL_EMBEDDING_DIMENSIONS;
    vector[index] = (vector[index] ?? 0) + 1;
  }
  return normalise(vector);
}

export interface GuideEmbeddingSource {
  title: string;
  plainSummary: string;
  sourceStatute: string;
  sourceExcerpt?: string | null;
}

export function embedGuide(input: GuideEmbeddingSource): { model: string; vector: string } {
  const text = [input.title, input.plainSummary, input.sourceStatute, input.sourceExcerpt ?? '']
    .filter(Boolean)
    .join('\n');
  return { model: LEXICAL_EMBEDDING_MODEL, vector: JSON.stringify(lexicalEmbedding(text)) };
}
