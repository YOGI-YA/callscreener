import { Request, Response, NextFunction } from 'express';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * High-performance In-Memory Token Bucket Rate Limiter
 */
export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private capacity: number;
  private refillRatePerSec: number;

  constructor(capacity = 60, refillRatePerSec = 2) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;

    // Periodic sweep to prevent unbounded memory growth
    setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        if (now - bucket.lastRefill > 5 * 60 * 1000) {
          this.buckets.delete(key);
        }
      }
    }, 60 * 1000).unref();
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Allow test environment to bypass unless explicitly requested
      if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
        return next();
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      let bucket = this.buckets.get(clientIp);
      if (!bucket) {
        bucket = { tokens: this.capacity, lastRefill: now };
        this.buckets.set(clientIp, bucket);
      } else {
        const elapsedSec = (now - bucket.lastRefill) / 1000;
        bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillRatePerSec);
        bucket.lastRefill = now;
      }

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        res.setHeader('X-RateLimit-Limit', this.capacity.toString());
        res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.tokens).toString());
        return next();
      }

      const retryAfterSec = Math.ceil((1 - bucket.tokens) / this.refillRatePerSec);
      res.setHeader('Retry-After', retryAfterSec.toString());
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many screening requests. Please slow down.',
        retryAfterSec,
      });
    };
  }
}

export const screeningRateLimiter = new RateLimiter(60, 2);
