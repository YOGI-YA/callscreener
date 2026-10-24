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
  | 'CARRIER_SPOOFED'
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
  isOutgoing?: boolean;
  initialPhase?: 'RINGING' | 'SCREENING' | 'CONNECTED';
  stirShakenStatus?: 'VERIFIED_A' | 'PARTIAL_B' | 'GATEWAY_C' | 'FAILED_SPOOF' | 'NOT_VERIFIED';
  isCarrierVerified?: boolean;
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
  riskScore: number;
  riskLevel: RiskLevel;
  category: CallerCategory;
  confidence: number;
  rationale: string;
  engine: ScreeningEngine;
  latencyMs: number;
  timestamp: string;
  stirShakenStatus?: 'VERIFIED_A' | 'PARTIAL_B' | 'GATEWAY_C' | 'FAILED_SPOOF' | 'NOT_VERIFIED';
  isCarrierVerified?: boolean;
  callerIntentSummary?: string;
  dialogueTurns?: DialogueTurn[];
  suggestedSmartReplies?: string[];
  suggestedActions: CallResponseActions;
  metadata?: {
    spoofProbability?: number;
    ruleMatched?: string;
    detectedKeywords?: string[];
    llmModelUsed?: string;
    stirShakenAttestation?: string;
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
  audioFingerprintHash: string;
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
  spamBlockRate: number;
}

export interface AudioWaveformState {
  isListening: boolean;
  decibels: number;
  activeSpeaker: 'CALLER' | 'AI_ASSISTANT' | 'SILENT_MONITORING' | 'IDLE';
  uplinkIsolationActive: boolean;
  frequencyPeaks: number[];
}

export interface VoicemailAudioMetadata {
  recordingId: string;
  durationSeconds: number;
  playbackSpeed: number;
  isMuted: boolean;
  audioUrl?: string;
  waveformPeaks?: number[];
}

export interface ThreatMatrixData {
  totalThreatsAnalyzed: number;
  mitigationRatePercent: number;
  carrierSpoofAttempts: number;
  attestationBreakdown: {
    verifiedA: number;
    partialB: number;
    gatewayC: number;
    spoofedFailed: number;
  };
  threatVectorDistribution: {
    phishing: number;
    robocall: number;
    impersonation: number;
    telemarketing: number;
    promptInjection: number;
    legitimate: number;
  };
  hourlyAttackDistribution: number[];
}

export interface SimulationScenario {
  id: string;
  title: string;
  callerName: string;
  phoneNumber: string;
  category: CallerCategory;
  expectedRiskScore: number;
  stirShakenStatus: 'VERIFIED_A' | 'PARTIAL_B' | 'GATEWAY_C' | 'FAILED_SPOOF' | 'NOT_VERIFIED';
  initialUtterance: string;
  simulatedAudioTranscript: string;
  description: string;
  tags: string[];
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

export interface RecordedCallItem {
  id: string;
  fileName: string;
  phoneNumber: string;
  filePath: string;
  timestamp: number;
  durationSeconds: number;
  fileSizeBytes: number;
}
