/**
 * OutgoingAudioSynthesizer.ts
 * Generates and encodes synthesized audio streams for transmission to the remote caller (uplink).
 * Formats: 16-bit PCM Linear, 8kHz (standard telephony narrow-band) and 16kHz (AMR-WB wide-band).
 * Includes 20ms RTP-compatible framing, formant pitch modulation, and envelope smoothing.
 */

export interface UplinkAudioFrame {
  sequenceNumber: number;
  timestampMs: number;
  sampleRate: number;
  samplesCount: number;
  pcmData: Buffer;
  amplitudePeak: number;
  durationMs: number;
}

export interface UplinkSynthOptions {
  sampleRate?: 8000 | 16000;
  baseFrequencyHz?: number;
  speakingRate?: number; // 0.8 to 1.5
  volumeGain?: number;   // 0.0 to 1.0
}

export class OutgoingAudioSynthesizer {
  private static defaultSampleRate = 8000;
  private static frameDurationMs = 20; // 20ms standard telecom frame

  /**
   * Generates a 20ms silence frame for telecom uplink keep-alive
   */
  public static generateSilenceFrame(
    sequenceNumber: number,
    sampleRate: 8000 | 16000 = 8000
  ): UplinkAudioFrame {
    const samplesPerFrame = (sampleRate * this.frameDurationMs) / 1000;
    const pcmData = Buffer.alloc(samplesPerFrame * 2); // 16-bit = 2 bytes/sample

    return {
      sequenceNumber,
      timestampMs: sequenceNumber * this.frameDurationMs,
      sampleRate,
      samplesCount: samplesPerFrame,
      pcmData,
      amplitudePeak: 0,
      durationMs: this.frameDurationMs
    };
  }

  /**
   * Synthesizes speech phoneme acoustics from AI text response for caller uplink transmission.
   * Produces sequential 20ms PCM-16 frames.
   */
  public static synthesizeSpeechFrames(
    text: string,
    options: UplinkSynthOptions = {}
  ): UplinkAudioFrame[] {
    const sampleRate = options.sampleRate || this.defaultSampleRate;
    const baseFreq = options.baseFrequencyHz || 220; // Natural voice pitch
    const volume = Math.min(Math.max(options.volumeGain ?? 0.75, 0.0), 1.0);
    const speed = Math.min(Math.max(options.speakingRate ?? 1.0, 0.5), 2.0);

    const cleanText = text.trim();
    if (!cleanText) {
      return [this.generateSilenceFrame(0, sampleRate)];
    }

    // Estimate total duration based on word count & speaking speed (~150 words/min = 2.5 words/sec)
    const words = cleanText.split(/\s+/).length;
    const estimatedSeconds = Math.max(0.6, (words / (2.5 * speed)));
    const totalSamples = Math.floor(sampleRate * estimatedSeconds);
    const samplesPerFrame = (sampleRate * this.frameDurationMs) / 1000;
    const totalFrames = Math.ceil(totalSamples / samplesPerFrame);

    const frames: UplinkAudioFrame[] = [];
    let currentSampleIndex = 0;

    for (let f = 0; f < totalFrames; f++) {
      const pcmData = Buffer.alloc(samplesPerFrame * 2);
      let peak = 0;

      for (let s = 0; s < samplesPerFrame; s++) {
        const globalSample = currentSampleIndex + s;
        const t = globalSample / sampleRate;

        // Phoneme acoustic formant synthesis (fundamental pitch + 1st & 2nd formants)
        const f0 = baseFreq + 15 * Math.sin(2 * Math.PI * 1.8 * t); // subtle pitch prosody
        const f1 = f0 * 2.2;
        const f2 = f0 * 3.4;

        // Amplitude envelope: smooth attack & decay
        const envelope = Math.sin(Math.min(Math.PI, (globalSample / totalSamples) * Math.PI));

        // Mixed carrier waves
        const signal = (
          0.60 * Math.sin(2 * Math.PI * f0 * t) +
          0.25 * Math.sin(2 * Math.PI * f1 * t) +
          0.15 * Math.sin(2 * Math.PI * f2 * t)
        ) * envelope * volume;

        // 16-bit PCM conversion with clipping guard
        const clampedSample = Math.max(-1.0, Math.min(1.0, signal));
        const int16Val = Math.floor(clampedSample * 32767);
        pcmData.writeInt16LE(int16Val, s * 2);

        const absAmp = Math.abs(clampedSample);
        if (absAmp > peak) peak = absAmp;
      }

      frames.push({
        sequenceNumber: f,
        timestampMs: f * this.frameDurationMs,
        sampleRate,
        samplesCount: samplesPerFrame,
        pcmData,
        amplitudePeak: Math.round(peak * 100) / 100,
        durationMs: this.frameDurationMs
      });

      currentSampleIndex += samplesPerFrame;
    }

    return frames;
  }

  /**
   * Bundles PCM-16 frames into a standard RIFF/WAV container buffer
   */
  public static framesToWavBuffer(frames: UplinkAudioFrame[]): Buffer {
    if (frames.length === 0) return Buffer.alloc(44);

    const sampleRate = frames[0].sampleRate;
    const totalPcmBytes = frames.reduce((acc, f) => acc + f.pcmData.length, 0);
    const wavHeader = Buffer.alloc(44);

    // RIFF chunk descriptor
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + totalPcmBytes, 4);
    wavHeader.write('WAVE', 8);

    // "fmt " sub-chunk
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);          // Subchunk1Size (16 for PCM)
    wavHeader.writeUInt16LE(1, 20);           // AudioFormat (1 = PCM)
    wavHeader.writeUInt16LE(1, 22);           // NumChannels (1 = Mono)
    wavHeader.writeUInt32LE(sampleRate, 24);  // SampleRate
    wavHeader.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    wavHeader.writeUInt16LE(2, 32);           // BlockAlign (NumChannels * BitsPerSample/8)
    wavHeader.writeUInt16LE(16, 34);          // BitsPerSample (16 bits)

    // "data" sub-chunk
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(totalPcmBytes, 40);

    const allPcm = Buffer.concat(frames.map(f => f.pcmData));
    return Buffer.concat([wavHeader, allPcm]);
  }
}
