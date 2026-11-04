import { describe, it, expect } from 'vitest';
import { maskSensitiveText, extractSensitiveTokens } from '../services/sensitiveDataMasker.js';
import { AcousticBotDetector } from '../services/acousticBotDetector.js';
import { WebhookDispatcher } from '../services/webhookDispatcher.js';

describe('SensitiveDataMasker, Acoustic RMS & Webhook Security Suite', () => {
  describe('SensitiveDataMasker', () => {
    it('masks credit card numbers correctly preserving only first 4 and last 4 digits', () => {
      const text = 'Payment made with Visa 4111-2222-3333-4444 on record.';
      const masked = maskSensitiveText(text);
      expect(masked).toContain('4111 **** **** 4444');
      expect(masked).not.toContain('2222');
      expect(masked).not.toContain('3333');
    });

    it('masks Social Security Numbers (SSN)', () => {
      const text = 'Caller provided SSN 123-45-6789 for tax identification.';
      const masked = maskSensitiveText(text);
      expect(masked).toContain('[REDACTED_SSN]');
      expect(masked).not.toContain('123-45-6789');
    });

    it('masks One-Time Passwords (OTP) and verification codes in transcripts', () => {
      const text = 'Your bank verification code is 492019 for transfer authorization.';
      const masked = maskSensitiveText(text);
      expect(masked).toContain('[REDACTED_OTP]');
      expect(masked).not.toContain('492019');
    });

    it('extracts sensitive tokens accurately for authorized retrieval', () => {
      const text = 'Please confirm your OTP is 982104 and card 5500 1234 5678 9012.';
      const tokens = extractSensitiveTokens(text);
      expect(tokens.length).toBeGreaterThanOrEqual(2);

      const otpToken = tokens.find((t) => t.type === 'OTP');
      expect(otpToken).toBeDefined();
      expect(otpToken?.rawFragment).toBe('982104');
      expect(otpToken?.maskedValue).toContain('***04');

      const ccToken = tokens.find((t) => t.type === 'CREDIT_CARD');
      expect(ccToken).toBeDefined();
      expect(ccToken?.maskedValue).toBe('5500 **** **** 9012');
    });

    it('handles empty or null text safely without crashing', () => {
      expect(maskSensitiveText('')).toBe('');
      expect(maskSensitiveText(null)).toBe('');
      expect(extractSensitiveTokens(null)).toEqual([]);
    });
  });

  describe('AcousticBotDetector RMS Energy Hardening', () => {
    it('returns -96 dBFS silence floor for null, empty or zero-length audio buffers', () => {
      expect(AcousticBotDetector.calculateRmsDbfs(null)).toBe(-96);
      expect(AcousticBotDetector.calculateRmsDbfs(Buffer.alloc(0))).toBe(-96);
      expect(AcousticBotDetector.calculateRmsDbfs(new Int16Array(0))).toBe(-96);
    });

    it('handles pure digital zero silence without returning NaN or -Infinity', () => {
      const silentBuffer = Buffer.alloc(1600); // 1600 bytes of zeros
      const dbfs = AcousticBotDetector.calculateRmsDbfs(silentBuffer);
      expect(Number.isFinite(dbfs)).toBe(true);
      expect(dbfs).toBe(-96);
    });

    it('calculates valid dBFS energy for PCM voice samples', () => {
      // 16-bit PCM buffer with mid-range amplitude ~16384 (approx -6 dBFS)
      const pcmBuffer = Buffer.alloc(3200);
      for (let i = 0; i < 1600; i++) {
        pcmBuffer.writeInt16LE(16384, i * 2);
      }
      const dbfs = AcousticBotDetector.calculateRmsDbfs(pcmBuffer);
      expect(Number.isFinite(dbfs)).toBe(true);
      expect(dbfs).toBeGreaterThan(-10);
      expect(dbfs).toBeLessThan(0);
    });
  });

  describe('WebhookDispatcher HMAC Security Verification', () => {
    const payload = JSON.stringify({ event: 'CALL_CRITICAL_THREAT_BLOCKED', phone: '+18005550199' });
    const secret = 'super_secret_enterprise_token_xyz987';

    it('generates reproducible HMAC SHA-256 signature', () => {
      const sig1 = WebhookDispatcher.computeSignature(payload, secret);
      const sig2 = WebhookDispatcher.computeSignature(payload, secret);
      expect(sig1).toBe(sig2);
      expect(sig1.length).toBe(64); // SHA-256 hex is 64 chars
    });

    it('verifies authentic signatures with timingSafeEqual', () => {
      const sig = WebhookDispatcher.computeSignature(payload, secret);
      const isValid = WebhookDispatcher.verifySignature(payload, sig, secret);
      expect(isValid).toBe(true);
    });

    it('rejects tampered payloads and forged signatures', () => {
      const sig = WebhookDispatcher.computeSignature(payload, secret);
      const tamperedPayload = JSON.stringify({ event: 'CALL_CRITICAL_THREAT_BLOCKED', phone: '+18009999999' });

      expect(WebhookDispatcher.verifySignature(tamperedPayload, sig, secret)).toBe(false);
      expect(WebhookDispatcher.verifySignature(payload, 'deadbeef'.repeat(8), secret)).toBe(false);
      expect(WebhookDispatcher.verifySignature('', sig, secret)).toBe(false);
    });
  });
});
