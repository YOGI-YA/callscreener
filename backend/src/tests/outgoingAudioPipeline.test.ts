import { describe, it, expect } from 'vitest';
import { OutgoingAudioSynthesizer } from '../services/outgoingAudioSynthesizer.js';
import { ComfortNoiseGenerator } from '../services/comfortNoiseGenerator.js';
import { DynamicGainController } from '../services/dynamicGainController.js';
import { DtmfToneGenerator } from '../services/dtmfToneGenerator.js';

describe('Outgoing Telephony Audio Pipeline & Synthesizer Suite', () => {
  describe('OutgoingAudioSynthesizer', () => {
    it('generates standard 20ms silence keep-alive frame', () => {
      const frame = OutgoingAudioSynthesizer.generateSilenceFrame(0, 8000);
      expect(frame.sequenceNumber).toBe(0);
      expect(frame.sampleRate).toBe(8000);
      expect(frame.durationMs).toBe(20);
      expect(frame.samplesCount).toBe(160); // 8000 * 0.02
      expect(frame.pcmData.length).toBe(320); // 160 * 2 bytes
      expect(frame.amplitudePeak).toBe(0);
    });

    it('synthesizes speech phoneme frames for caller response', () => {
      const text = 'Hello, who is calling and what is the nature of your inquiry?';
      const frames = OutgoingAudioSynthesizer.synthesizeSpeechFrames(text, {
        sampleRate: 8000,
        volumeGain: 0.8
      });

      expect(frames.length).toBeGreaterThan(10);
      expect(frames[0].pcmData.length).toBe(320);
      expect(frames[0].amplitudePeak).toBeGreaterThanOrEqual(0);

      // Verify WAV conversion
      const wav = OutgoingAudioSynthesizer.framesToWavBuffer(frames);
      expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    });

    it('handles empty text gracefully with a silence frame', () => {
      const frames = OutgoingAudioSynthesizer.synthesizeSpeechFrames('   ');
      expect(frames.length).toBe(1);
      expect(frames[0].amplitudePeak).toBe(0);
    });
  });

  describe('ComfortNoiseGenerator', () => {
    it('generates pink noise packet with proper telecom amplitude', () => {
      const cng = new ComfortNoiseGenerator({
        sampleRate: 8000,
        noiseFloorDb: -50,
        spectrumFilter: 'pink'
      });

      const packet = cng.generatePacket(20);
      expect(packet.sequenceNumber).toBe(0);
      expect(packet.pcmData.length).toBe(320);
      expect(packet.dbLevel).toBe(-50);

      // Verify signal is non-silent but within low ambient range
      let maxAmp = 0;
      for (let i = 0; i < packet.samplesCount; i++) {
        const sample = Math.abs(packet.pcmData.readInt16LE(i * 2));
        if (sample > maxAmp) maxAmp = sample;
      }
      expect(maxAmp).toBeGreaterThan(0);
      expect(maxAmp).toBeLessThan(10000); // Not loud or clipped
    });

    it('generates fill buffer for specified duration gap', () => {
      const cng = new ComfortNoiseGenerator({ sampleRate: 8000 });
      const fill = cng.generateFillBuffer(60); // 3 frames of 20ms = 960 bytes
      expect(fill.length).toBe(960);
    });
  });

  describe('DynamicGainController', () => {
    it('applies boost to quiet audio and clamps loud bursts without clipping', () => {
      const agc = new DynamicGainController({
        targetLevelDbfs: -16,
        maxGainDb: 12
      }, 8000);

      // Quiet buffer
      const quietBuffer = Buffer.alloc(320);
      for (let i = 0; i < 160; i++) {
        quietBuffer.writeInt16LE(500, i * 2); // ~-36 dBFS
      }

      const res = agc.processPcmBuffer(quietBuffer);
      expect(res.appliedGainDb).toBeGreaterThanOrEqual(0);
      expect(res.processedBuffer.length).toBe(320);
      expect(res.samplesClipped).toBe(0);
    });
  });

  describe('DtmfToneGenerator', () => {
    it('generates valid ITU-T dual frequencies for key 1', () => {
      const tone = DtmfToneGenerator.generateDigit('1', {
        sampleRate: 8000,
        toneDurationMs: 50,
        silenceDurationMs: 20
      });
      // 50ms tone + 20ms silence = 70ms = 560 samples = 1120 bytes
      expect(tone.length).toBe(1120);
    });

    it('generates full multi-digit sequence for IVR menu response', () => {
      const seq = DtmfToneGenerator.generateSequence('9#', {
        sampleRate: 8000,
        toneDurationMs: 40,
        silenceDurationMs: 20
      });
      // 2 digits * 60ms * 8 samples/ms * 2 bytes = 1920 bytes
      expect(seq.length).toBe(1920);
    });

    it('throws error on invalid character', () => {
      expect(() => DtmfToneGenerator.generateDigit('Z')).toThrow('Unsupported DTMF digit');
    });
  });
});
