/**
 * SimpleCache - Lightweight in-memory cache with TTL support
 *
 * Features:
 * - TTL-based expiration
 * - Cache-aside pattern via getOrFetch()
 * - Optional stats tracking
 * - Type-safe generics
 */

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: string;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly defaultTTL: number;

  // Stats
  private _hits = 0;
  private _misses = 0;

  /**
   * @param defaultTTLMs Default time-to-live in milliseconds (default: 60 seconds)
   */
  constructor(defaultTTLMs: number = 60_000) {
    this.defaultTTL = defaultTTLMs;
  }

  /**
   * Get a value from cache
   * Returns undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this._misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this._misses++;
      return undefined;
    }

    this._hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to store
   * @param ttlMs Optional TTL override in milliseconds
   */
  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a prefix
   * Useful for invalidating related entries
   */
  deleteByPrefix(prefix: string): number {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Cache-aside pattern: get from cache or fetch and cache
   *
   * @param key Cache key
   * @param fetcher Async function to fetch value if not cached
   * @param ttlMs Optional TTL override
   */
  async getOrFetch<R extends T>(
    key: string,
    fetcher: () => Promise<R>,
    ttlMs?: number
  ): Promise<R> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached as R;
    }

    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Synchronous version of getOrFetch for non-async fetchers
   */
  getOrCompute<R extends T>(
    key: string,
    compute: () => R,
    ttlMs?: number
  ): R {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached as R;
    }

    const value = compute();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    // Clean up expired entries first
    this.cleanup();

    const total = this._hits + this._misses;
    const hitRate = total > 0 ? ((this._hits / total) * 100).toFixed(1) + '%' : '0%';

    return {
      hits: this._hits,
      misses: this._misses,
      size: this.cache.size,
      hitRate,
    };
  }

  /**
   * Remove expired entries
   * Called automatically in stats(), but can be called manually
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}
