import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CallLogStorage } from '../services/callLogStorage.js';
import { FastRulesEngine } from '../services/fastRulesEngine.js';
import { MediaRetentionManager } from '../services/mediaRetentionManager.js';
import fs from 'fs';
import path from 'path';

describe('Storage Persistence & Media Retention Tests', () => {
  const testDataDir = path.resolve(process.cwd(), 'data');
  const tempDir = path.resolve(testDataDir, 'test_temp_audio');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('persists and retrieves call logs reliably across storage cycles', () => {
    const testLog = {
      id: `test-log-${Date.now()}`,
      phoneNumber: '+1 (555) 019-9999',
      callerName: 'Persistence Check',
      verdict: 'ALLOW' as const,
      riskScore: 5,
      riskLevel: 'SAFE' as const,
      category: 'VERIFIED_CONTACT',
      confidence: 0.95,
      rationale: 'Valid caller test',
      engine: 'FAST_LOCAL_FALLBACK' as const,
      latencyMs: 2,
      timestamp: new Date().toISOString(),
      suggestedActions: { disallowCall: false, silenceCall: false, rejectCall: false }
    };

    CallLogStorage.addLog(testLog);
    const retrieved = CallLogStorage.getLogById(testLog.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.phoneNumber).toBe(testLog.phoneNumber);

    // Delete log
    const deleted = CallLogStorage.deleteLog(testLog.id);
    expect(deleted).toBe(true);
    expect(CallLogStorage.getLogById(testLog.id)).toBeUndefined();
  });

  it('adds and retains custom rules with validation and persistence', () => {
    const customRule = FastRulesEngine.addRule({
      type: 'PREFIX_BLOCK',
      pattern: '^(\\+?44(70|71))',
      description: 'UK Personal Numbering Service Surcharge',
      action: 'REJECT',
      enabled: true
    });

    expect(customRule.id).toBeDefined();
    const allRules = FastRulesEngine.getRules();
    const found = allRules.find((r) => r.id === customRule.id);
    expect(found).toBeDefined();

    // Clean up
    const removed = FastRulesEngine.removeRule(customRule.id);
    expect(removed).toBe(true);
  });

  it('prunes expired audio files according to retention policy', () => {
    // Create a mock stale file (simulating file older than 30 days)
    const staleFilePath = path.join(tempDir, 'stale_call_2025.wav');
    fs.writeFileSync(staleFilePath, 'mock wav audio data');

    // Artificially age the file
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    fs.utimesSync(staleFilePath, thirtyOneDaysAgo, thirtyOneDaysAgo);

    const freshFilePath = path.join(tempDir, 'fresh_call_today.wav');
    fs.writeFileSync(freshFilePath, 'fresh wav audio data');

    MediaRetentionManager.setPolicy({ enabled: true, maxAgeDays: 30 });
    const result = MediaRetentionManager.runCleanup([tempDir]);

    expect(result.filesScanned).toBeGreaterThanOrEqual(2);
    expect(result.filesDeleted).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(staleFilePath)).toBe(false);
    expect(fs.existsSync(freshFilePath)).toBe(true);
  });
});
