import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, Radio, Activity, ShieldCheck } from 'lucide-react';

export interface AudioWaveformHUDProps {
  activeSpeaker?: 'CALLER' | 'AI_ASSISTANT' | 'SILENT_MONITORING' | 'IDLE';
  isListening?: boolean;
  uplinkSilenced?: boolean;
  customLabel?: string;
  sampleRateHz?: number;
}

export const AudioWaveformHUD: React.FC<AudioWaveformHUDProps> = ({
  activeSpeaker = 'CALLER',
  isListening = true,
  uplinkSilenced = true,
  customLabel,
  sampleRateHz = 16000
}) => {
  const [decibels, setDecibels] = useState<number>(-24);
  const [waveHeights, setWaveHeights] = useState<number[]>(() =>
    Array.from({ length: 24 }, () => 8)
  );

  useEffect(() => {
    if (!isListening) {
      setDecibels(-60);
      setWaveHeights(Array.from({ length: 24 }, () => 4));
      return;
    }

    const interval = setInterval(() => {
      // Dynamic frequency synthesis depending on who is talking
      if (activeSpeaker === 'CALLER') {
        const baseDb = -18 + Math.sin(Date.now() / 200) * 8 + (Math.random() * 4 - 2);
        setDecibels(Math.round(baseDb * 10) / 10);
        setWaveHeights(
          Array.from({ length: 24 }, (_, i) => {
            const harmonic = Math.sin((i / 24) * Math.PI * 3 + Date.now() / 150);
            const noise = Math.random() * 0.4;
            const normalized = Math.max(0.15, Math.min(1, Math.abs(harmonic) * 0.8 + noise));
            return Math.round(normalized * 44);
          })
        );
      } else if (activeSpeaker === 'AI_ASSISTANT') {
        const baseDb = -14 + Math.sin(Date.now() / 160) * 6;
        setDecibels(Math.round(baseDb * 10) / 10);
        setWaveHeights(
          Array.from({ length: 24 }, (_, i) => {
            const bell = Math.exp(-Math.pow((i - 12) / 6, 2));
            const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 120 + i);
            return Math.max(6, Math.round(bell * pulse * 46));
          })
        );
      } else {
        // Silent monitoring or idle
        setDecibels(-48 + Math.random() * 3);
        setWaveHeights(Array.from({ length: 24 }, () => Math.round(4 + Math.random() * 4)));
      }
    }, 90);

    return () => clearInterval(interval);
  }, [activeSpeaker, isListening]);

  const speakerConfig = {
    CALLER: {
      label: customLabel || 'Caller Audio Stream',
      barClass: '',
      color: '#38bdf8',
      icon: Volume2
    },
    AI_ASSISTANT: {
      label: customLabel || 'Aegis AI Synthesizer Uplink',
      barClass: 'ai',
      color: '#ec4899',
      icon: Radio
    },
    SILENT_MONITORING: {
      label: customLabel || 'Private Wiretap Listen-In',
      barClass: '',
      color: '#818cf8',
      icon: Activity
    },
    IDLE: {
      label: customLabel || 'Telemetry Standby',
      barClass: 'silent',
      color: '#64748b',
      icon: Volume2
    }
  }[activeSpeaker];

  const SpeakerIcon = speakerConfig.icon;

  return (
    <div className="audio-waveform-hud" data-testid="audio-waveform-hud">
      <div className="waveform-header">
        <div className="waveform-title" style={{ color: speakerConfig.color }}>
          <SpeakerIcon size={14} />
          <span>{speakerConfig.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {uplinkSilenced && (
            <span
              className="waveform-metric-badge"
              style={{
                borderColor: 'rgba(16, 185, 129, 0.35)',
                color: '#10b981',
                fontSize: '0.68rem',
                fontWeight: 600
              }}
              title="Device microphone is completely muted from caller to prevent ambient room leakage"
            >
              <MicOff size={11} />
              Mic Muted
            </span>
          )}
          <span
            className="waveform-metric-badge"
            style={{
              color: decibels > -20 ? '#38bdf8' : 'var(--text-muted)',
              fontWeight: 700
            }}
          >
            {decibels > -50 ? `${decibels} dBFS` : 'SILENT'}
          </span>
        </div>
      </div>

      <div className="waveform-bars-track" aria-label="Live Audio Frequency Waveform">
        {waveHeights.map((h, idx) => (
          <div
            key={idx}
            className={`waveform-bar-col ${speakerConfig.barClass} ${
              !isListening ? 'silent' : ''
            }`}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>

      <div className="waveform-metrics-row">
        <span>DSP: PCM {sampleRateHz / 1000}kHz 16-bit</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ShieldCheck size={12} color="#10b981" />
          Acoustic Echo Guard Active
        </span>
      </div>
    </div>
  );
};
