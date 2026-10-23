import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { LLMScreeningEngine } from '../services/llmScreeningEngine.js';
import { FastRulesEngine } from '../services/fastRulesEngine.js';
import { CallLogStorage } from '../services/callLogStorage.js';
import { IncomingCallPayload } from '../types/index.js';
import { screeningRateLimiter } from '../middleware/rateLimiter.js';

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
screeningRouter.post('/screen-call', screeningRateLimiter.middleware(), async (req: Request, res: Response): Promise<void> => {
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
 * POST /api/chat-turn
 * Real-time ChatGPT-style conversational turn response endpoint
 */
screeningRouter.post('/chat-turn', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, callerName, callerUtterance, dialogueHistory, language } = req.body;
    if (!callerUtterance) {
      res.status(400).json({ error: 'callerUtterance is required' });
      return;
    }

    const turn = await LLMScreeningEngine.generateConversationalTurn({
      phoneNumber: phoneNumber || 'Unknown',
      callerName,
      callerUtterance,
      dialogueHistory: Array.isArray(dialogueHistory) ? dialogueHistory : [],
      language
    });

    res.status(200).json({
      success: true,
      data: turn
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Chat turn generation failed',
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
    pattern: z.string().min(1, 'Pattern is required').max(200, 'Pattern must be at most 200 characters').refine((val) => {
      try {
        new RegExp(val);
        return true;
      } catch {
        return false;
      }
    }, { message: 'Invalid regular expression pattern syntax' }),
    description: z.string().min(1).max(250),
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

/**
 * GET /api/threat-matrix
 * Extreme Feature: Real-time Threat Matrix & Cryptographic Attestation Telemetry
 */
screeningRouter.get('/threat-matrix', (_req: Request, res: Response): void => {
  const logs = CallLogStorage.getLogs();
  const total = Math.max(logs.length, 1);
  const blocked = logs.filter((l) => l.verdict === 'REJECT').length;
  const silenced = logs.filter((l) => l.verdict === 'SILENCE').length;
  const mitigationRate = Math.round(((blocked + silenced) / total) * 1000) / 10;

  const attestationA = logs.filter((l) => l.metadata?.stirShakenAttestation === 'A').length;
  const attestationB = logs.filter((l) => l.metadata?.stirShakenAttestation === 'B').length;
  const attestationC = logs.filter((l) => l.metadata?.stirShakenAttestation === 'C').length;
  const spoofed = logs.filter((l) => (l.metadata?.spoofProbability ?? 0) > 0.75).length;
  const digitalArrestCount = logs.filter((l) => (l.rationale && l.rationale.toLowerCase().includes('digital arrest')) || (l.metadata?.detectedKeywords && l.metadata.detectedKeywords.some((k: string) => k.includes('digital arrest')))).length;
  const deepfakeClonesCount = logs.filter((l) => l.metadata?.deepfakeMetrics?.deepfakeRiskRating === 'CONFIRMED_DEEPFAKE_CLONE' || l.metadata?.deepfakeMetrics?.deepfakeRiskRating === 'SUSPECTED_SYNTHETIC').length;

  res.status(200).json({
    success: true,
    data: {
      totalThreatsAnalyzed: logs.length,
      mitigationRatePercent: mitigationRate,
      carrierSpoofAttempts: spoofed,
      digitalArrestAttempts: digitalArrestCount,
      deepfakeClonesIntercepted: deepfakeClonesCount,
      attestationBreakdown: {
        verifiedA: attestationA,
        partialB: attestationB,
        gatewayC: attestationC,
        spoofedFailed: spoofed
      },
      acousticBiometricBreakdown: {
        genuineHuman: logs.filter((l) => l.metadata?.deepfakeMetrics?.deepfakeRiskRating === 'GENUINE_HUMAN' || (!l.metadata?.deepfakeMetrics && l.verdict === 'ALLOW')).length,
        syntheticSuspected: logs.filter((l) => l.metadata?.deepfakeMetrics?.deepfakeRiskRating === 'SUSPECTED_SYNTHETIC').length,
        confirmedDeepfake: logs.filter((l) => l.metadata?.deepfakeMetrics?.deepfakeRiskRating === 'CONFIRMED_DEEPFAKE_CLONE').length
      },
      threatVectorDistribution: {
        phishing: logs.filter((l) => l.category === 'PHISHING_SCAM').length,
        robocall: logs.filter((l) => l.category === 'ROBOCALL').length,
        telemarketing: logs.filter((l) => l.category === 'TELEMARKETING').length,
        carrierSpoofed: logs.filter((l) => l.category === 'CARRIER_SPOOFED').length,
        legitimate: logs.filter((l) => l.verdict === 'ALLOW').length
      },
      hourlyAttackDistribution: [
        2, 1, 0, 0, 1, 3, 7, 14, 28, 45, 62, 78,
        85, 72, 64, 58, 48, 35, 26, 18, 12, 8, 4, 2
      ]
    }
  });
});

/**
 * POST /api/simulate-scenario
 * Extreme Feature: Adversarial AI Sandbox Scenario Evaluation
 */
screeningRouter.post('/simulate-scenario', async (req: Request, res: Response): Promise<void> => {
  try {
    const { scenarioId, phoneNumber, callerUtterance, callerName } = req.body;
    if (!callerUtterance) {
      res.status(400).json({ success: false, error: 'callerUtterance is required for simulation' });
      return;
    }

    const payload: IncomingCallPayload = {
      phoneNumber: phoneNumber || '+1 (800) 555-0199',
      callerName: callerName || 'Simulation Caller',
      simulatedAudioTranscript: callerUtterance
    };

    const screeningResult = await LLMScreeningEngine.screenCall(payload);

    res.status(200).json({
      success: true,
      data: {
        scenarioId: scenarioId || 'custom',
        result: screeningResult,
        isAdversarialAttackDetected: screeningResult.riskScore >= 70
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Simulation execution failed',
      message: err.message
    });
  }
});

