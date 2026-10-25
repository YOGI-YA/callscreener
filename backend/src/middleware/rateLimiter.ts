import { Request, Response, NextFunction } from 'express';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  penaltyMultiplier: number;
}

/**
 * Enterprise Sliding-Window Rate Limiter with /24 Subnet Normalization
 * and Automatic Abusive Client Penalty Escalation.
 */
export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private capacity: number;
  private refillRatePerSec: number;
  private enableSubnetClustering: boolean;

  constructor(capacity = 60, refillRatePerSec = 2, enableSubnetClustering = true) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.enableSubnetClustering = enableSubnetClustering;

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

  /**
   * Normalizes an IP to its /24 (IPv4) or /64 (IPv6) subnet cluster
   * to mitigate botnet IP-hopping attacks.
   */
  public normalizeIpToSubnet(rawIp: string): string {
    const clean = rawIp.replace(/[^\w.:-]/g, '').slice(0, 45) || 'unknown';
    if (!this.enableSubnetClustering) return clean;

    // IPv4 check: e.g. 192.168.1.42 -> 192.168.1.0/24
    const ipv4Match = clean.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
    if (ipv4Match) {
      return `${ipv4Match[1]}.0/24`;
    }

    // IPv6 check: cluster by first 4 hextets (/64)
    if (clean.includes(':')) {
      const parts = clean.split(':');
      if (parts.length >= 4) {
        return `${parts.slice(0, 4).join(':')}::/64`;
      }
    }

    return clean;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Allow test environment to bypass unless explicitly requested
      if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
        return next();
      }

      // Extract client IP safely
      const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
      const clusterKey = this.normalizeIpToSubnet(rawIp);
      const now = Date.now();

      let bucket = this.buckets.get(clusterKey);
      if (!bucket) {
        bucket = { tokens: this.capacity, lastRefill: now, penaltyMultiplier: 1 };
        this.buckets.set(clusterKey, bucket);
      } else {
        const elapsedSec = (now - bucket.lastRefill) / 1000;
        const effectiveRefill = this.refillRatePerSec / bucket.penaltyMultiplier;
        bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * effectiveRefill);
        bucket.lastRefill = now;
      }

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        res.setHeader('X-RateLimit-Limit', this.capacity.toString());
        res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.tokens).toString());
        res.setHeader('X-RateLimit-Cluster', clusterKey);
        return next();
      }

      // Escalate penalty for persistent violators
      bucket.penaltyMultiplier = Math.min(8, bucket.penaltyMultiplier * 1.5);

      const effectiveRefill = this.refillRatePerSec / bucket.penaltyMultiplier;
      const retryAfterSec = Math.ceil((1 - bucket.tokens) / Math.max(0.1, effectiveRefill));

      res.setHeader('Retry-After', retryAfterSec.toString());
      res.setHeader('X-RateLimit-Cluster', clusterKey);
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many screening requests. Please slow down.',
        cluster: clusterKey,
        retryAfterSec,
      });
    };
  }

  public reset(): void {
    this.buckets.clear();
  }
}

export const screeningRateLimiter = new RateLimiter(60, 2);
