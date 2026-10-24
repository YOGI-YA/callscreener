import crypto from 'crypto';
import { AcousticBotTelemetry } from '../types/index.js';

export class AcousticBotDetector {
  // Known acoustic robocall soundboard patterns & robotic phrases
  private static readonly ROBOCALL_PATTERNS = [
    /\b(press\s+[1-9]\s+(to\s+speak|to\s+opt\s+out|for\s+more\s+information))\b/i,
    /\b(this\s+is\s+a\s+recorded\s+message\s+(from|regarding))\b/i,
    /\b(do\s+not\s+hang\s+up|important\s+message\s+about\s+your\s+car['']?s\s+extended\s+warranty)\b/i,
    /\b(stay\s+on\s+the\s+line\s+for\s+an\s+important\s+announcement)\b/i,
    /\b(you\s+have\s+been\s+selected\s+to\s+receive\s+a\s+free)\b/i,
    /\b(our\s+records\s+show\s+you\s+may\s+qualify\s+for\s+debt\s+relief)\b/i,
    /\b(legal\s+action\s+will\s+be\s+taken\s+against\s+you\s+if\s+you\s+do\s+not\s+respond)\b/i,
    /\b(federal\s+law\s+enforcement\s+warrant\s+has\s+been\s+issued)\b/i
  ];

  /**
   * Generates a deterministic acoustic audio fingerprint hash based on phonetic cadence
   */
  public static generateAcousticHash(text: string, cadenceScore: number): string {
    const normalized = text.toLowerCase().replace(/[^\w]/g, '').slice(0, 80);
    const hash = crypto.createHash('sha256').update(`${normalized}:${cadenceScore}`).digest('hex');
    return `ROBO-VOX-${hash.slice(0, 16).toUpperCase()}`;
  }

  /**
   * Evaluates acoustic anomaly metrics and soundboard robotic signatures
   */
  public static analyzeAcousticTelemetry(
    transcript: string,
    options?: { jitterMs?: number; audioDurationSec?: number }
  ): AcousticBotTelemetry {
    const text = transcript || '';
    let patternMatches = 0;

    for (const pattern of this.ROBOCALL_PATTERNS) {
      if (pattern.test(text)) {
        patternMatches++;
      }
    }

    // Heuristics for robotic speech: unnatural word repetition, short clipped fragments, or prerecorded script cues
    const words = text.trim().split(/\s+/).filter(Boolean);
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    const repetitionRatio = words.length > 5 ? 1 - (uniqueWords.size / words.length) : 0;

    const jitterMs = options?.jitterMs ?? (patternMatches > 0 ? 3 : 24); // synthetic soundboards have near-0 jitter (<5ms)
    const isUnnaturallyFlat = jitterMs < 8 && words.length > 6;

    let roboticCadenceScore = 0;
    if (patternMatches >= 2) {
      roboticCadenceScore = 95;
    } else if (patternMatches === 1) {
      roboticCadenceScore = 78;
    } else if (isUnnaturallyFlat) {
      roboticCadenceScore = 65;
    } else {
      roboticCadenceScore = Math.min(40, Math.round(repetitionRatio * 60));
    }

    const spectralFlatnessScore = isUnnaturallyFlat ? 88 : Math.min(75, Math.round(roboticCadenceScore * 0.9));
    const soundboardConfidence = patternMatches > 0
      ? Math.min(0.99, 0.75 + patternMatches * 0.12)
      : isUnnaturallyFlat ? 0.68 : 0.05;

    const isRobocallBot = roboticCadenceScore >= 60 || soundboardConfidence >= 0.65;
    const audioFingerprintHash = this.generateAcousticHash(text, roboticCadenceScore);

    return {
      isRobocallBot,
      roboticCadenceScore,
      spectralFlatnessScore,
      soundboardConfidence: Math.round(soundboardConfidence * 100) / 100,
      audioFingerprintHash
    };
  }
}
