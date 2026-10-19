export type ScreeningVerdict = 'ALLOW' | 'SILENCE' | 'REJECT';

export type RiskLevel = 'SAFE' | 'LOW' | 'SUSPICIOUS' | 'CRITICAL_SPAM';

export type CallerCategory =
  | 'ROBOCALL'
  | 'PHISHING_SCAM'
  | 'CARRIER_SPOOFED'
  | 'TELEMARKETING'
  | 'DEBT_COLLECTOR'
  | 'DELIVERY_SERVICE'
  | 'MEDICAL_APPOINTMENT'
  | 'VERIFIED_CONTACT'
  | 'UNKNOWN';

export type ScreeningEngine =
  | 'LLM_AI'
  | 'FAST_LOCAL_FALLBACK'
  | 'WHITELIST_RULE'
  | 'BLACKLIST_RULE'
  | 'PROMPT_INJECTION_DEFENSE'
  | 'STIR_SHAKEN_VERIFIER'
  | 'SIMULATION';

export interface CallResponseActions {
  disallowCall: boolean;
  silenceCall: boolean;
  rejectCall: boolean;
  skipCallLog: boolean;
  skipNotification: boolean;
}

export interface IncomingCallPayload {
  phoneNumber: string;
  callerName?: string;
  location?: string;
  carrier?: string;
  timestamp?: string;
  simulatedAudioTranscript?: string;
  callerIntent?: string;
  contactExistsInAddressBook?: boolean;
  callPresentationMode?: 'ALLOWED' | 'RESTRICTED' | 'UNKNOWN' | 'PAYPHONE';
}

export interface ScreeningResult {
  id: string;
  phoneNumber: string;
  callerName: string;
  verdict: ScreeningVerdict;
  riskScore: number; // 0 (100% safe) to 100 (100% dangerous/spam)
  riskLevel: RiskLevel;
  category: CallerCategory;
  confidence: number; // 0.0 to 1.0
  rationale: string;
  engine: ScreeningEngine;
  latencyMs: number;
  timestamp: string;
  suggestedActions: CallResponseActions;
  metadata?: {
    spoofProbability?: number;
    ruleMatched?: string;
    detectedKeywords?: string[];
    llmModelUsed?: string;
  };
}

export interface ScreeningRule {
  id: string;
  type: 'WHITELIST' | 'BLACKLIST' | 'PREFIX_BLOCK' | 'KEYWORD_BLOCK';
  pattern: string;
  description: string;
  action: ScreeningVerdict;
  enabled: boolean;
  createdAt: string;
}

export interface CallScreeningStats {
  totalCallsScreened: number;
  totalSpamBlocked: number;
  totalCallsSilenced: number;
  totalCallsAllowed: number;
  averageRiskScore: number;
  averageLatencyMs: number;
  spamBlockRate: number; // Percentage 0-100
}
