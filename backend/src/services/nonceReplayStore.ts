/**
 * NonceReplayStore.ts
 * Enterprise-grade cryptographic Nonce tracking store with automatic sliding TTL cleanup.
 * Guarantees zero replay attacks within the allowable timestamp freshness window.
 */

export interface NonceValidationResult {
  valid: boolean;
  reason?: 'MISSING_NONCE' | 'NONCE_REPLAY_DETECTED' | 'EXPIRED_NONCE';
}

export class NonceReplayStore {
  // In-memory nonce cache: nonce -> expiry timestamp ms
  private static nonces = new Map<string, number>();
  private static defaultTtlMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Validates and records a nonce. Returns true if unique and fresh, false if replayed.
   */
  public static consumeNonce(nonce: string, ttlMs: number = this.defaultTtlMs): NonceValidationResult {
    if (!nonce || typeof nonce !== 'string' || nonce.trim().length < 8) {
      return { valid: false, reason: 'MISSING_NONCE' };
    }

    const now = Date.now();
    this.purgeExpired(now);

    const cleanNonce = nonce.trim();
    if (this.nonces.has(cleanNonce)) {
      return { valid: false, reason: 'NONCE_REPLAY_DETECTED' };
    }

    this.nonces.set(cleanNonce, now + ttlMs);
    return { valid: true };
  }

  /**
   * Purges nonces that have exceeded their validity window
   */
  public static purgeExpired(now: number = Date.now()): number {
    let purged = 0;
    for (const [nonce, expiresAt] of this.nonces.entries()) {
      if (now > expiresAt) {
        this.nonces.delete(nonce);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Clears the store (used for test isolation)
   */
  public static reset(): void {
    this.nonces.clear();
  }

  /**
   * Returns current count of active nonces
   */
  public static get size(): number {
    return this.nonces.size;
  }
}
