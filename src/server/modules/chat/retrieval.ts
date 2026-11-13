import 'server-only';

import type { GuideRow } from '../guides/repo';
import { tokenizeForEmbedding } from '../../lib/embeddings';

/**
 * RAG retrieval scoring (AGENTS.md §8).
 *
 * Two rankers share one candidate list:
 *  - `rankByEmbedding` for Gemini mode (cosine over the stored vectors);
 *  - `rankLexically` for Mock AI mode, using BM25 over the guide text.
 *
 * BM25 is a better offline fit than hashed-vector cosine: the hashed vectors
 * are deliberately tiny and collide, while BM25 gives a clean separation between
 * a relevant question and an off-topic one. Both rankers are pure so tests can
 * exercise them without a database or network.
 */

export interface RetrievalCandidate extends GuideRow {
  embedding_model: string | null;
  embedding_vector: string | null;
}

export interface RankedGuide {
  row: GuideRow;
  score: number;
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;

function guideTokens(row: GuideRow): string[] {
  const titleTokens = tokenizeForEmbedding(row.title);
  return [
    ...titleTokens,
    ...titleTokens,
    ...titleTokens,
    ...tokenizeForEmbedding(row.plain_summary),
    ...tokenizeForEmbedding(row.source_statute),
    ...tokenizeForEmbedding(row.source_excerpt ?? ''),
  ];
}

/**
 * BM25 ranking. The score is unbounded; callers compare it with the configured
 * `rag_lexical_threshold` (default 3, tuned on the seeded corpus).
 */
export function rankLexically(question: string, candidates: RetrievalCandidate[]): RankedGuide[] {
  if (candidates.length === 0) return [];

  const queryTerms = [...new Set(tokenizeForEmbedding(question))];
  if (queryTerms.length === 0) return [];

  const documents = candidates.map((row) => ({ row, tokens: guideTokens(row) }));
  const averageLength =
    documents.reduce((total, document) => total + document.tokens.length, 0) / documents.length;

  const documentFrequency = new Map<string, number>();
  for (const document of documents) {
    for (const term of new Set(document.tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = documents.length;
  const ranked = documents.map((document) => {
    const termFrequency = new Map<string, number>();
    for (const token of document.tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    let score = 0;
    for (const term of queryTerms) {
      const frequency = termFrequency.get(term) ?? 0;
      if (frequency === 0) continue;

      const seenIn = documentFrequency.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(1 + (total - seenIn + 0.5) / (seenIn + 0.5));
      const lengthNormalisation =
        1 - BM25_B + (BM25_B * document.tokens.length) / (averageLength || 1);
      score +=
        (inverseDocumentFrequency * frequency * (BM25_K1 + 1)) /
        (frequency + BM25_K1 * lengthNormalisation);
    }

    return { row: document.row, score };
  });

  return ranked
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.row.guide_id - right.row.guide_id);
}

function parseVector(value: string | null): number[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.every((entry) => typeof entry === 'number') ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

/**
 * Cosine ranking over stored vectors. Only rows written by the same embedding
 * model as the query are comparable; a stale/missing index simply yields an
 * empty list and the service falls back to the lexical ranker.
 */
export function rankByEmbedding(
  queryVector: number[],
  model: string,
  candidates: RetrievalCandidate[],
): RankedGuide[] {
  return candidates
    .filter((row) => row.embedding_model === model)
    .map((row) => {
      const vector = parseVector(row.embedding_vector);
      return { row, score: vector ? cosineSimilarity(queryVector, vector) : 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.row.guide_id - right.row.guide_id);
}

/** Keep the top matches that clear the grounding threshold. */
export function selectGrounded(
  ranked: RankedGuide[],
  threshold: number,
  topK: number,
): RankedGuide[] {
  return ranked.filter((entry) => entry.score >= threshold).slice(0, topK);
}
