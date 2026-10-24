import { describe, it, expect, beforeEach } from 'vitest';
import { EmergencySafeWordEngine } from '../services/emergencySafeWordEngine.js';
import { AcousticBotDetector } from '../services/acousticBotDetector.js';
import { FraudReportGenerator } from '../services/fraudReportGenerator.js';
import { WebhookDispatcher } from '../services/webhookDispatcher.js';
import { LLMScreeningEngine } from '../services/llmScreeningEngine.js';
import { ScreeningResult } from '../types/index.js';

describe('Emergency Voice Override & Acoustic Bot Fingerprinting Test Suite', () => {

  describe('EmergencySafeWordEngine', () => {
    beforeEach(() => {
      EmergencySafeWordEngine.updateConfig({
        enabled: true,
        safeWords: ['falcon blue', 'code red', 'emergency override', 'family sos', 'distress bypass']
      });
    });

    it('immediately grants ALLOW verdict when emergency safe-word is uttered by caller', () => {
      const payload = {
        phoneNumber: '+19998887777',
        callerName: 'Unknown Stalker Number',
        simulatedAudioTranscript: 'Hello please listen to me, falcon blue! I need help right now!'
      };

      const result = EmergencySafeWordEngine.evaluate(payload, Date.now());
      expect(result).not.toBeNull();
      expect(result?.verdict).toBe('ALLOW');
      expect(result?.riskScore).toBe(0);
      expect(result?.riskLevel).toBe('SAFE');
      expect(result?.category).toBe('EMERGENCY_OVERRIDE');
      expect(result?.engine).toBe('EMERGENCY_SAFEWORD');
      expect(result?.metadata?.emergencyOverrideTriggered).toBe(true);
      expect(result?.metadata?.detectedKeywords).toContain('falcon blue');
    });

    it('returns null if no emergency safe-word is present in caller utterance', () => {
      const payload = {
        phoneNumber: '+19998887777',
        simulatedAudioTranscript: 'Good morning, calling regarding your electricity bill payment.'
      };

      const result = EmergencySafeWordEngine.evaluate(payload, Date.now());
      expect(result).toBeNull();
    });

    it('supports adding and detecting custom family safe-words', () => {
      const added = EmergencySafeWordEngine.addSafeWord('pineapple express 99');
      expect(added).toBe(true);

      const payload = {
        phoneNumber: '+1234567890',
        simulatedAudioTranscript: 'Mom, my phone battery died, this is pineapple express 99, pick up!'
      };

      const result = EmergencySafeWordEngine.evaluate(payload, Date.now());
      expect(result).not.toBeNull();
      expect(result?.verdict).toBe('ALLOW');
      expect(result?.metadata?.detectedKeywords).toContain('pineapple express 99');

      // Cleanup
      EmergencySafeWordEngine.removeSafeWord('pineapple express 99');
    });

    it('bypasses normal spam screening in LLMScreeningEngine when safe-word is present', async () => {
      const res = await LLMScreeningEngine.screenCall({
        phoneNumber: '+19001234567', // Normally blacklisted prefix
        simulatedAudioTranscript: 'Urgent family sos! Please pick up the phone!'
      });

      expect(res.verdict).toBe('ALLOW');
      expect(res.category).toBe('EMERGENCY_OVERRIDE');
      expect(res.engine).toBe('EMERGENCY_SAFEWORD');
    });
  });

  describe('AcousticBotDetector & Audio Anomaly Fingerprinting', () => {
    it('detects pre-recorded robocall soundboard scripts and assigns high cadence score', () => {
      const script = 'Press 1 to speak with an agent or stay on the line for an important message about your car warranty.';
      const telemetry = AcousticBotDetector.analyzeAcousticTelemetry(script);

      expect(telemetry.isRobocallBot).toBe(true);
      expect(telemetry.roboticCadenceScore).toBeGreaterThanOrEqual(75);
      expect(telemetry.soundboardConfidence).toBeGreaterThanOrEqual(0.7);
      expect(telemetry.audioFingerprintHash).toMatch(/^ROBO-VOX-[A-F0-9]{16}$/);
    });

    it('classifies organic human conversational audio as non-robocall', () => {
      const human = 'Hey Sarah, are we still meeting up for coffee at Starbucks around four thirty today? Let me know!';
      const telemetry = AcousticBotDetector.analyzeAcousticTelemetry(human);

      expect(telemetry.isRobocallBot).toBe(false);
      expect(telemetry.soundboardConfidence).toBeLessThan(0.4);
    });

    it('attaches acoustic bot telemetry into LLMScreeningEngine metadata', async () => {
      const screening = await LLMScreeningEngine.screenCall({
        phoneNumber: '+18885551234',
        simulatedAudioTranscript: 'This is a recorded message regarding your federal student loan qualification. Press 1 now.'
      });

      expect(screening.metadata?.acousticBotTelemetry).toBeDefined();
      expect(screening.metadata?.acousticBotTelemetry?.isRobocallBot).toBe(true);
      expect(screening.metadata?.acousticBotTelemetry?.audioFingerprintHash).toBeDefined();
    });
  });

  describe('FraudReportGenerator', () => {
    const mockLog: ScreeningResult = {
      id: 'scr-test-1234',
      phoneNumber: '+18005559999',
      callerName: 'Fake Federal Agent',
      verdict: 'REJECT',
      riskScore: 99,
      riskLevel: 'CRITICAL_SPAM',
      category: 'PHISHING_SCAM',
      confidence: 0.99,
      rationale: 'Digital arrest impersonation scam detected.',
      engine: 'LLM_AI',
      latencyMs: 120,
      timestamp: '2026-10-24T18:00:00.000Z',
      suggestedActions: {
        disallowCall: true,
        silenceCall: false,
        rejectCall: true,
        skipCallLog: false,
        skipNotification: true
      },
      metadata: {
        spoofProbability: 0.95,
        acousticBotTelemetry: {
          isRobocallBot: true,
          roboticCadenceScore: 92,
          spectralFlatnessScore: 88,
          soundboardConfidence: 0.96,
          audioFingerprintHash: 'ROBO-VOX-A1B2C3D4E5F67890'
        }
      }
    };

    it('generates standard FTC incident report payload', () => {
      const report = FraudReportGenerator.generateIncidentReport(mockLog, 'FTC');
      expect(report.reportingAgency).toBe('FTC');
      expect(report.reportId).toContain('REP-FTC-');
      expect(report.incidentDetails.callerNumber).toBe('+18005559999');
      expect(report.incidentDetails.syntheticArtifacts).toBe(true);
    });

    it('generates valid regulatory CSV string with headers and incident data', () => {
      const csv = FraudReportGenerator.generateCsvExport([mockLog]);
      expect(csv).toContain('Incident_ID,Timestamp,Caller_Number');
      expect(csv).toContain('+18005559999');
      expect(csv).toContain('ROBO-VOX-A1B2C3D4E5F67890');
      expect(csv).toContain('REJECT');
    });

    it('generates legal affidavit document format', () => {
      const affidavit = FraudReportGenerator.generateLegalAffidavit(mockLog);
      expect(affidavit).toContain('AEGISCALL AI TELECOM SECURITY - INCIDENT REPORT & AFFIDAVIT');
      expect(affidavit).toContain('Fake Federal Agent');
      expect(affidavit).toContain('ROBO-VOX-A1B2C3D4E5F67890');
      expect(affidavit).toContain('FCC TCPA Robocall Enforcement');
    });
  });

  describe('WebhookDispatcher', () => {
    it('computes authentic HMAC SHA256 signatures for webhook delivery', () => {
      const payload = '{"test":true,"alert":"CRITICAL"}';
      const secret = 'super-secret-key-12345';
      const signature = WebhookDispatcher.computeSignature(payload, secret);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64); // SHA-256 hex digest length
    });
  });
});
