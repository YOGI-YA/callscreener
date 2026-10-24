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
  | 'EMERGENCY_OVERRIDE'
  | 'SYNTHETIC_BOT'
  | 'UNKNOWN';

export type ScreeningEngine =
  | 'LLM_AI'
  | 'FAST_LOCAL_FALLBACK'
  | 'WHITELIST_RULE'
  | 'BLACKLIST_RULE'
  | 'PROMPT_INJECTION_DEFENSE'
  | 'STIR_SHAKEN_VERIFIER'
  | 'EMERGENCY_SAFEWORD'
  | 'ACOUSTIC_BOT_DETECTOR'
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

export interface DeepfakeAcousticTelemetry {
  voiceCloneConfidence: number; // 0.0 to 1.0
  syntheticArtifactsDetected: boolean;
  spectralDissonanceScore: number; // 0 to 100
  deepfakeRiskRating: 'GENUINE_HUMAN' | 'UNCERTAIN' | 'SUSPECTED_SYNTHETIC' | 'CONFIRMED_DEEPFAKE_CLONE';
  detectedVoiceModelFamily?: string;
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
    stirShakenAttestation?: 'A' | 'B' | 'C' | 'FAILED' | 'NONE' | string;
    deepfakeMetrics?: DeepfakeAcousticTelemetry;
    emergencyOverrideTriggered?: boolean;
    acousticBotTelemetry?: AcousticBotTelemetry;
  };
}

export interface AcousticBotTelemetry {
  isRobocallBot: boolean;
  roboticCadenceScore: number; // 0 to 100
  spectralFlatnessScore: number; // 0 to 100
  soundboardConfidence: number; // 0.0 to 1.0
  audioFingerprintHash: string; // e.g. "SHA256:ROBO-VOX-..."
}

export interface EmergencySafeWordConfig {
  enabled: boolean;
  safeWords: string[];
  vipRingerBypass: boolean;
  notifyGuardians: boolean;
}

export interface WebhookAlertConfig {
  id: string;
  name: string;
  url: string;
  secretKey?: string;
  enabled: boolean;
  triggerOnCritical: boolean;
  triggerOnEmergency: boolean;
}

export interface FraudReportPayload {
  reportId: string;
  generatedAt: string;
  reportingAgency: 'FCC' | 'FTC' | 'IC3' | 'TRAI';
  incidentDetails: {
    callerNumber: string;
    callerName: string;
    timestamp: string;
    category: string;
    riskScore: number;
    spoofProbability: number;
    transcriptSummary: string;
    syntheticArtifacts: boolean;
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
