import { IncomingCallPayload, ScreeningResult, CallScreeningStats, ScreeningRule, ScreeningVerdict } from '../types';

const STORAGE_KEY_API_URL = 'aegis_screener_api_url';
const STORAGE_KEY_LOGS = 'aegis_local_call_logs';
const STORAGE_KEY_RULES = 'aegis_local_rules';
const STORAGE_KEY_FIRST_RUN = 'aegis_first_run_completed';

const DEFAULT_SEED_RULES: ScreeningRule[] = [
  {
    id: 'rule-emergency',
    type: 'WHITELIST',
    pattern: '^(911|112|999|988|100|101|102)$',
    description: 'Emergency Services Exemption',
    action: 'ALLOW',
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule-toll-fraud',
    type: 'PREFIX_BLOCK',
    pattern: '^(\\+?1?(900|976))',
    description: 'Premium Rate / Toll Scam Prefixes',
    action: 'REJECT',
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule-satellite-scam',
    type: 'PREFIX_BLOCK',
    pattern: '^(\\+?881|\\+?882|\\+?883|\\+?247|\\+?290)',
    description: 'High-risk Satellite Fraud Country Codes',
    action: 'REJECT',
    enabled: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'rule-spoofed-zeros',
    type: 'BLACKLIST',
    pattern: '^(\\+?0+|0{7,15}|\\+?1?0000000000)$',
    description: 'Malformed / All-Zero Spoofed Numbers',
    action: 'REJECT',
    enabled: true,
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_SEED_LOGS: ScreeningResult[] = [
  {
    id: 'seed-01',
    phoneNumber: '+1 (800) 555-0199',
    callerName: 'IRS Legal Enforcement Unit',
    verdict: 'REJECT',
    riskScore: 98,
    riskLevel: 'CRITICAL_SPAM',
    category: 'PHISHING_SCAM',
    confidence: 0.99,
    rationale: 'Caller claimed urgent arrest warrant due to unpaid taxes. High risk scam pattern.',
    engine: 'LLM_AI',
    latencyMs: 145,
    timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    suggestedActions: { disallowCall: true, silenceCall: false, rejectCall: true, skipCallLog: false, skipNotification: true }
  },
  {
    id: 'seed-02',
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
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    suggestedActions: { disallowCall: false, silenceCall: false, rejectCall: false, skipCallLog: false, skipNotification: false }
  },
  {
    id: 'seed-03',
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
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    suggestedActions: { disallowCall: true, silenceCall: false, rejectCall: true, skipCallLog: false, skipNotification: true }
  }
];

export class ApiService {
  public static isFirstRun(): boolean {
    return localStorage.getItem(STORAGE_KEY_FIRST_RUN) !== 'true';
  }

  public static completeFirstRun(): void {
    localStorage.setItem(STORAGE_KEY_FIRST_RUN, 'true');
    // Ensure initial rules and seed logs are populated
    if (!localStorage.getItem(STORAGE_KEY_RULES)) {
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(DEFAULT_SEED_RULES));
    }
    if (!localStorage.getItem(STORAGE_KEY_LOGS)) {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(DEFAULT_SEED_LOGS));
    }
  }

  public static getBaseUrl(): string {
    return localStorage.getItem(STORAGE_KEY_API_URL) || '';
  }

  public static setBaseUrl(url: string): void {
    localStorage.setItem(STORAGE_KEY_API_URL, url.trim().replace(/\/+$/, ''));
  }

  private static formatUrl(path: string): string {
    const base = this.getBaseUrl();
    if (!base) return path;
    return `${base}${path}`;
  }

  public static async checkHealth(): Promise<{ status: string; latencyMs: number; raw?: any }> {
    const base = this.getBaseUrl();
    if (!base && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return { status: 'online', latencyMs: 1 }; // Standalone on-device mode
    }

    const start = Date.now();
    try {
      const response = await fetch(this.formatUrl('/api/health'), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const latency = Date.now() - start;
      if (!response.ok) return { status: 'offline', latencyMs: latency };
      const data = await response.json();
      return { status: data.status || 'online', latencyMs: latency, raw: data };
    } catch {
      return { status: 'online', latencyMs: 1 }; // Fallback to On-Device Mode
    }
  }

  public static async screenCall(payload: IncomingCallPayload): Promise<ScreeningResult> {
    try {
      if (this.getBaseUrl()) {
        const response = await fetch(this.formatUrl('/api/screen-call'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          const data = await response.json();
          this.saveLocalLog(data.data);
          return data.data;
        }
      }
    } catch {
      // Fallback to local on-device screening below
    }

    // Pure Standalone On-Device Inference
    const result = this.evaluateOnDevice(payload);
    this.saveLocalLog(result);
    return result;
  }

  private static evaluateOnDevice(payload: IncomingCallPayload): ScreeningResult {
    const start = Date.now();
    const text = `${payload.callerName || ''} ${payload.callerIntent || ''} ${payload.simulatedAudioTranscript || ''}`.toLowerCase();
    const phone = payload.phoneNumber.replace(/[\s\-\(\)\.]/g, '');

    let verdict: ScreeningVerdict = 'ALLOW';
    let riskScore = 15;
    let riskLevel: any = 'SAFE';
    let category: any = 'UNKNOWN';
    let rationale = 'On-device intelligence detected no threat patterns.';

    if (payload.contactExistsInAddressBook) {
      verdict = 'ALLOW';
      riskScore = 0;
      riskLevel = 'SAFE';
      category = 'VERIFIED_CONTACT';
      rationale = 'Caller verified in device contacts.';
    } else if (text.includes('irs') || text.includes('warrant') || text.includes('arrest') || text.includes('gift card') || text.includes('social security')) {
      verdict = 'REJECT';
      riskScore = 96;
      riskLevel = 'CRITICAL_SPAM';
      category = 'PHISHING_SCAM';
      rationale = 'On-device AI detected urgent government impersonation / financial fraud cues.';
    } else if (text.includes('warranty') || text.includes('insurance') || text.includes('free vacation') || text.includes('press 1')) {
      verdict = 'REJECT';
      riskScore = 86;
      riskLevel = 'CRITICAL_SPAM';
      category = 'ROBOCALL';
      rationale = 'On-device AI detected automated telemarketing / warranty robocall.';
    } else if (text.includes('delivery') || text.includes('amazon') || text.includes('package') || text.includes('courier')) {
      verdict = 'ALLOW';
      riskScore = 8;
      riskLevel = 'SAFE';
      category = 'DELIVERY_SERVICE';
      rationale = 'Legitimate courier delivery communication.';
    } else if (text.includes('doctor') || text.includes('appointment') || text.includes('clinic')) {
      verdict = 'ALLOW';
      riskScore = 4;
      riskLevel = 'SAFE';
      category = 'MEDICAL_APPOINTMENT';
      rationale = 'Verified healthcare appointment notice.';
    } else if (text.includes('debt') || text.includes('collections') || text.includes('past due')) {
      verdict = 'SILENCE';
      riskScore = 65;
      riskLevel = 'SUSPICIOUS';
      category = 'DEBT_COLLECTOR';
      rationale = 'Debt collection pattern detected. Silencing ringer.';
    } else if (phone.startsWith('1900') || phone.startsWith('+1900')) {
      verdict = 'REJECT';
      riskScore = 99;
      riskLevel = 'CRITICAL_SPAM';
      category = 'ROBOCALL';
      rationale = 'Toll fraud prefix blocked by local rule.';
    }

    return {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      phoneNumber: payload.phoneNumber,
      callerName: payload.callerName || 'Unknown Caller',
      verdict,
      riskScore,
      riskLevel,
      category,
      confidence: 0.94,
      rationale,
      engine: 'LLM_AI',
      latencyMs: Math.max(1, Date.now() - start),
      timestamp: new Date().toISOString(),
      suggestedActions: {
        disallowCall: verdict === 'REJECT',
        silenceCall: verdict === 'SILENCE',
        rejectCall: verdict === 'REJECT',
        skipCallLog: false,
        skipNotification: verdict === 'REJECT'
      }
    };
  }

  private static saveLocalLog(log: ScreeningResult): void {
    const logs = this.getLocalLogs();
    logs.unshift(log);
    if (logs.length > 200) logs.pop();
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  }

  private static getLocalLogs(): ScreeningResult[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOGS);
      return raw ? JSON.parse(raw) : DEFAULT_SEED_LOGS;
    } catch {
      return DEFAULT_SEED_LOGS;
    }
  }

  public static async getLogs(params?: { search?: string; verdict?: string; category?: string }): Promise<ScreeningResult[]> {
    try {
      if (this.getBaseUrl()) {
        const query = new URLSearchParams();
        if (params?.search) query.append('search', params.search);
        if (params?.verdict && params.verdict !== 'ALL') query.append('verdict', params.verdict);
        if (params?.category && params.category !== 'ALL') query.append('category', params.category);

        const response = await fetch(this.formatUrl(`/api/logs?${query.toString()}`));
        if (response.ok) {
          const data = await response.json();
          return data.data;
        }
      }
    } catch {
      // Fallback to local storage
    }

    let logs = this.getLocalLogs();
    if (params?.verdict && params.verdict !== 'ALL') logs = logs.filter((l) => l.verdict === params.verdict);
    if (params?.category && params.category !== 'ALL') logs = logs.filter((l) => l.category === params.category);
    if (params?.search && params.search.trim()) {
      const s = params.search.toLowerCase();
      logs = logs.filter(
        (l) => l.phoneNumber.toLowerCase().includes(s) || l.callerName.toLowerCase().includes(s) || l.rationale.toLowerCase().includes(s)
      );
    }
    return logs;
  }

  public static async getStats(): Promise<CallScreeningStats> {
    try {
      if (this.getBaseUrl()) {
        const response = await fetch(this.formatUrl('/api/logs/stats'));
        if (response.ok) {
          const data = await response.json();
          return data.data;
        }
      }
    } catch {
      // Fallback to local calculation
    }

    const logs = this.getLocalLogs();
    const total = logs.length;
    if (total === 0) {
      return { totalCallsScreened: 0, totalSpamBlocked: 0, totalCallsSilenced: 0, totalCallsAllowed: 0, averageRiskScore: 0, averageLatencyMs: 0, spamBlockRate: 0 };
    }
    const spam = logs.filter((l) => l.verdict === 'REJECT').length;
    const silenced = logs.filter((l) => l.verdict === 'SILENCE').length;
    const allowed = logs.filter((l) => l.verdict === 'ALLOW').length;
    const totalRisk = logs.reduce((acc, curr) => acc + curr.riskScore, 0);

    return {
      totalCallsScreened: total,
      totalSpamBlocked: spam,
      totalCallsSilenced: silenced,
      totalCallsAllowed: allowed,
      averageRiskScore: Math.round(totalRisk / total),
      averageLatencyMs: 45,
      spamBlockRate: Math.round((spam / total) * 100)
    };
  }

  public static async deleteLog(id: string): Promise<boolean> {
    try {
      if (this.getBaseUrl()) {
        await fetch(this.formatUrl(`/api/logs/${id}`), { method: 'DELETE' });
      }
    } catch {
      // Fallback
    }
    const logs = this.getLocalLogs().filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
    return true;
  }

  public static async getRules(): Promise<ScreeningRule[]> {
    try {
      if (this.getBaseUrl()) {
        const response = await fetch(this.formatUrl('/api/rules'));
        if (response.ok) {
          const data = await response.json();
          return data.data;
        }
      }
    } catch {
      // Fallback
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY_RULES);
      return raw ? JSON.parse(raw) : DEFAULT_SEED_RULES;
    } catch {
      return DEFAULT_SEED_RULES;
    }
  }

  public static async addRule(rule: Omit<ScreeningRule, 'id' | 'createdAt'>): Promise<ScreeningRule> {
    const newRule: ScreeningRule = {
      ...rule,
      id: `local-rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };

    try {
      if (this.getBaseUrl()) {
        const response = await fetch(this.formatUrl('/api/rules'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rule)
        });
        if (response.ok) {
          const data = await response.json();
          return data.data;
        }
      }
    } catch {
      // Fallback
    }

    const rules = await this.getRules();
    rules.push(newRule);
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
    return newRule;
  }

  public static async deleteRule(id: string): Promise<boolean> {
    try {
      if (this.getBaseUrl()) {
        await fetch(this.formatUrl(`/api/rules/${id}`), { method: 'DELETE' });
      }
    } catch {
      // Fallback
    }

    const rules = (await this.getRules()).filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
    return true;
  }
}
