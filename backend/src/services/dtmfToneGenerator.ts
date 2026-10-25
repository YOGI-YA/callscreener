/**
 * DtmfToneGenerator.ts
 * Generates ITU-T Recommendation Q.23 standard Dual-Tone Multi-Frequency (DTMF)
 * audio signals for telecom uplink transmission to remote callers and automated phone trees.
 */

// Standard ITU-T Q.23 DTMF Frequencies (Hz)
// Row frequencies (Low group): 697, 770, 852, 941
// Column frequencies (High group): 1209, 1336, 1477, 1633
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  'A': [697, 1633],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  'B': [770, 1633],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  'C': [852, 1633],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
  'D': [941, 1633]
};

export interface DtmfConfig {
  sampleRate?: 8000 | 16000;
  toneDurationMs?: number; // Standard 100ms
  silenceDurationMs?: number; // Standard 100ms gap between digits
  amplitude?: number; // 0.0 to 1.0 (telecom standard -6dBm to -8dBm)
  twistDb?: number; // High-to-low group power ratio (+2dB standard twist)
}

export class DtmfToneGenerator {
  /**
   * Generates PCM-16 audio buffer for a single DTMF digit
   */
  public static generateDigit(digit: string, config: DtmfConfig = {}): Buffer {
    const key = digit.toUpperCase();
    const freqs = DTMF_FREQUENCIES[key];
    if (!freqs) {
      throw new Error(`Unsupported DTMF digit: '${digit}'`);
    }

    const sampleRate = config.sampleRate || 8000;
    const toneMs = config.toneDurationMs ?? 100;
    const silenceMs = config.silenceDurationMs ?? 60;
    const baseAmp = Math.min(1.0, Math.max(0.1, config.amplitude ?? 0.7));

    // Standard +2dB high-frequency twist (ITU-T Q.23)
    const twistFactor = 1.25; // ~+2dB
    const lowAmp = baseAmp / (1 + twistFactor);
    const highAmp = lowAmp * twistFactor;

    const [fLow, fHigh] = freqs;
    const toneSamples = Math.floor((sampleRate * toneMs) / 1000);
    const silenceSamples = Math.floor((sampleRate * silenceMs) / 1000);
    const totalSamples = toneSamples + silenceSamples;

    const buffer = Buffer.alloc(totalSamples * 2);

    // Generate active tone with 5ms cosine fade-in/fade-out to eliminate click transients
    const rampSamples = Math.floor((sampleRate * 5) / 1000);

    for (let i = 0; i < toneSamples; i++) {
      const t = i / sampleRate;

      let ramp = 1.0;
      if (i < rampSamples) {
        ramp = 0.5 * (1 - Math.cos((Math.PI * i) / rampSamples));
      } else if (i > toneSamples - rampSamples) {
        ramp = 0.5 * (1 - Math.cos((Math.PI * (toneSamples - i)) / rampSamples));
      }

      const sampleVal = (
        lowAmp * Math.sin(2 * Math.PI * fLow * t) +
        highAmp * Math.sin(2 * Math.PI * fHigh * t)
      ) * ramp;

      const clamped = Math.max(-1.0, Math.min(1.0, sampleVal));
      buffer.writeInt16LE(Math.floor(clamped * 32767), i * 2);
    }

    // Silence gap remains 0-filled
    return buffer;
  }

  /**
   * Generates PCM-16 sequence for a string of DTMF digits (e.g. "123#")
   */
  public static generateSequence(digits: string, config: DtmfConfig = {}): Buffer {
    const buffers: Buffer[] = [];
    for (const char of digits) {
      if (char === ' ') continue;
      if (DTMF_FREQUENCIES[char.toUpperCase()]) {
        buffers.push(this.generateDigit(char, config));
      }
    }
    return Buffer.concat(buffers);
  }
}
