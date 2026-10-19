import { ScreeningResult, CallScreeningStats } from '../types/index.js';
import { EmailService } from './emailService.js';
import { maskSensitiveText } from './sensitiveDataMasker.js';

export class CallLogStorage {
  private static logs: ScreeningResult[] = [];

  public static initializeSeedData() {
    if (this.logs.length === 0) {
      const now = Date.now();
      this.logs = [
        {
          id: 'scr-seed-001',
          phoneNumber: '+1 (800) 555-0199',
          callerName: 'IRS Enforcement Dept',
          verdict: 'REJECT',
          riskScore: 98,
          riskLevel: 'CRITICAL_SPAM',
          category: 'PHISHING_SCAM',
          confidence: 0.99,
          rationale: 'Caller claimed urgent arrest warrant due to unpaid taxes. High risk government impersonator.',
          engine: 'LLM_AI',
          latencyMs: 145,
          timestamp: new Date(now - 1000 * 60 * 25).toISOString(), // 25 mins ago
          suggestedActions: {
            disallowCall: true,
            silenceCall: false,
            rejectCall: true,
            skipCallLog: false,
            skipNotification: true
          },
          metadata: {
            spoofProbability: 0.96,
            detectedKeywords: ['irs warrant', 'arrest warrant']
          }
        },
        {
          id: 'scr-seed-002',
          phoneNumber: '+1 (415) 555-2671',
          callerName: 'Dr. Evelyn Reed (Cardiology)',
          verdict: 'ALLOW',
          riskScore: 3,
          riskLevel: 'SAFE',
          category: 'MEDICAL_APPOINTMENT',
          confidence: 0.98,
          rationale: 'Confirmed medical clinic calling regarding upcoming health checkup schedule.',
          engine: 'LLM_AI',
          latencyMs: 120,
          timestamp: new Date(now - 1000 * 60 * 120).toISOString(), // 2 hours ago
          suggestedActions: {
            disallowCall: false,
            silenceCall: false,
            rejectCall: false,
            skipCallLog: false,
            skipNotification: false
          }
        },
        {
          id: 'scr-seed-003',
          phoneNumber: '+1 (888) 723-9011',
          callerName: 'Vehicle Protection Services',
          verdict: 'REJECT',
          riskScore: 88,
          riskLevel: 'CRITICAL_SPAM',
          category: 'ROBOCALL',
          confidence: 0.94,
          rationale: 'Automated robocall pitch for extended vehicle warranty renewal.',
          engine: 'LLM_AI',
          latencyMs: 98,
          timestamp: new Date(now - 1000 * 60 * 360).toISOString(), // 6 hours ago
          suggestedActions: {
            disallowCall: true,
            silenceCall: false,
            rejectCall: true,
            skipCallLog: false,
            skipNotification: true
          }
        },
        {
          id: 'scr-seed-004',
          phoneNumber: '+1 (650) 555-8392',
          callerName: 'Apex Couriers / Amazon Driver',
          verdict: 'ALLOW',
          riskScore: 8,
          riskLevel: 'SAFE',
          category: 'DELIVERY_SERVICE',
          confidence: 0.95,
          rationale: 'Delivery courier attempting gate access for scheduled package drop-off.',
          engine: 'LLM_AI',
          latencyMs: 110,
          timestamp: new Date(now - 1000 * 60 * 720).toISOString(), // 12 hours ago
          suggestedActions: {
            disallowCall: false,
            silenceCall: false,
            rejectCall: false,
            skipCallLog: false,
            skipNotification: false
          }
        },
        {
          id: 'scr-seed-005',
          phoneNumber: '+1 (900) 456-7890',
          callerName: 'Toll Premium Line',
          verdict: 'REJECT',
          riskScore: 99,
          riskLevel: 'CRITICAL_SPAM',
          category: 'ROBOCALL',
          confidence: 1.0,
          rationale: 'Matched local screening rule: Premium Rate / Toll Scam Prefixes',
          engine: 'BLACKLIST_RULE',
          latencyMs: 2,
          timestamp: new Date(now - 1000 * 60 * 1440).toISOString(), // 1 day ago
          suggestedActions: {
            disallowCall: true,
            silenceCall: false,
            rejectCall: true,
            skipCallLog: false,
            skipNotification: true
          }
        }
      ];
    }
  }

  public static addLog(result: ScreeningResult): void {
    const sanitizedResult: ScreeningResult = {
      ...result,
      callerName: result.callerName ? maskSensitiveText(result.callerName) : result.callerName,
      rationale: maskSensitiveText(result.rationale),
    };

    // Insert at beginning
    this.logs.unshift(sanitizedResult);
    // Keep max 200 logs
    if (this.logs.length > 200) {
      this.logs.pop();
    }

    // Automated recording / call email forwarding dispatch
    try {
      const emailSettings = EmailService.getSettings();
      if (emailSettings.enabled && emailSettings.toEmail && emailSettings.autoForwardOnDisconnect) {
        EmailService.sendRecordingEmail({
          to: emailSettings.toEmail,
          phoneNumber: result.phoneNumber,
          callerName: result.callerName,
          timestamp: result.timestamp,
          verdict: result.verdict,
          riskScore: result.riskScore,
          category: result.category,
          rationale: result.rationale,
          transcript: (result.metadata as any)?.transcript || (result.metadata as any)?.detectedKeywords?.join(', ')
        }).catch((err: any) => {
          console.warn('Auto-forward email error:', err?.message);
        });
      }
    } catch (e: any) {
      console.warn('Could not trigger email auto-forward:', e.message);
    }
  }

  public static getLogs(query?: { search?: string; verdict?: string; category?: string; limit?: number }): ScreeningResult[] {
    this.initializeSeedData();
    let result = [...this.logs];

    if (query?.verdict && query.verdict !== 'ALL') {
      result = result.filter((l) => l.verdict === query.verdict);
    }

    if (query?.category && query.category !== 'ALL') {
      result = result.filter((l) => l.category === query.category);
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.toLowerCase();
      result = result.filter(
        (l) =>
          l.phoneNumber.toLowerCase().includes(s) ||
          l.callerName.toLowerCase().includes(s) ||
          l.rationale.toLowerCase().includes(s)
      );
    }

    if (query?.limit && query.limit > 0) {
      result = result.slice(0, query.limit);
    }

    return result;
  }

  public static getLogById(id: string): ScreeningResult | undefined {
    return this.logs.find((l) => l.id === id);
  }

  public static deleteLog(id: string): boolean {
    const initialLen = this.logs.length;
    this.logs = this.logs.filter((l) => l.id !== id);
    return this.logs.length !== initialLen;
  }

  public static clearAll(): void {
    this.logs = [];
  }

  public static getStats(): CallScreeningStats {
    this.initializeSeedData();
    const total = this.logs.length;
    if (total === 0) {
      return {
        totalCallsScreened: 0,
        totalSpamBlocked: 0,
        totalCallsSilenced: 0,
        totalCallsAllowed: 0,
        averageRiskScore: 0,
        averageLatencyMs: 0,
        spamBlockRate: 0
      };
    }

    const spamBlocked = this.logs.filter((l) => l.verdict === 'REJECT').length;
    const silenced = this.logs.filter((l) => l.verdict === 'SILENCE').length;
    const allowed = this.logs.filter((l) => l.verdict === 'ALLOW').length;
    const totalRisk = this.logs.reduce((acc, curr) => acc + curr.riskScore, 0);
    const totalLatency = this.logs.reduce((acc, curr) => acc + curr.latencyMs, 0);

    return {
      totalCallsScreened: total,
      totalSpamBlocked: spamBlocked,
      totalCallsSilenced: silenced,
      totalCallsAllowed: allowed,
      averageRiskScore: Math.round(totalRisk / total),
      averageLatencyMs: Math.round(totalLatency / total),
      spamBlockRate: Math.round((spamBlocked / total) * 100)
    };
  }
}
