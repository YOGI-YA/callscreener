/**
 * DynamicGainController.ts
 * Telephony Uplink Automatic Gain Control (AGC) & Soft-Knee Acoustic Peak Limiter.
 * Normalizes speech amplitude directed to the remote caller to prevent earpiece clipping
 * and ensure uniform clarity regardless of TTS synthesis variance.
 */

export interface AGCConfig {
  targetLevelDbfs?: number; // Target RMS level, default -16 dBFS (telecom standard)
  maxGainDb?: number;        // Maximum boost applied to quiet speech (default +12 dB)
  minGainDb?: number;        // Maximum attenuation applied to loud bursts (default -18 dB)
  attackTimeMs?: number;     // Fast attack to suppress sudden shrieks (default 10ms)
  releaseTimeMs?: number;    // Smooth release to prevent audio breathing/pumping (default 200ms)
  kneeWidthDb?: number;      // Soft-knee width for gradual compression curve
}

export class DynamicGainController {
  private currentGain = 1.0;
  private readonly targetLevelDbfs: number;
  private readonly maxGainLinear: number;
  private readonly minGainLinear: number;
  private readonly attackCoeff: number;
  private readonly releaseCoeff: number;
  private readonly thresholdDbfs = -1.5; // Brickwall ceiling before digital clip

  constructor(config: AGCConfig = {}, sampleRate: number = 8000) {
    this.targetLevelDbfs = config.targetLevelDbfs ?? -16;
    this.maxGainLinear = Math.pow(10, (config.maxGainDb ?? 12) / 20);
    this.minGainLinear = Math.pow(10, (config.minGainDb ?? -18) / 20);

    const attackMs = config.attackTimeMs ?? 10;
    const releaseMs = config.releaseTimeMs ?? 200;

    this.attackCoeff = Math.exp(-1 / ((attackMs / 1000) * sampleRate));
    this.releaseCoeff = Math.exp(-1 / ((releaseMs / 1000) * sampleRate));
  }

  /**
   * Processes a 16-bit PCM buffer, applies AGC and soft-knee peak limiting in-place
   */
  public processPcmBuffer(pcmBuffer: Buffer): {
    processedBuffer: Buffer;
    rmsDb: number;
    peakDb: number;
    appliedGainDb: number;
    samplesClipped: number;
  } {
    const samplesCount = pcmBuffer.length / 2;
    const outputBuffer = Buffer.alloc(pcmBuffer.length);

    let sumSquares = 0;
    let maxPeak = 0;
    let clippedCount = 0;

    // 1st pass: Calculate frame RMS
    for (let i = 0; i < samplesCount; i++) {
      const sample = pcmBuffer.readInt16LE(i * 2) / 32768.0;
      sumSquares += sample * sample;
      const absSample = Math.abs(sample);
      if (absSample > maxPeak) maxPeak = absSample;
    }

    const frameRms = Math.sqrt(sumSquares / Math.max(1, samplesCount));
    const currentRmsDb = frameRms > 1e-6 ? 20 * Math.log10(frameRms) : -96;

    // Calculate desired gain
    let desiredGain = 1.0;
    if (currentRmsDb > -60) {
      const errorDb = this.targetLevelDbfs - currentRmsDb;
      const rawGainLinear = Math.pow(10, errorDb / 20);
      desiredGain = Math.max(this.minGainLinear, Math.min(this.maxGainLinear, rawGainLinear));
    }

    // 2nd pass: Apply smoothed gain and soft-knee limiter
    for (let i = 0; i < samplesCount; i++) {
      const input = pcmBuffer.readInt16LE(i * 2) / 32768.0;

      // Ballistics smoothing
      const coeff = desiredGain < this.currentGain ? this.attackCoeff : this.releaseCoeff;
      this.currentGain = coeff * this.currentGain + (1 - coeff) * desiredGain;

      let amplified = input * this.currentGain;

      // Soft-knee tanh ceiling compression
      const ceiling = Math.pow(10, this.thresholdDbfs / 20); // ~0.84
      if (Math.abs(amplified) > ceiling) {
        const sign = Math.sign(amplified);
        const over = Math.abs(amplified) - ceiling;
        amplified = sign * (ceiling + (1 - ceiling) * Math.tanh(over / (1 - ceiling)));
        clippedCount++;
      }

      // Hard digital clamp safety
      const finalSample = Math.max(-1.0, Math.min(1.0, amplified));
      const int16Val = Math.floor(finalSample * 32767);
      outputBuffer.writeInt16LE(int16Val, i * 2);
    }

    const peakDb = maxPeak > 1e-6 ? 20 * Math.log10(maxPeak) : -96;
    const appliedGainDb = 20 * Math.log10(this.currentGain);

    return {
      processedBuffer: outputBuffer,
      rmsDb: Math.round(currentRmsDb * 10) / 10,
      peakDb: Math.round(peakDb * 10) / 10,
      appliedGainDb: Math.round(appliedGainDb * 10) / 10,
      samplesClipped: clippedCount
    };
  }
}
