import { describe, it, expect } from 'vitest';
import { CircularRingBuffer, AudioBufferPool } from '../services/audioRingBuffer.js';
import { LruCacheWithTtl } from '../services/lruCache.js';

describe('Performance Optimization & High-Throughput Stream Suite', () => {
  describe('CircularRingBuffer', () => {
    it('writes and reads PCM bytes sequentially', () => {
      const ring = new CircularRingBuffer(1024);
      expect(ring.availableBytes).toBe(0);
      expect(ring.freeSpaceBytes).toBe(1024);

      const chunk = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
      ring.write(chunk);
      expect(ring.availableBytes).toBe(8);

      const readBack = ring.read(8);
      expect(readBack.length).toBe(8);
      expect(Array.from(readBack)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(ring.availableBytes).toBe(0);
    });

    it('handles buffer wrap-around without crashing or data corruption', () => {
      const smallRing = new CircularRingBuffer(10);
      const first = Buffer.from([10, 20, 30, 40, 50, 60]);
      smallRing.write(first);
      expect(smallRing.availableBytes).toBe(6);

      // Read 4 bytes, leaves 2 bytes at end
      const read1 = smallRing.read(4);
      expect(Array.from(read1)).toEqual([10, 20, 30, 40]);
      expect(smallRing.availableBytes).toBe(2);

      // Write 6 more bytes (forces circular wrap across boundary)
      const second = Buffer.from([70, 80, 90, 100, 110, 120]);
      smallRing.write(second);
      expect(smallRing.availableBytes).toBe(8);

      const readRemaining = smallRing.read(8);
      expect(Array.from(readRemaining)).toEqual([50, 60, 70, 80, 90, 100, 110, 120]);
    });

    it('handles buffer overwrite gracefully when capacity is exceeded', () => {
      const tinyRing = new CircularRingBuffer(5);
      tinyRing.write(Buffer.from([1, 2, 3, 4, 5, 6, 7])); // Exceeds 5
      expect(tinyRing.availableBytes).toBe(5);
    });
  });

  describe('AudioBufferPool', () => {
    it('pre-allocates and recycles audio buffers cleanly', () => {
      const pool = new AudioBufferPool(320, 50);
      expect(pool.availableBuffers).toBeGreaterThanOrEqual(20);

      const buf1 = pool.acquire();
      expect(buf1.length).toBe(320);

      buf1.writeInt16LE(1234, 0);
      pool.release(buf1);

      // Re-acquiring should clear buffer
      const buf2 = pool.acquire();
      expect(buf2.readInt16LE(0)).toBe(0); // auto-cleared
    });
  });

  describe('LruCacheWithTtl', () => {
    it('stores and retrieves cached caller items with O(1) latency', () => {
      const cache = new LruCacheWithTtl<string, any>(3, 60000);
      cache.set('+18005550199', { verdict: 'SPAM', risk: 90 });
      cache.set('+18005550100', { verdict: 'SAFE', risk: 5 });

      expect(cache.get('+18005550199')?.verdict).toBe('SPAM');
      expect(cache.stats.hits).toBe(1);
      expect(cache.stats.misses).toBe(0);

      expect(cache.get('+19999999999')).toBeUndefined();
      expect(cache.stats.misses).toBe(1);
    });

    it('evicts least recently used item when max capacity is reached', () => {
      const cache = new LruCacheWithTtl<string, string>(2, 60000);
      cache.set('a', 'alpha');
      cache.set('b', 'beta');

      // Access 'a' to make 'b' the least recently used
      cache.get('a');

      // Add 'c' -> should evict 'b'
      cache.set('c', 'gamma');

      expect(cache.get('a')).toBe('alpha');
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe('gamma');
    });

    it('expires stale entries when TTL has elapsed', () => {
      const cache = new LruCacheWithTtl<string, string>(10, 10); // 10ms TTL
      cache.set('temp', 'value', 10);

      // Force expiration simulation by setting expiresAt in past
      (cache as any).cache.get('temp').expiresAt = Date.now() - 50;
      expect(cache.get('temp')).toBeUndefined();
    });
  });
});
