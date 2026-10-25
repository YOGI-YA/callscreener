import React, { useState, useEffect } from 'react';

export interface OutgoingAudioMonitorProps {
  isCallActive: boolean;
  isAiSpeaking: boolean;
  uplinkVolumeDb?: number;
  downlinkVolumeDb?: number;
  comfortNoiseActive?: boolean;
  networkLatencyMs?: number;
  isUserMicMuted?: boolean;
  onToggleMute?: () => void;
}

export const OutgoingAudioMonitor: React.FC<OutgoingAudioMonitorProps> = ({
  isCallActive,
  isAiSpeaking,
  uplinkVolumeDb = -18,
  downlinkVolumeDb = -32,
  comfortNoiseActive = false,
  networkLatencyMs = 24,
  isUserMicMuted = true,
  onToggleMute
}) => {
  const [uplinkMeter, setUplinkMeter] = useState(0);
  const [downlinkMeter, setDownlinkMeter] = useState(0);

  useEffect(() => {
    if (!isCallActive) {
      setUplinkMeter(0);
      setDownlinkMeter(0);
      return;
    }

    const interval = setInterval(() => {
      // Simulate real-time audio VU fluctuations
      if (isAiSpeaking) {
        setUplinkMeter(Math.min(100, Math.max(20, Math.floor(65 + (Math.random() * 30 - 15)))));
      } else if (comfortNoiseActive) {
        setUplinkMeter(12 + Math.floor(Math.random() * 6));
      } else {
        setUplinkMeter(4);
      }

      setDownlinkMeter(Math.min(100, Math.max(10, Math.floor(45 + (Math.random() * 40 - 20)))));
    }, 120);

    return () => clearInterval(interval);
  }, [isCallActive, isAiSpeaking, comfortNoiseActive]);

  return (
    <div
      className="outgoing-audio-monitor-card"
      data-testid="outgoing-audio-monitor"
      style={{
        background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(15, 23, 42, 0.9))',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '14px',
        padding: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isCallActive ? '#10b981' : '#64748b',
              boxShadow: isCallActive ? '0 0 10px #10b981' : 'none',
              animation: isCallActive ? 'pulse 2s infinite' : 'none'
            }}
          />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.02em' }}>
            Acoustic Uplink & Caller Audio Isolation
          </h4>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span
            data-testid="audio-isolation-badge"
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '20px',
              background: isUserMicMuted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: isUserMicMuted ? '#34d399' : '#f87171',
              border: `1px solid ${isUserMicMuted ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`
            }}
          >
            {isUserMicMuted ? '🛡️ Local Mic Silenced' : '⚠️ Mic Live to Caller'}
          </span>
          {comfortNoiseActive && (
            <span
              data-testid="comfort-noise-indicator"
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '20px',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                border: '1px solid rgba(129, 140, 248, 0.4)'
              }}
            >
              Comfort Noise Active (-55dB)
            </span>
          )}
        </div>
      </div>

      {/* Real-time VU Levels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        {/* Outgoing Uplink (What Caller Hears) */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '10px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
            <span style={{ color: '#94a3b8' }}>Uplink (To Caller):</span>
            <span
              data-testid="uplink-db-value"
              style={{ color: isAiSpeaking ? '#38bdf8' : '#94a3b8', fontWeight: 600 }}
            >
              {isAiSpeaking ? `${uplinkVolumeDb} dBFS (AI Speaking)` : `${comfortNoiseActive ? -55 : -96} dBFS`}
            </span>
          </div>
          <div style={{ height: '8px', background: '#0f172a', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${uplinkMeter}%`,
                background: 'linear-gradient(90deg, #3b82f6, #06b6d4, #10b981)',
                transition: 'width 0.12s ease',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        {/* Incoming Downlink (What Caller Is Saying) */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '10px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
            <span style={{ color: '#94a3b8' }}>Downlink (Caller Voice):</span>
            <span style={{ color: '#a78bfa', fontWeight: 600 }}>{downlinkVolumeDb} dBFS</span>
          </div>
          <div style={{ height: '8px', background: '#0f172a', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${downlinkMeter}%`,
                background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                transition: 'width 0.12s ease',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Telemetry bar & User control */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
        <div style={{ display: 'flex', gap: '14px' }}>
          <span>Latency: <strong style={{ color: '#e2e8f0' }}>{networkLatencyMs}ms</strong></span>
          <span>Jitter: <strong style={{ color: '#e2e8f0' }}>1.2ms</strong></span>
          <span>Packet Loss: <strong style={{ color: '#10b981' }}>0.0%</strong></span>
          <span>Codec: <strong style={{ color: '#e2e8f0' }}>PCM-16 / 8kHz</strong></span>
        </div>
        {onToggleMute && (
          <button
            onClick={onToggleMute}
            data-testid="toggle-isolation-button"
            style={{
              background: isUserMicMuted ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.3)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#e2e8f0',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500
            }}
          >
            {isUserMicMuted ? 'Unmute Mic to Caller' : 'Mute Mic to Caller'}
          </button>
        )}
      </div>
    </div>
  );
};
