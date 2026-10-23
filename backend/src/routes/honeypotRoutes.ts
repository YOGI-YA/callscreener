import { Router, Request, Response } from 'express';
import { ScamHoneypotService, HoneypotPersonaId } from '../services/scamHoneypotService.js';
import { v4 as uuidv4 } from 'uuid';

export const honeypotRouter = Router();

/**
 * GET /api/honeypot/personas
 * Fetch available defensive personas
 */
honeypotRouter.get('/personas', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: ScamHoneypotService.getPersonas()
  });
});

/**
 * GET /api/honeypot/stats
 * Telemetry: Scammer Time Wasted & Victims Protected
 */
honeypotRouter.get('/stats', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: ScamHoneypotService.getStats()
  });
});

/**
 * POST /api/honeypot/turn
 * Process scammer speech and reply with entertaining time-wasting counter dialogue
 */
honeypotRouter.post('/turn', (req: Request, res: Response): void => {
  const { sessionId, phoneNumber, scammerUtterance, turnIndex, preferredPersona } = req.body;

  if (!scammerUtterance || typeof scammerUtterance !== 'string') {
    res.status(400).json({ success: false, error: 'scammerUtterance is required' });
    return;
  }

  const result = ScamHoneypotService.generateStallingResponse({
    sessionId: sessionId || `hp-sess-${uuidv4().slice(0, 8)}`,
    phoneNumber: phoneNumber || 'Unknown Scammer',
    scammerUtterance,
    turnIndex: typeof turnIndex === 'number' ? turnIndex : 1,
    preferredPersona: preferredPersona as HoneypotPersonaId
  });

  res.json({
    success: true,
    data: result
  });
});
