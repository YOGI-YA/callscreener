import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global mocks for browser testing
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/api/health')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'online', service: 'Test Backend' })
    });
  }
  if (url.includes('/api/logs/stats')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            totalCallsScreened: 12,
            totalSpamBlocked: 10,
            totalCallsSilenced: 1,
            totalCallsAllowed: 1,
            averageRiskScore: 82,
            averageLatencyMs: 95,
            spamBlockRate: 83
          }
        })
    });
  }
  if (url.includes('/api/logs')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 'test-1',
              phoneNumber: '+1-800-555-0199',
              callerName: 'IRS Impersonator',
              verdict: 'REJECT',
              riskScore: 99,
              riskLevel: 'CRITICAL_SPAM',
              category: 'PHISHING_SCAM',
              confidence: 0.99,
              rationale: 'Scam pattern detected.',
              engine: 'LLM_AI',
              latencyMs: 120,
              timestamp: new Date().toISOString(),
              suggestedActions: { disallowCall: true, silenceCall: false, rejectCall: true, skipCallLog: false, skipNotification: true }
            }
          ]
        })
    });
  }
  if (url.includes('/api/rules')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              id: 'rule-1',
              type: 'WHITELIST',
              pattern: '^(911|112)$',
              description: 'Emergency Services',
              action: 'ALLOW',
              enabled: true,
              createdAt: new Date().toISOString()
            }
          ]
        })
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: {} })
  });
});
