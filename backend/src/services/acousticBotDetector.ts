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
   * Computes Root Mean Square (RMS) dBFS energy from raw PCM 16-bit audio buffers.
   * Hardened against zero-length buffers, pure digital silence, and NaN values.
   */
  public static calculateRmsDbfs(pcmBuffer: Buffer | Int16Array | null | undefined): number {
    if (!pcmBuffer || pcmBuffer.length === 0) return -96; // Safe noise floor
    let sumSquares = 0;
    let sampleCount = 0;

    if (Buffer.isBuffer(pcmBuffer)) {
      sampleCount = Math.floor(pcmBuffer.length / 2);
      if (sampleCount === 0) return -96;
      for (let i = 0; i < sampleCount; i++) {
        const sample = pcmBuffer.readInt16LE(i * 2) / 32768.0;
        sumSquares += sample * sample;
      }
    } else {
      sampleCount = pcmBuffer.length;
      if (sampleCount === 0) return -96;
      for (let i = 0; i < sampleCount; i++) {
        const sample = pcmBuffer[i] / 32768.0;
        sumSquares += sample * sample;
      }
    }

    const meanSquare = sumSquares / sampleCount;
    if (!Number.isFinite(meanSquare) || meanSquare <= 1e-10) {
      return -96; // Safe acoustic silence floor
    }

    const rms = Math.sqrt(meanSquare);
    const dbfs = 20 * Math.log10(rms);
    return Number.isFinite(dbfs) ? Math.max(-96, Math.min(0, Math.round(dbfs * 10) / 10)) : -96;
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

    const jitterMs = Number.isFinite(options?.jitterMs) && options!.jitterMs! >= 0
      ? options!.jitterMs!
      : (patternMatches > 0 ? 3 : 24); // synthetic soundboards have near-0 jitter (<5ms)
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
