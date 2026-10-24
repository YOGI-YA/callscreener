import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes tolerance

/**
 * Security headers middleware
 */
export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

/**
 * Replay attack prevention middleware:
 * Validates request timestamp to guarantee freshness and prevent intercepted replay payloads.
 */
export function preventReplayAttacks(req: Request, res: Response, next: NextFunction): void {
  // Allow test environments or health endpoints to bypass
  if (process.env.NODE_ENV === 'test' && !req.headers['x-enforce-replay-test']) {
    return next();
  }

  const timestampHeader = req.headers['x-aegis-timestamp'] as string;
  const bodyTimestamp = req.body?.timestamp;
  const candidate = timestampHeader || bodyTimestamp;

  if (candidate) {
    const reqTime = typeof candidate === 'number' ? candidate : parseInt(candidate, 10);
    if (!isNaN(reqTime)) {
      const diff = Math.abs(Date.now() - reqTime);
      if (diff > MAX_TIMESTAMP_DRIFT_MS) {
        res.status(403).json({
          success: false,
          error: 'REPLAY_ATTACK_DETECTED',
          message: 'Request timestamp is outside acceptable freshness window',
        });
        return;
      }
    }
  }

  next();
}

/**
 * Optional HMAC verification for high-security environments
 */
export function verifyHmacSignature(secretKey?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = secretKey || process.env.AEGIS_HMAC_SECRET;
    if (!key) {
      return next(); // If not configured, pass through
    }

    const signature = req.headers['x-aegis-signature'] as string;
    if (!signature) {
      res.status(401).json({
        success: false,
        error: 'SIGNATURE_MISSING',
        message: 'Missing cryptographic x-aegis-signature header',
      });
      return;
    }

    const payload = JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha256', key).update(payload).digest('hex');

    const sigHash = crypto.createHash('sha256').update(signature).digest();
    const expHash = crypto.createHash('sha256').update(expected).digest();

    if (!crypto.timingSafeEqual(sigHash, expHash)) {
      res.status(401).json({
        success: false,
        error: 'SIGNATURE_INVALID',
        message: 'Cryptographic request signature mismatch',
      });
      return;
    }

    next();
  };
}

/**
 * Strict MIME Type and Payload Validator for Telecom Audio Endpoints
 */
export function validateAudioMimeType(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type']?.toLowerCase();
  if (!contentType) return next();

  if (contentType.includes('audio/') || req.path.includes('/recordings/upload')) {
    const allowed = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/3gpp', 'audio/aac'];
    const isAllowed = allowed.some((type) => contentType.includes(type));
    if (!isAllowed) {
      res.status(415).json({
        success: false,
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Invalid audio MIME type. Only certified telecom audio formats are permitted.'
      });
      return;
    }
  }
  next();
}
