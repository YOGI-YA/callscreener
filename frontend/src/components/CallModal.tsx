import React, { useState } from 'react';
import {
  X, ShieldCheck, ShieldAlert, ShieldX, Clock, Cpu, FileText,
  CheckCircle2, ShieldBan, ShieldPlus, Eye, EyeOff, Lock,
  AlertTriangle, MessageSquare, Activity
} from 'lucide-react';
import { ScreeningResult, ScreeningVerdict } from '../types';
import { RiskBadge, StirShakenBadge } from './RiskBadge';

interface CallModalProps {
  log: ScreeningResult | null;
  onClose: () => void;
  onAddRule: (pattern: string, action: ScreeningVerdict, description: string) => void;
}

const maskSensitiveText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|(?:[0-9]{4}[\s\-]){3}[0-9]{4})\b/g, (match) => {
      const clean = match.replace(/[\s\-]/g, '');
      return clean.length >= 13 ? `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}` : '[REDACTED_CARD]';
    })
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[REDACTED_SSN]')
    .replace(/\b(otp|code|pin|passcode|token|verification)\s*(is|:)?\s*(\d{4,8})\b/gi, '$1 $2 [REDACTED_OTP]')
    .replace(/\b(cvv|cvc)\s*(is|:)?\s*(\d{3,4})\b/gi, '$1 $2 [REDACTED_CVV]')
    .replace(/\b(account|routing)\s*(number|no|#)?\s*(is|:)?\s*(\d{8,17})\b/gi, '$1 $2 $3 [REDACTED_ACCOUNT]');
};

export const CallModal: React.FC<CallModalProps> = ({ log, onClose, onAddRule }) => {
  const [maskPii, setMaskPii] = useState<boolean>(true);

  if (!log) return null;

  const spoofProb = Math.round((log.metadata?.spoofProbability ?? (log.riskScore / 100)) * 100);
  const keywords = log.metadata?.detectedKeywords ?? [];
  const displayRationale = maskPii ? maskSensitiveText(log.rationale) : log.rationale;
  const displayCallerName = maskPii ? maskSensitiveText(log.callerName) : log.callerName;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(12px)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxHeight: '90%',
          overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          borderRadius: 'var(--radius-lg, 16px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              {displayCallerName}
            </h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-glow)', marginTop: 2 }}>
              {log.phoneNumber}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', padding: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Security & Attestation Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <RiskBadge level={log.riskLevel} verdict={log.verdict} score={log.riskScore} />
          <StirShakenBadge
            status={
              log.stirShakenStatus ||
              (log.metadata?.stirShakenAttestation === 'A' ? 'VERIFIED_A' :
               log.metadata?.stirShakenAttestation === 'B' ? 'PARTIAL_B' :
               log.category === 'CARRIER_SPOOFED' || (log.metadata?.spoofProbability && log.metadata.spoofProbability > 0.8) ? 'FAILED_SPOOF' :
               log.isCarrierVerified ? 'VERIFIED_A' : 'NOT_VERIFIED')
            }
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Category: <strong>{log.category.replace('_', ' ')}</strong>
          </span>
        </div>

        {/* PII Redaction Privacy Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md, 8px)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: maskPii ? '#34d399' : '#f59e0b' }}>
            <Lock size={14} />
            <span>{maskPii ? 'Zero-Trust PII Redaction Active (Cards, SSN, OTPs masked)' : 'Raw Transcript View (PII Unmasked)'}</span>
          </div>
          <button
            onClick={() => setMaskPii(!maskPii)}
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {maskPii ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{maskPii ? 'Reveal Raw' : 'Mask PII'}</span>
          </button>
        </div>

        {/* Live Threat Breakdown & Risk Telemetry */}
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-glow)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Activity size={13} /> Live Threat Breakdown & Radar
            </span>
            <span style={{ fontSize: '0.75rem', color: spoofProb > 60 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
              Spoof Probability: {spoofProb}%
            </span>
          </div>

          {/* Probability Bar */}
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${spoofProb}%`,
                height: '100%',
                background: spoofProb > 75 ? '#ef4444' : spoofProb > 40 ? '#f59e0b' : '#10b981',
                transition: 'width 0.4s ease'
              }}
            />
          </div>

          {/* Suspicious Keywords Chips */}
          {keywords.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Detected High-Risk Triggers:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {keywords.map((kw, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.68rem',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '2px 6px',
                      borderRadius: 4
                    }}
                  >
                    ⚠️ {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Rationale Block */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-glow)', marginBottom: 4 }}>
            AI Security Analysis & Reasoning
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
            {displayRationale}
          </p>
        </div>

        {/* Dialogue Turns History if present */}
        {log.dialogueTurns && log.dialogueTurns.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MessageSquare size={13} />
              <span>Full Screened Conversation History</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
              {log.dialogueTurns.map((turn, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: turn.sender === 'AI_ASSISTANT' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: turn.sender === 'AI_ASSISTANT' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${turn.sender === 'AI_ASSISTANT' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.12)'}`,
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ fontSize: '0.66rem', color: turn.sender === 'AI_ASSISTANT' ? '#60a5fa' : '#94a3b8', fontWeight: 600, marginBottom: 2 }}>
                    {turn.sender === 'AI_ASSISTANT' ? '🤖 Aegis AI Assistant' : '👤 Caller'}
                  </div>
                  <div style={{ color: '#fff', lineHeight: 1.35 }}>
                    {maskPii ? maskSensitiveText(turn.text) : turn.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Diagnostics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.75rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Screening Engine:</span>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{log.engine}</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Evaluation Latency:</span>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{log.latencyMs}ms</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Confidence:</span>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{Math.round(log.confidence * 100)}%</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Telecom Response:</span>
            <div style={{ fontWeight: 600, marginTop: 2 }}>
              {log.suggestedActions.disallowCall ? 'Disallowed' : log.suggestedActions.silenceCall ? 'Silenced' : 'Allowed'}
            </div>
          </div>
        </div>

        {/* Quick Whitelist/Blacklist Rules Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => {
              onAddRule(`^${log.phoneNumber.replace(/[\+\(\)\s\-]/g, '\\$&')}$`, 'ALLOW', `Whitelist ${log.callerName}`);
              onClose();
            }}
            className="btn-secondary"
            style={{ flex: 1, padding: '10px 8px', fontSize: '0.78rem', justifyContent: 'center' }}
          >
            <ShieldPlus size={14} color="var(--color-safe)" /> Add Whitelist
          </button>

          <button
            onClick={() => {
              onAddRule(`^${log.phoneNumber.replace(/[\+\(\)\s\-]/g, '\\$&')}$`, 'REJECT', `Blacklist ${log.callerName}`);
              onClose();
            }}
            className="btn-secondary"
            style={{ flex: 1, padding: '10px 8px', fontSize: '0.78rem', justifyContent: 'center' }}
          >
            <ShieldBan size={14} color="var(--color-danger)" /> Add Blacklist
          </button>
        </div>
      </div>
    </div>
  );
};
