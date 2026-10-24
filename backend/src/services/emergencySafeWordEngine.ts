import { EmergencySafeWordConfig, IncomingCallPayload, ScreeningResult } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class EmergencySafeWordEngine {
  private static config: EmergencySafeWordConfig = {
    enabled: true,
    safeWords: ['falcon blue', 'code red', 'emergency override', 'family sos', 'distress bypass'],
    vipRingerBypass: true,
    notifyGuardians: true
  };

  /**
   * Returns active emergency configuration
   */
  public static getConfig(): EmergencySafeWordConfig {
    return { ...this.config, safeWords: [...this.config.safeWords] };
  }

  /**
   * Updates emergency configuration
   */
  public static updateConfig(newConfig: Partial<EmergencySafeWordConfig>): EmergencySafeWordConfig {
    this.config = {
      ...this.config,
      ...newConfig,
      safeWords: newConfig.safeWords ? [...newConfig.safeWords] : this.config.safeWords
    };
    return this.getConfig();
  }

  /**
   * Adds a new safe-word phrase
   */
  public static addSafeWord(phrase: string): boolean {
    const cleaned = phrase.trim().toLowerCase();
    if (!cleaned || cleaned.length < 3) return false;
    if (!this.config.safeWords.includes(cleaned)) {
      this.config.safeWords.push(cleaned);
      return true;
    }
    return false;
  }

  /**
   * Removes a safe-word phrase
   */
  public static removeSafeWord(phrase: string): boolean {
    const cleaned = phrase.trim().toLowerCase();
    const initialLen = this.config.safeWords.length;
    this.config.safeWords = this.config.safeWords.filter((w) => w !== cleaned);
    return this.config.safeWords.length < initialLen;
  }

  /**
   * Evaluates if caller utterance or intent contains the secret emergency safe-word
   */
  public static evaluate(payload: IncomingCallPayload, startTime: number): ScreeningResult | null {
    if (!this.config.enabled || this.config.safeWords.length === 0) {
      return null;
    }

    const textToScan = [
      payload.simulatedAudioTranscript || '',
      payload.callerIntent || '',
      payload.callerName || ''
    ]
      .join(' ')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');

    for (const safeWord of this.config.safeWords) {
      const normalizedWord = safeWord.toLowerCase().trim();
      if (!normalizedWord) continue;

      // Word boundary regex check for exact phrase
      const escaped = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');

      if (regex.test(textToScan)) {
        const latencyMs = Math.max(1, Date.now() - startTime);
        return {
          id: `scr-${uuidv4().slice(0, 8)}`,
          phoneNumber: payload.phoneNumber,
          callerName: payload.callerName || 'Emergency Family Contact',
          verdict: 'ALLOW',
          riskScore: 0,
          riskLevel: 'SAFE',
          category: 'EMERGENCY_OVERRIDE',
          confidence: 1.0,
          rationale: `🚨 Emergency Safe-Word "${safeWord}" detected! Zero-latency VIP ring-through authorized.`,
          engine: 'EMERGENCY_SAFEWORD',
          latencyMs,
          timestamp: new Date().toISOString(),
          suggestedActions: {
            disallowCall: false,
            silenceCall: false,
            rejectCall: false,
            skipCallLog: false,
            skipNotification: false
          },
          metadata: {
            emergencyOverrideTriggered: true,
            detectedKeywords: [safeWord]
          }
        };
      }
    }

    return null;
  }
}
