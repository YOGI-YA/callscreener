export type ScreeningVerdict = 'ALLOW' | 'SILENCE' | 'REJECT';

export type RiskLevel = 'SAFE' | 'LOW' | 'SUSPICIOUS' | 'CRITICAL_SPAM';

export type CallerCategory =
  | 'ROBOCALL'
  | 'PHISHING_SCAM'
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
  | 'SIMULATION';

export interface DialogueTurn {
  sender: 'AI_ASSISTANT' | 'CALLER';
  text: string;
  timestamp: string;
}

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
  dialogueHistory?: DialogueTurn[];
}

export interface ScreeningResult {
  id: string;
  phoneNumber: string;
  callerName: string;
  verdict: ScreeningVerdict;
  riskScore: number;
  riskLevel: RiskLevel;
  category: CallerCategory;
  confidence: number;
  rationale: string;
  engine: ScreeningEngine;
  latencyMs: number;
  timestamp: string;
  callerIntentSummary?: string;
  dialogueTurns?: DialogueTurn[];
  suggestedSmartReplies?: string[];
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
  spamBlockRate: number;
}

export type LanguagePreference = 'AUTO' | 'EN' | 'HI' | 'HINGLISH';

export interface AppSettings {
  backendApiUrl: string;
  autoBlockHighRiskSpam: boolean;
  riskThreshold: number;
  silenceUnknownCallers: boolean;
  enableFastFallback: boolean;
  hapticFeedback: boolean;
  rolePermissionGranted: boolean;
  language: LanguagePreference;
  aiAssistantGreeting: string;
}
