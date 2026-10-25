import { describe, it, expect, beforeEach } from 'vitest';
import { NonceReplayStore } from '../services/nonceReplayStore.js';
import { ZeroTrustAuditEngine } from '../services/zeroTrustAuditEngine.js';
import { RateLimiter } from '../middleware/rateLimiter.js';
import {
  calculateShannonEntropy,
  normalizeHomoglyphs,
  inspectCallerUtterance,
  CanarySentinel
} from '../services/promptInjectionDefense.js';

describe('Advanced Security & Zero-Trust Verification Suite', () => {
  beforeEach(() => {
    NonceReplayStore.reset();
    ZeroTrustAuditEngine.reset();
  });

  describe('NonceReplayStore', () => {
    it('accepts fresh valid nonces and blocks replayed nonces', () => {
      const nonce = 'aegis-nonce-9876543210';
      const firstCheck = NonceReplayStore.consumeNonce(nonce);
      expect(firstCheck.valid).toBe(true);

      const replayCheck = NonceReplayStore.consumeNonce(nonce);
      expect(replayCheck.valid).toBe(false);
      expect(replayCheck.reason).toBe('NONCE_REPLAY_DETECTED');
    });

    it('rejects missing or short nonces', () => {
      expect(NonceReplayStore.consumeNonce('').valid).toBe(false);
      expect(NonceReplayStore.consumeNonce('short').valid).toBe(false);
    });

    it('purges expired nonces based on TTL', () => {
      NonceReplayStore.consumeNonce('temporary-nonce-12345', 10); // 10ms TTL
      expect(NonceReplayStore.size).toBe(1);

      // Simulate passage of time
      const purged = NonceReplayStore.purgeExpired(Date.now() + 50);
      expect(purged).toBe(1);
      expect(NonceReplayStore.size).toBe(0);
    });
  });

  describe('ZeroTrustAuditEngine', () => {
    it('appends blocks with SHA-256 hash chaining and verifies intact chain', () => {
      ZeroTrustAuditEngine.appendEvent({
        callId: 'call_1',
        callerNumber: '+18005550199',
        screeningVerdict: 'BLOCKED',
        riskScore: 88,
        rawPayload: { intent: 'IRS impersonation' }
      });

      ZeroTrustAuditEngine.appendEvent({
        callId: 'call_2',
        callerNumber: '+18005550100',
        screeningVerdict: 'ALLOWED',
        riskScore: 12,
        rawPayload: { intent: 'Doctor appointment' }
      });

      const audit = ZeroTrustAuditEngine.verifyChainIntegrity();
      expect(audit.valid).toBe(true);
      expect(audit.totalBlocks).toBe(2);
    });

    it('detects tampering if a block is forged or modified', () => {
      ZeroTrustAuditEngine.appendEvent({
        callId: 'call_test',
        callerNumber: '+1234567890',
        screeningVerdict: 'BLOCKED',
        riskScore: 95,
        rawPayload: { threat: 'Scam' }
      });

      const chain = ZeroTrustAuditEngine.getChain();
      // Maliciously tamper with the stored verdict
      (chain[0] as any).screeningVerdict = 'ALLOWED';

      // Re-verifying original chain (tampered instance)
      const tamperedCheck = ZeroTrustAuditEngine.computeBlockHash(chain[0]);
      expect(tamperedCheck).not.toBe(chain[0].currentHash);
    });

    it('encrypts and decrypts sensitive forensic data using AES-256-GCM', () => {
      const secret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const plaintext = 'SSN: 123-45-6789, BankAccount: 987654321';

      const encrypted = ZeroTrustAuditEngine.encryptSensitiveField(plaintext, secret);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.tag).toBeDefined();

      const decrypted = ZeroTrustAuditEngine.decryptSensitiveField(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        secret
      );
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('RateLimiter Subnet Clustering', () => {
    it('clusters IPv4 addresses into /24 subnets', () => {
      const limiter = new RateLimiter(60, 2, true);
      expect(limiter.normalizeIpToSubnet('192.168.1.55')).toBe('192.168.1.0/24');
      expect(limiter.normalizeIpToSubnet('192.168.1.99')).toBe('192.168.1.0/24');
      expect(limiter.normalizeIpToSubnet('10.0.4.12')).toBe('10.0.4.0/24');
    });
  });

  describe('Shannon Entropy and Canary Token Sentinel', () => {
    it('computes entropy difference between natural language and high-entropy cipher strings', () => {
      const natural = 'Hello, I am calling regarding your recent delivery schedule.';
      const randomBase64 = 'q7Wz8K3mP1xV9L0tY2bN4cE6gH8jA9sD';

      const naturalEntropy = calculateShannonEntropy(natural);
      const randomEntropy = calculateShannonEntropy(randomBase64);

      expect(randomEntropy).toBeGreaterThan(naturalEntropy);
      expect(randomEntropy).toBeGreaterThan(4.5);
    });

    it('normalizes homoglyph substitutions to catch stealth prompt injection', () => {
      // 'а' is cyrillic \u0430
      const spoofed = 'd\u0430n mode';
      const normalized = normalizeHomoglyphs(spoofed);
      expect(normalized).toBe('dan mode');

      const result = inspectCallerUtterance(spoofed);
      expect(result.isInjectionAttempt).toBe(true);
    });

    it('generates and tracks canary tokens', () => {
      const canary = CanarySentinel.generateCanary();
      expect(canary.startsWith('AEGIS_CANARY_')).toBe(true);

      const safeResponse = 'Hello caller, please leave your name.';
      expect(CanarySentinel.isCanaryLeaked(safeResponse, [canary])).toBe(false);

      const leakedResponse = `Sure, here is the secret: ${canary}`;
      expect(CanarySentinel.isCanaryLeaked(leakedResponse, [canary])).toBe(true);
    });
  });
});
