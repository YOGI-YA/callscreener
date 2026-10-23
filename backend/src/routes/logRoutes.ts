import { Router, Request, Response } from 'express';
import { CallLogStorage } from '../services/callLogStorage.js';

export const logRouter = Router();

/**
 * GET /api/logs
 * Retrieve screened call logs with search, filter, and pagination
 */
logRouter.get('/', (req: Request, res: Response): void => {
  const { search, verdict, category, riskLevel, limit } = req.query;

  let parsedLimit: number | undefined = undefined;
  if (limit) {
    const rawNum = parseInt(limit as string, 10);
    if (!isNaN(rawNum) && rawNum > 0) {
      parsedLimit = Math.min(rawNum, 500); // Clamped between 1 and 500 to prevent DoS
    }
  }

  const sanitizedSearch = typeof search === 'string' ? search.trim().slice(0, 100) : undefined;

  const logs = CallLogStorage.getLogs({
    search: sanitizedSearch,
    verdict: typeof verdict === 'string' ? verdict : undefined,
    category: typeof category === 'string' ? category : undefined,
    riskLevel: typeof riskLevel === 'string' ? riskLevel : undefined,
    limit: parsedLimit
  });

  res.status(200).json({
    success: true,
    count: logs.length,
    data: logs
  });
});

/**
 * GET /api/logs/stats
 * Aggregate dashboard metrics
 */
logRouter.get('/stats', (_req: Request, res: Response): void => {
  const stats = CallLogStorage.getStats();
  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * GET /api/logs/:id
 * Single call log details
 */
logRouter.get('/:id', (req: Request, res: Response): void => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const log = CallLogStorage.getLogById(id);
  if (!log) {
    res.status(404).json({ success: false, error: 'Log entry not found' });
    return;
  }
  res.status(200).json({ success: true, data: log });
});

/**
 * DELETE /api/logs/:id
 * Delete single log entry
 */
logRouter.delete('/:id', (req: Request, res: Response): void => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const success = CallLogStorage.deleteLog(id);
  if (!success) {
    res.status(404).json({ success: false, error: 'Log entry not found' });
    return;
  }
  res.status(200).json({ success: true, message: 'Log deleted' });
});

/**
 * POST /api/logs/clear
 * Clear all history
 */
logRouter.post('/clear', (_req: Request, res: Response): void => {
  CallLogStorage.clearAll();
  res.status(200).json({ success: true, message: 'All logs cleared' });
});
