/**
 * LruCache.ts
 * High-performance Least Recently Used (LRU) Cache with Time-To-Live (TTL) expiration.
 * Used for O(1) lookups of caller reputation, STIR/SHAKEN certificates, and spam scoring.
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class LruCacheWithTtl<K = string, V = any> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 1000, defaultTtlMs = 15 * 60 * 1000) { // 15 mins default TTL
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Retrieves a cached value if present and not expired.
   * Refreshes LRU position.
   */
  public get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU order: delete and re-insert at end
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Stores a value in the cache with optional specific TTL.
   * Evicts least recently used item if capacity is exceeded.
   */
  public set(key: K, value: V, ttlMs: number = this.defaultTtlMs): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (first item in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  public has(key: K): boolean {
    const val = this.get(key);
    return val !== undefined;
  }

  public delete(key: K): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public get size(): number {
    return this.cache.size;
  }

  public get stats(): { hits: number; misses: number; hitRatio: number; size: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? Math.round((this.hits / total) * 100) / 100 : 0,
      size: this.cache.size
    };
  }
}
