import { describe, it, expect, beforeEach } from 'vitest';
import { FastRulesEngine } from '../services/fastRulesEngine.js';

describe('FastRulesEngine', () => {
  const startTime = Date.now();

  it('allows emergency phone numbers immediately with SAFE score', () => {
    const result = FastRulesEngine.evaluate(
      {
        phoneNumber: '911',
        callerName: 'Emergency Services'
      },
      startTime
    );

    expect(result).not.toBeNull();
    expect(result?.verdict).toBe('ALLOW');
    expect(result?.riskScore).toBeLessThanOrEqual(5);
    expect(result?.suggestedActions.disallowCall).toBe(false);
  });

  it('allows verified address book contacts unconditionally', () => {
    const result = FastRulesEngine.evaluate(
      {
        phoneNumber: '+1-555-123-4567',
        callerName: 'Mom',
        contactExistsInAddressBook: true
      },
      startTime
    );

    expect(result).not.toBeNull();
    expect(result?.verdict).toBe('ALLOW');
    expect(result?.category).toBe('VERIFIED_CONTACT');
    expect(result?.suggestedActions.disallowCall).toBe(false);
  });

  it('blocks premium rate toll fraud numbers (+1-900)', () => {
    const result = FastRulesEngine.evaluate(
      {
        phoneNumber: '+1-900-555-0199',
        callerName: 'Toll Service'
      },
      startTime
    );

    expect(result).not.toBeNull();
    expect(result?.verdict).toBe('REJECT');
    expect(result?.riskScore).toBeGreaterThanOrEqual(90);
    expect(result?.suggestedActions.disallowCall).toBe(true);
    expect(result?.suggestedActions.rejectCall).toBe(true);
  });

  it('detects high-risk scam keywords in opening transcript', () => {
    const result = FastRulesEngine.evaluate(
      {
        phoneNumber: '+1-202-555-0177',
        callerName: 'Federal Agency',
        simulatedAudioTranscript: 'This is the IRS warrant department, you have an arrest warrant pending.'
      },
      startTime
    );

    expect(result).not.toBeNull();
    expect(result?.verdict).toBe('REJECT');
    expect(result?.category).toBe('PHISHING_SCAM');
    expect(result?.riskScore).toBeGreaterThanOrEqual(95);
  });

  it('supports dynamically adding and removing custom whitelist rules', () => {
    const customRule = FastRulesEngine.addRule({
      type: 'WHITELIST',
      pattern: '^\\+1-212-555-0000$',
      description: 'Corporate HQ Whitelist',
      action: 'ALLOW',
      enabled: true
    });

    expect(customRule.id).toBeDefined();

    const evaluated = FastRulesEngine.evaluate(
      {
        phoneNumber: '+1-212-555-0000',
        callerName: 'Corporate Office'
      },
      startTime
    );

    expect(evaluated?.verdict).toBe('ALLOW');
    expect(evaluated?.engine).toBe('WHITELIST_RULE');

    FastRulesEngine.removeRule(customRule.id);
  });

  it('generates safe fallback when requested', () => {
    const fallback = FastRulesEngine.generateSafetyFallback(
      { phoneNumber: '+1-415-555-9999' },
      startTime,
      'Test timeout'
    );

    expect(fallback.verdict).toBe('ALLOW');
    expect(fallback.engine).toBe('FAST_LOCAL_FALLBACK');
    expect(fallback.rationale).toContain('Test timeout');
  });
});
