import { IncomingCallPayload, ScreeningResult, ScreeningRule } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class FastRulesEngine {
  private static defaultRules: ScreeningRule[] = [
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
      description: 'High-risk One-Ring Satellite Fraud Country Codes',
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

  private static highRiskKeywords = [
    { phrase: 'irs warrant', score: 98, category: 'PHISHING_SCAM' as const, reason: 'Detected IRS arrest warrant impersonation scam' },
    { phrase: 'social security suspended', score: 97, category: 'PHISHING_SCAM' as const, reason: 'Detected Social Security suspension scam' },
    { phrase: 'gift card', score: 92, category: 'PHISHING_SCAM' as const, reason: 'Detected payment via gift cards demand (high fraud signature)' },
    { phrase: 'cryptocurrency wallet', score: 90, category: 'PHISHING_SCAM' as const, reason: 'Detected unsolicited crypto transfer solicitation' },
    { phrase: 'verify your one time password', score: 95, category: 'PHISHING_SCAM' as const, reason: 'Detected 2FA / OTP token harvesting attempt' },
    { phrase: 'bank fraud department transfer', score: 90, category: 'PHISHING_SCAM' as const, reason: 'Detected fake bank account security transfer demand' },
    { phrase: 'chinese embassy package', score: 94, category: 'PHISHING_SCAM' as const, reason: 'Detected international courier/embassy extortion robocall' },
    { phrase: 'car warranty expired', score: 85, category: 'ROBOCALL' as const, reason: 'Detected auto warranty robocall pattern' },
    { phrase: 'free vacation cruise winner', score: 88, category: 'TELEMARKETING' as const, reason: 'Detected deceptive prize/vacation lead generator' },
    { phrase: 'lower your credit card interest', score: 82, category: 'TELEMARKETING' as const, reason: 'Detected unsolicited debt reduction telemarketing' },
    // Hindi & Hinglish Fraud Signatures
    { phrase: 'bijli bill', score: 96, category: 'PHISHING_SCAM' as const, reason: 'Detected Hindi/Hinglish electricity bill disconnection phishing scam (बिजली बिल फ्रॉड)' },
    { phrase: 'power cut', score: 92, category: 'PHISHING_SCAM' as const, reason: 'Detected urgent electricity utility cut phishing scam' },
    { phrase: 'otp share', score: 98, category: 'PHISHING_SCAM' as const, reason: 'Detected Hindi/Hinglish bank OTP harvesting fraud' },
    { phrase: 'otp batayein', score: 98, category: 'PHISHING_SCAM' as const, reason: 'Detected Hindi OTP extraction attempt' },
    { phrase: 'kyc update', score: 95, category: 'PHISHING_SCAM' as const, reason: 'Detected fake banking/SIM KYC expiry extortion scam' },
    { phrase: 'account block ho jayega', score: 96, category: 'PHISHING_SCAM' as const, reason: 'Detected bank account freeze intimidation scam' },
    { phrase: 'debit card block', score: 94, category: 'PHISHING_SCAM' as const, reason: 'Detected card suspension phishing scam' },
    { phrase: 'lottery lag gayi', score: 95, category: 'PHISHING_SCAM' as const, reason: 'Detected lottery/prize money advance fee fraud' },
    { phrase: 'kbc prize', score: 95, category: 'PHISHING_SCAM' as const, reason: 'Detected fake KBC / Kaun Banega Crorepati lottery scam' },
    { phrase: 'sim card block', score: 93, category: 'PHISHING_SCAM' as const, reason: 'Detected fake telecom SIM card deactivation scam' },
    { phrase: 'बिजली बिल', score: 96, category: 'PHISHING_SCAM' as const, reason: 'Detected Devanagari Hindi electricity disconnection scam' },
    { phrase: 'ओटीपी', score: 98, category: 'PHISHING_SCAM' as const, reason: 'Detected Devanagari Hindi OTP harvesting attempt' },
    { phrase: 'लॉटरी', score: 95, category: 'PHISHING_SCAM' as const, reason: 'Detected Devanagari Hindi lottery scam' },
    // Digital Arrest & Law Enforcement Impersonation Vectors
    { phrase: 'digital arrest', score: 99, category: 'PHISHING_SCAM' as const, reason: 'Detected high-threat Digital Arrest extortion scam impersonating police/CBI' },
    { phrase: 'cbi arrest warrant', score: 99, category: 'PHISHING_SCAM' as const, reason: 'Detected fake CBI arrest warrant extortion scam' },
    { phrase: 'customs parcel narcotics', score: 98, category: 'PHISHING_SCAM' as const, reason: 'Detected fake customs drug/contraband interception parcel scam' },
    { phrase: 'cyber crime police department', score: 98, category: 'PHISHING_SCAM' as const, reason: 'Detected law enforcement cyber crime impersonation scam' },
    { phrase: 'trai sim disconnect illegal', score: 97, category: 'PHISHING_SCAM' as const, reason: 'Detected fake TRAI illegal messaging SIM deactivation threat' },
    { phrase: 'डिजिटल अरेस्ट', score: 99, category: 'PHISHING_SCAM' as const, reason: 'Detected Devanagari Hindi Digital Arrest extortion scam' }
  ];

  private static customRules: ScreeningRule[] = [];

  public static getRules(): ScreeningRule[] {
    return [...this.defaultRules, ...this.customRules];
  }

  /**
   * Validates pattern against catastrophic ReDoS patterns, nested quantifiers, and length bounds
   */
  public static validateRulePattern(pattern: string): { valid: boolean; error?: string } {
    if (!pattern || typeof pattern !== 'string') {
      return { valid: false, error: 'Pattern must be a non-empty string' };
    }

    if (pattern.length > 120) {
      return { valid: false, error: 'Pattern exceeds maximum length of 120 characters' };
    }

    // ReDoS heuristic check: nested repetitions such as (a+)+ or (x*)* or (.*)+
    const dangerousBacktracking = /(\([^()]*[+*][^()]*\)[+*{]|\b[+*]{2,})/i;
    if (dangerousBacktracking.test(pattern)) {
      return { valid: false, error: 'Potentially vulnerable ReDoS pattern (nested quantifiers detected)' };
    }

    try {
      new RegExp(pattern);
      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: `Invalid Regular Expression: ${e.message}` };
    }
  }

  public static addRule(rule: Omit<ScreeningRule, 'id' | 'createdAt'>): ScreeningRule {
    const check = this.validateRulePattern(rule.pattern);
    if (!check.valid) {
      throw new Error(`INVALID_RULE_PATTERN: ${check.error}`);
    }

    const newRule: ScreeningRule = {
      ...rule,
      id: `custom-rule-${uuidv4().substring(0, 8)}`,
      createdAt: new Date().toISOString()
    };
    this.customRules.push(newRule);
    return newRule;
  }

  public static removeRule(id: string): boolean {
    const initialLen = this.customRules.length;
    this.customRules = this.customRules.filter((r) => r.id !== id);
    return this.customRules.length !== initialLen;
  }

  /**
   * Fast deterministic check executed in <2ms
   */
  public static evaluate(payload: IncomingCallPayload, startTime: number): ScreeningResult | null {
    const cleanNumber = payload.phoneNumber.replace(/[\s\-\(\)\.]/g, '');

    // 1. Check if caller exists in local device address book
    if (payload.contactExistsInAddressBook) {
      return this.buildResult({
        payload,
        startTime,
        verdict: 'ALLOW',
        riskScore: 5,
        riskLevel: 'SAFE',
        category: 'VERIFIED_CONTACT',
        confidence: 0.99,
        rationale: 'Caller is verified in your personal address book.',
        engine: 'WHITELIST_RULE',
        ruleMatched: 'address-book-whitelist'
      });
    }

    // 2. Evaluate active custom and default rules (regex)
    const allRules = this.getRules().filter((r) => r.enabled);
    const rawNumber = payload.phoneNumber;
    for (const rule of allRules) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (
          regex.test(cleanNumber) ||
          regex.test(rawNumber) ||
          (payload.callerName && regex.test(payload.callerName))
        ) {
          const isAllowed = rule.action === 'ALLOW';
          const isSilenced = rule.action === 'SILENCE';

          return this.buildResult({
            payload,
            startTime,
            verdict: rule.action,
            riskScore: isAllowed ? 0 : isSilenced ? 55 : 95,
            riskLevel: isAllowed ? 'SAFE' : isSilenced ? 'SUSPICIOUS' : 'CRITICAL_SPAM',
            category: isAllowed ? 'VERIFIED_CONTACT' : 'ROBOCALL',
            confidence: 0.95,
            rationale: `Matched local screening rule: ${rule.description}`,
            engine: isAllowed ? 'WHITELIST_RULE' : 'BLACKLIST_RULE',
            ruleMatched: rule.id
          });
        }
      } catch {
        // Continue on invalid custom regex
      }
    }

    // 3. Keyword / Transcript heuristic check
    const textToCheck = `${payload.callerIntent || ''} ${payload.simulatedAudioTranscript || ''}`.toLowerCase();
    if (textToCheck.trim().length > 0) {
      for (const kw of this.highRiskKeywords) {
        if (textToCheck.includes(kw.phrase)) {
          return this.buildResult({
            payload,
            startTime,
            verdict: 'REJECT',
            riskScore: kw.score,
            riskLevel: 'CRITICAL_SPAM',
            category: kw.category,
            confidence: 0.92,
            rationale: kw.reason,
            engine: 'FAST_LOCAL_FALLBACK',
            detectedKeywords: [kw.phrase]
          });
        }
      }
    }

    // No deterministic rule match
    return null;
  }

  /**
   * Generates a safe fallback result when LLM fails or network times out
   */
  public static generateSafetyFallback(payload: IncomingCallPayload, startTime: number, reason: string): ScreeningResult {
    // Unknown numbers default to SILENCE or cautious ALLOW based on restricted presentation
    const isRestricted = payload.callPresentationMode === 'RESTRICTED' || payload.callPresentationMode === 'UNKNOWN';
    const verdict = isRestricted ? 'SILENCE' : 'ALLOW';
    const riskScore = isRestricted ? 60 : 30;

    return this.buildResult({
      payload,
      startTime,
      verdict,
      riskScore,
      riskLevel: isRestricted ? 'SUSPICIOUS' : 'LOW',
      category: 'UNKNOWN',
      confidence: 0.6,
      rationale: `Local Fast Fallback applied (${reason}). Default safe policy applied.`,
      engine: 'FAST_LOCAL_FALLBACK'
    });
  }

  private static buildResult(params: {
    payload: IncomingCallPayload;
    startTime: number;
    verdict: 'ALLOW' | 'SILENCE' | 'REJECT';
    riskScore: number;
    riskLevel: 'SAFE' | 'LOW' | 'SUSPICIOUS' | 'CRITICAL_SPAM';
    category: any;
    confidence: number;
    rationale: string;
    engine: 'LLM_AI' | 'FAST_LOCAL_FALLBACK' | 'WHITELIST_RULE' | 'BLACKLIST_RULE';
    ruleMatched?: string;
    detectedKeywords?: string[];
  }): ScreeningResult {
    const latencyMs = Math.max(1, Date.now() - params.startTime);
    const disallowCall = params.verdict === 'REJECT';
    const silenceCall = params.verdict === 'SILENCE';
    const rejectCall = params.verdict === 'REJECT';

    return {
      id: `scr-${uuidv4().substring(0, 12)}`,
      phoneNumber: params.payload.phoneNumber,
      callerName: params.payload.callerName || 'Unknown Caller',
      verdict: params.verdict,
      riskScore: Math.min(100, Math.max(0, params.riskScore)),
      riskLevel: params.riskLevel,
      category: params.category,
      confidence: params.confidence,
      rationale: params.rationale,
      engine: params.engine,
      latencyMs,
      timestamp: new Date().toISOString(),
      suggestedActions: {
        disallowCall,
        silenceCall,
        rejectCall,
        skipCallLog: false,
        skipNotification: params.verdict === 'REJECT'
      },
      metadata: {
        ruleMatched: params.ruleMatched,
        detectedKeywords: params.detectedKeywords
      }
    };
  }
}
