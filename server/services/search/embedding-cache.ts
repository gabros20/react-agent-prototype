/**
 * Embedding Cache
 *
 * Caches query embeddings to avoid redundant API calls.
 * Embeddings are deterministic (same input = same output),
 * so we can cache them for longer periods.
 */

import { createHash } from 'crypto';
import { SimpleCache } from '../../cache/simple-cache';

// 5 minute TTL - embeddings are deterministic but we don't want unbounded growth
const EMBEDDING_CACHE_TTL = 5 * 60 * 1000;

// Max cache key length (hash first 500 chars of input)
const MAX_HASH_INPUT_LENGTH = 500;

const embeddingCache = new SimpleCache<number[]>(EMBEDDING_CACHE_TTL);

/**
 * Get a cached embedding or generate a new one
 *
 * @param text - Input text to embed
 * @param generator - Async function that generates embeddings
 * @returns Embedding vector
 */
export async function getCachedEmbedding(
  text: string,
  generator: (text: string) => Promise<number[]>
): Promise<number[]> {
  // Create a hash of the input text for the cache key
  // Only hash first N chars to avoid extremely long keys
  const hashInput = text.slice(0, MAX_HASH_INPUT_LENGTH);
  const hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
  const cacheKey = `emb:${hash}`;

  return embeddingCache.getOrFetch(cacheKey, () => generator(text));
}

/**
 * Get embedding cache statistics (for debugging)
 */
export function getEmbeddingCacheStats() {
  return embeddingCache.stats();
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache() {
  embeddingCache.clear();
}
