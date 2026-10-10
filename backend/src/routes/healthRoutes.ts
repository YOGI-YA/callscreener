import { Router, Request, Response } from 'express';
import { config } from '../config.js';

export const healthRouter = Router();

/**
 * GET /api/health
 * Health check & status endpoint
 */
healthRouter.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'online',
    service: 'AI Android Call Screener Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      port: config.port,
      environment: config.nodeEnv,
      llmConfigured: Boolean(config.geminiApiKey),
      llmModel: config.llmModel,
      llmTimeoutMs: config.llmTimeoutMs
    }
  });
});
