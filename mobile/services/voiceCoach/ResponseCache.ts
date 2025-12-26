/**
 * Response Cache for Voice Coach
 * 
 * Caches recent API responses to reduce API calls and improve performance.
 * Returns cached response for identical requests within TTL.
 * 
 * Requirements: 15.4
 */

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface ResponseCacheConfig {
  maxSize?: number;
  defaultTtlMs?: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTtlMs: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config?: ResponseCacheConfig) {
    this.maxSize = config?.maxSize ?? 100;
    this.defaultTtlMs = config?.defaultTtlMs ?? 60000; // 1 minute default
  }

  /**
   * Generate a cache key from request parameters
   */
  generateKey(type: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, unknown>);
    
    return `${type}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get a cached response if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Update hit count
    entry.hits++;
    this.hits++;
    
    return entry.value as T;
  }

  /**
   * Store a response in the cache
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }
    
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttlMs ?? this.defaultTtlMs,
      hits: 0,
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Remove a specific entry from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Get current cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Get all cache keys (for debugging/testing)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get a cache entry with metadata (for debugging/testing)
   */
  getEntry(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    
    return { ...entry };
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictOldest(): void {
    // Find the oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// Singleton instance
let defaultCache: ResponseCache | null = null;

export function getResponseCache(): ResponseCache {
  if (!defaultCache) {
    defaultCache = new ResponseCache();
  }
  return defaultCache;
}
