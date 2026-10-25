/**
 * ComfortNoiseGenerator.ts
 * Implements RFC 3389 & ITU-T G.711 Appendix II style Comfort Noise Generation (CNG)
 * for telecom uplink audio streaming towards remote callers.
 * Prevents cellular carrier squelch and unnatural 'dead-air' silence during AI reasoning gaps.
 */

export interface ComfortNoiseConfig {
  sampleRate?: 8000 | 16000;
  noiseFloorDb?: number; // e.g. -60 dB to -45 dB
  spectrumFilter?: 'pink' | 'white' | 'room_acoustic';
}

export class ComfortNoiseGenerator {
  // Pink noise filter state variables (Paul Kellet's filter)
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private b3 = 0;
  private b4 = 0;
  private b5 = 0;
  private b6 = 0;

  private currentSequence = 0;

  constructor(private config: ComfortNoiseConfig = {}) {}

  /**
   * Converts dBFS to linear amplitude scale (0.0 to 1.0)
   */
  public static dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  /**
   * Resets filter state between separate phone calls
   */
  public reset(): void {
    this.b0 = 0;
    this.b1 = 0;
    this.b2 = 0;
    this.b3 = 0;
    this.b4 = 0;
    this.b5 = 0;
    this.b6 = 0;
    this.currentSequence = 0;
  }

  /**
   * Generates a 20ms comfort noise packet encoded as 16-bit linear PCM
   */
  public generatePacket(durationMs: number = 20): {
    sequenceNumber: number;
    pcmData: Buffer;
    dbLevel: number;
    samplesCount: number;
  } {
    const sampleRate = this.config.sampleRate || 8000;
    const noiseDb = this.config.noiseFloorDb ?? -55; // natural ambient line presence
    const targetAmplitude = ComfortNoiseGenerator.dbToLinear(noiseDb);
    const filterType = this.config.spectrumFilter || 'pink';

    const samplesCount = Math.floor((sampleRate * durationMs) / 1000);
    const pcmData = Buffer.alloc(samplesCount * 2);

    for (let i = 0; i < samplesCount; i++) {
      // White noise raw generator (-1.0 to 1.0)
      const white = Math.random() * 2 - 1;
      let sample = white;

      if (filterType === 'pink' || filterType === 'room_acoustic') {
        // Paul Kellet's 3dB/octave filter for natural warm pink background
        this.b0 = 0.99886 * this.b0 + white * 0.0555179;
        this.b1 = 0.99332 * this.b1 + white * 0.0750759;
        this.b2 = 0.96900 * this.b2 + white * 0.1538520;
        this.b3 = 0.86650 * this.b3 + white * 0.3104856;
        this.b4 = 0.55000 * this.b4 + white * 0.5329522;
        this.b5 = -0.7616 * this.b5 - white * 0.0168980;
        sample = (this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362) * 0.11;
        this.b6 = white * 0.115926;

        if (filterType === 'room_acoustic') {
          // Additional gentle low-pass to mimic soft handset ambient room roominess
          sample *= 0.85;
        }
      }

      // Scale to target dB level
      const scaled = sample * targetAmplitude;
      const clamped = Math.max(-1.0, Math.min(1.0, scaled));
      const int16Val = Math.floor(clamped * 32767);
      pcmData.writeInt16LE(int16Val, i * 2);
    }

    const seq = this.currentSequence++;
    return {
      sequenceNumber: seq,
      pcmData,
      dbLevel: noiseDb,
      samplesCount
    };
  }

  /**
   * Fills an empty gap of milliseconds with seamless comfort noise
   */
  public generateFillBuffer(durationMs: number): Buffer {
    const packets = Math.ceil(durationMs / 20);
    const chunks: Buffer[] = [];
    for (let p = 0; p < packets; p++) {
      chunks.push(this.generatePacket(20).pcmData);
    }
    return Buffer.concat(chunks);
  }
}
