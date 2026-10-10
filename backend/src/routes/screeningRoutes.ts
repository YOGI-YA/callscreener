import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { LLMScreeningEngine } from '../services/llmScreeningEngine.js';
import { FastRulesEngine } from '../services/fastRulesEngine.js';
import { CallLogStorage } from '../services/callLogStorage.js';
import { IncomingCallPayload } from '../types/index.js';

export const screeningRouter = Router();

// Validation schema for incoming call
const screenCallSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  callerName: z.string().optional(),
  location: z.string().optional(),
  carrier: z.string().optional(),
  timestamp: z.string().optional(),
  simulatedAudioTranscript: z.string().optional(),
  callerIntent: z.string().optional(),
  contactExistsInAddressBook: z.boolean().optional(),
  callPresentationMode: z.enum(['ALLOWED', 'RESTRICTED', 'UNKNOWN', 'PAYPHONE']).optional()
});

/**
 * POST /api/screen-call
 * Real-time screening endpoint invoked by Android CallScreeningService or Simulator
 */
screeningRouter.post('/screen-call', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = screenCallSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid call payload',
        details: parseResult.error.format()
      });
      return;
    }

    const payload: IncomingCallPayload = parseResult.data;
    const result = await LLMScreeningEngine.screenCall(payload);

    // Save to history storage
    CallLogStorage.addLog(result);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Internal screening failure',
      message: error.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/rules
 * Fetch screening rules (used by Android client for offline synchronization)
 */
screeningRouter.get('/rules', (_req: Request, res: Response): void => {
  const rules = FastRulesEngine.getRules();
  res.status(200).json({
    success: true,
    data: rules
  });
});

/**
 * POST /api/rules
 * Create custom screening rule
 */
screeningRouter.post('/rules', (req: Request, res: Response): void => {
  const schema = z.object({
    type: z.enum(['WHITELIST', 'BLACKLIST', 'PREFIX_BLOCK', 'KEYWORD_BLOCK']),
    pattern: z.string().min(1),
    description: z.string().min(1),
    action: z.enum(['ALLOW', 'SILENCE', 'REJECT']),
    enabled: z.boolean().default(true)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid rule definition', details: parsed.error.format() });
    return;
  }

  const created = FastRulesEngine.addRule(parsed.data);
  res.status(201).json({ success: true, data: created });
});

/**
 * DELETE /api/rules/:id
 * Remove custom screening rule
 */
screeningRouter.delete('/rules/:id', (req: Request, res: Response): void => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const success = FastRulesEngine.removeRule(id);
  if (!success) {
    res.status(404).json({ success: false, error: 'Rule not found or is protected system rule' });
    return;
  }
  res.status(200).json({ success: true, message: 'Rule removed' });
});
