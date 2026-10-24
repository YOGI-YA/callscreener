import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Timing-safe API Key & Bearer Token Authentication Middleware
 * ─────────────────────────────────────────────────────────────
 * Protects screening endpoints from unauthorized third-party telemetry scraping
 * or forged carrier screening payloads. Uses constant-time buffer comparison.
 */
export function requireApiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Allow health check, root status, and preflight CORS OPTIONS to bypass
  if (req.method === 'OPTIONS' || req.path === '/' || req.path === '/api/health' || req.path.startsWith('/api/health/')) {
    return next();
  }

  // Allow test environment to bypass unless explicitly testing authentication
  const enforceInTest = req.headers['x-enforce-auth-test'] === 'true';
  const isEnforced = process.env.AEGIS_REQUIRE_AUTH === 'true' || enforceInTest;

  if (!isEnforced && (process.env.NODE_ENV === 'test' || config.isDev)) {
    return next();
  }

  const configuredKey = config.apiSecretKey;
  if (!configuredKey) {
    return next();
  }

  // Check x-api-token header or Authorization: Bearer <token>
  const headerToken = req.headers['x-api-token'] as string | undefined;
  const authHeader = req.headers['authorization'] as string | undefined;
  let bearerToken: string | undefined = undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }

  const providedToken = headerToken || bearerToken;

  if (!providedToken) {
    res.status(401).json({
      success: false,
      error: 'AUTH_REQUIRED',
      message: 'Missing x-api-token header or Bearer authorization token',
    });
    return;
  }

  // Constant-time comparison using fixed-size SHA-256 digests to prevent length-leakage timing attacks
  const expectedHash = crypto.createHash('sha256').update(configuredKey).digest();
  const providedHash = crypto.createHash('sha256').update(providedToken).digest();

  if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
    res.status(403).json({
      success: false,
      error: 'AUTH_INVALID',
      message: 'Invalid API secret key token',
    });
    return;
  }

  next();
}
