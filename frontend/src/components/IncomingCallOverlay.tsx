import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, VolumeX, ShieldAlert, CheckCircle, Sparkles, Cpu, Clock } from 'lucide-react';
import { IncomingCallPayload, ScreeningResult } from '../types';
import { RiskBadge } from './RiskBadge';
import { CapacitorService } from '../services/capacitorService';

interface IncomingCallOverlayProps {
  incomingCall: IncomingCallPayload;
  screeningResult: ScreeningResult | null;
  isProcessing: boolean;
  onDismiss: () => void;
  onOverrideAction: (action: 'ALLOW' | 'SILENCE' | 'REJECT') => void;
}

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  incomingCall,
  screeningResult,
  isProcessing,
  onDismiss,
  onOverrideAction
}) => {
  const [displayedTranscript, setDisplayedTranscript] = useState<string>('');

  useEffect(() => {
    CapacitorService.triggerHapticFeedback();

    if (incomingCall.simulatedAudioTranscript) {
      // Simulate live streaming speech-to-text words
      const fullText = incomingCall.simulatedAudioTranscript;
      let currentIndex = 0;
      setDisplayedTranscript('');

      const interval = setInterval(() => {
        if (currentIndex < fullText.length) {
          currentIndex += 3;
          setDisplayedTranscript(fullText.substring(0, currentIndex));
        } else {
          clearInterval(interval);
        }
      }, 30);

      return () => clearInterval(interval);
    } else {
      setDisplayedTranscript('Listening to incoming audio stream...');
    }
  }, [incomingCall]);

  const getVerdictGradient = () => {
    if (!screeningResult) return 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, transparent 100%)';
    switch (screeningResult.verdict) {
      case 'REJECT':
        return 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, transparent 100%)';
      case 'SILENCE':
        return 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, transparent 100%)';
      case 'ALLOW':
      default:
        return 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, transparent 100%)';
    }
  };

  return (
    <div className="call-overlay-backdrop" style={{ background: getVerdictGradient() }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="status-dot" style={{ backgroundColor: isProcessing ? 'var(--color-warning)' : 'var(--color-safe)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {isProcessing ? 'AI CallScreeningService Active' : 'Automated Screening Complete'}
          </span>
        </div>
        <button
          onClick={onDismiss}
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          Dismiss
        </button>
      </div>

      {/* Caller Info Header */}
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: isProcessing
              ? 'rgba(99, 102, 241, 0.2)'
              : screeningResult?.verdict === 'REJECT'
              ? 'var(--color-danger-bg)'
              : 'var(--color-safe-bg)',
            border: `2px solid ${
              isProcessing
                ? 'var(--accent-glow)'
                : screeningResult?.verdict === 'REJECT'
                ? 'var(--color-danger)'
                : 'var(--color-safe)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: isProcessing ? 'var(--shadow-glow)' : 'none'
          }}
        >
          <Phone size={32} color="#fff" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
          {incomingCall.callerName || 'Unknown Caller'}
        </h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: 'var(--accent-glow)', fontWeight: 600 }}>
          {incomingCall.phoneNumber}
        </div>
        {incomingCall.location && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            📍 {incomingCall.location} {incomingCall.carrier ? `• ${incomingCall.carrier}` : ''}
          </div>
        )}
      </div>

      {/* Live AI Audio Screening Stream */}
      <div
        className="glass-card"
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid var(--border-medium)',
          padding: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--accent-glow)', fontWeight: 700 }}>
            <Sparkles size={16} />
            <span>AI Voice Screener & Speech Stream</span>
          </div>
          <div className="audio-wave-container">
            <div className="wave-bar" />
            <div className="wave-bar" />
            <div className="wave-bar" />
            <div className="wave-bar" />
            <div className="wave-bar" />
          </div>
        </div>

        <div
          style={{
            fontSize: '0.88rem',
            lineHeight: 1.45,
            color: 'var(--text-primary)',
            background: 'rgba(0,0,0,0.35)',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            minHeight: 60,
            fontFamily: 'var(--font-mono)',
            borderLeft: '3px solid var(--accent-primary)'
          }}
        >
          "{displayedTranscript}"
        </div>

        {/* Screening Assessment Result */}
        {screeningResult && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <RiskBadge level={screeningResult.riskLevel} verdict={screeningResult.verdict} score={screeningResult.riskScore} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <Clock size={12} />
                <span>{screeningResult.latencyMs}ms ({screeningResult.engine})</span>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {screeningResult.rationale}
            </p>

            {/* Verdict Action Alert */}
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background:
                  screeningResult.verdict === 'REJECT'
                    ? 'var(--color-danger-bg)'
                    : screeningResult.verdict === 'SILENCE'
                    ? 'var(--color-warning-bg)'
                    : 'var(--color-safe-bg)',
                color:
                  screeningResult.verdict === 'REJECT'
                    ? 'var(--color-danger)'
                    : screeningResult.verdict === 'SILENCE'
                    ? 'var(--color-warning)'
                    : 'var(--color-safe)'
              }}
            >
              {screeningResult.verdict === 'REJECT' ? (
                <>🚫 Automated Decision: Disallowing and Rejecting Call</>
              ) : screeningResult.verdict === 'SILENCE' ? (
                <>🔕 Automated Decision: Silencing Ringer</>
              ) : (
                <>✅ Automated Decision: Allowing Ringer Through</>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Manual Override Action Buttons */}
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 10 }}>
          Manual Telecom Action Override
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <button
            onClick={() => onOverrideAction('REJECT')}
            className="btn-danger"
            style={{ justifyContent: 'center', padding: '14px 8px', flexDirection: 'column', gap: 4 }}
          >
            <PhoneOff size={20} />
            <span style={{ fontSize: '0.75rem' }}>Block / Reject</span>
          </button>

          <button
            onClick={() => onOverrideAction('SILENCE')}
            className="btn-secondary"
            style={{ justifyContent: 'center', padding: '14px 8px', flexDirection: 'column', gap: 4 }}
          >
            <VolumeX size={20} />
            <span style={{ fontSize: '0.75rem' }}>Silence</span>
          </button>

          <button
            onClick={() => onOverrideAction('ALLOW')}
            style={{
              background: 'var(--color-safe-bg)',
              border: '1px solid var(--color-safe-border)',
              color: 'var(--color-safe)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '14px 8px',
              fontWeight: 600
            }}
          >
            <CheckCircle size={20} />
            <span style={{ fontSize: '0.75rem' }}>Allow / Answer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
