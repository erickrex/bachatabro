/**
 * Property-based tests for ResponseCache
 * Feature: elevenlabs-voice-coach
 * 
 * Property 20: Response Caching
 * Validates: Requirements 15.4
 * 
 * For any repeated API request with identical parameters within the cache TTL,
 * the cached response should be returned without making a new API call.
 */

import * as fc from 'fast-check';
import { propertyConfig } from '../../../test/propertyConfig';
import { ResponseCache } from '../ResponseCache';

describe('ResponseCache Property Tests', () => {
  // Increase timeout for property-based tests
  jest.setTimeout(30000);

  // Feature: elevenlabs-voice-coach, Property 20: Response Caching
  describe('Property 20: Response Caching', () => {
    /**
     * Validates: Requirements 15.4
     * 
     * For any repeated API request with identical parameters within the cache TTL,
     * the cached response should be returned without making a new API call.
     */

    it('should return cached value for identical requests within TTL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 100 }),
            language: fc.constantFrom('en', 'es', 'de', 'ru'),
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (requestType, params, responseValue) => {
            const cache = new ResponseCache({ defaultTtlMs: 60000 });
            
            const key = cache.generateKey(requestType, params);
            
            // First request - cache miss
            const firstGet = cache.get(key);
            expect(firstGet).toBeNull();
            
            // Store response
            cache.set(key, responseValue);
            
            // Second request with same params - cache hit
            const secondGet = cache.get<string>(key);
            expect(secondGet).toBe(responseValue);
            
            // Third request - still cached
            const thirdGet = cache.get<string>(key);
            expect(thirdGet).toBe(responseValue);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should generate same key for identical parameters regardless of order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (type, key1, key2, key3) => {
            const cache = new ResponseCache();
            
            // Create params in different orders
            const params1 = { [key1]: 'a', [key2]: 'b', [key3]: 'c' };
            const params2 = { [key3]: 'c', [key1]: 'a', [key2]: 'b' };
            const params3 = { [key2]: 'b', [key3]: 'c', [key1]: 'a' };
            
            const cacheKey1 = cache.generateKey(type, params1);
            const cacheKey2 = cache.generateKey(type, params2);
            const cacheKey3 = cache.generateKey(type, params3);
            
            // All keys should be identical
            expect(cacheKey1).toBe(cacheKey2);
            expect(cacheKey2).toBe(cacheKey3);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should generate different keys for different parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer(),
          }),
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer(),
          }),
          async (type, params1, params2) => {
            // Skip if params are identical
            if (JSON.stringify(params1) === JSON.stringify(params2)) {
              return;
            }
            
            const cache = new ResponseCache();
            
            const key1 = cache.generateKey(type, params1);
            const key2 = cache.generateKey(type, params2);
            
            // Keys should be different for different params
            expect(key1).not.toBe(key2);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should not return expired entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (key, value) => {
            // Use very short TTL for testing
            const cache = new ResponseCache({ defaultTtlMs: 10 });
            
            cache.set(key, value);
            
            // Should be cached immediately
            expect(cache.get(key)).toBe(value);
            
            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 20));
            
            // Should be expired now
            expect(cache.get(key)).toBeNull();
          }
        ),
        propertyConfig({ numRuns: 50 })
      );
    });

    it('should respect maxSize limit and evict oldest entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 10 }),
              value: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (maxSize, entries) => {
            const cache = new ResponseCache({ maxSize, defaultTtlMs: 60000 });
            
            // Add entries with unique keys
            entries.forEach((entry, index) => {
              const uniqueKey = `${entry.key}-${index}`;
              cache.set(uniqueKey, entry.value);
            });
            
            // Cache size should never exceed maxSize
            expect(cache.getSize()).toBeLessThanOrEqual(maxSize);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should track hits and misses correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 10 }),
              value: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.integer({ min: 1, max: 5 }),
          async (entries, hitsPerEntry) => {
            const cache = new ResponseCache({ defaultTtlMs: 60000 });
            
            // Store all entries
            entries.forEach((entry, index) => {
              const uniqueKey = `${entry.key}-${index}`;
              cache.set(uniqueKey, entry.value);
            });
            
            // Access each entry multiple times
            let expectedHits = 0;
            entries.forEach((entry, index) => {
              const uniqueKey = `${entry.key}-${index}`;
              for (let i = 0; i < hitsPerEntry; i++) {
                cache.get(uniqueKey);
                expectedHits++;
              }
            });
            
            const stats = cache.getStats();
            expect(stats.hits).toBe(expectedHits);
          }
        ),
        propertyConfig({ numRuns: 50 })
      );
    });

    it('should correctly report has() for existing and non-existing keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (existingKey, nonExistingKey, value) => {
            // Ensure keys are different
            const actualNonExisting = existingKey === nonExistingKey 
              ? `${nonExistingKey}-different` 
              : nonExistingKey;
            
            const cache = new ResponseCache({ defaultTtlMs: 60000 });
            
            cache.set(existingKey, value);
            
            expect(cache.has(existingKey)).toBe(true);
            expect(cache.has(actualNonExisting)).toBe(false);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should delete entries correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 10 }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.integer({ min: 0 }),
          async (keys, deleteIndex) => {
            const cache = new ResponseCache({ defaultTtlMs: 60000 });
            
            // Add entries with unique keys
            const uniqueKeys = keys.map((key, index) => `${key}-${index}`);
            uniqueKeys.forEach(key => cache.set(key, 'value'));
            
            const keyToDelete = uniqueKeys[deleteIndex % uniqueKeys.length];
            const initialSize = cache.getSize();
            
            const deleted = cache.delete(keyToDelete);
            
            expect(deleted).toBe(true);
            expect(cache.getSize()).toBe(initialSize - 1);
            expect(cache.has(keyToDelete)).toBe(false);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should clear all entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 10 }),
              value: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (entries) => {
            const cache = new ResponseCache({ defaultTtlMs: 60000 });
            
            entries.forEach((entry, index) => {
              cache.set(`${entry.key}-${index}`, entry.value);
            });
            
            expect(cache.getSize()).toBeGreaterThan(0);
            
            cache.clear();
            
            expect(cache.getSize()).toBe(0);
            expect(cache.getKeys()).toEqual([]);
            
            // Stats should be reset
            const stats = cache.getStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
          }
        ),
        propertyConfig({ numRuns: 100 })
      );
    });

    it('should cleanup expired entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 1, maxLength: 10 }),
            { minLength: 2, maxLength: 5 }
          ),
          async (keys) => {
            const cache = new ResponseCache({ defaultTtlMs: 10 });
            
            // Add entries with unique keys
            const uniqueKeys = keys.map((key, index) => `${key}-${index}`);
            uniqueKeys.forEach(key => cache.set(key, 'value'));
            
            const initialSize = cache.getSize();
            expect(initialSize).toBe(uniqueKeys.length);
            
            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 20));
            
            // Cleanup should remove all expired entries
            const removed = cache.cleanup();
            
            expect(removed).toBe(initialSize);
            expect(cache.getSize()).toBe(0);
          }
        ),
        propertyConfig({ numRuns: 50 })
      );
    });

    it('should support custom TTL per entry', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (key, value) => {
            const cache = new ResponseCache({ defaultTtlMs: 1000 });
            
            // Set with short custom TTL
            cache.set(key, value, 10);
            
            // Should be cached immediately
            expect(cache.get(key)).toBe(value);
            
            // Wait for custom TTL to expire
            await new Promise(resolve => setTimeout(resolve, 20));
            
            // Should be expired now
            expect(cache.get(key)).toBeNull();
          }
        ),
        propertyConfig({ numRuns: 50 })
      );
    });
  });
});
