import React from 'react';
import { X, ShieldCheck, ShieldAlert, ShieldX, Clock, Cpu, FileText, CheckCircle2, ShieldBan, ShieldPlus } from 'lucide-react';
import { ScreeningResult, ScreeningVerdict } from '../types';
import { RiskBadge, StirShakenBadge } from './RiskBadge';

interface CallModalProps {
  log: ScreeningResult | null;
  onClose: () => void;
  onAddRule: (pattern: string, action: ScreeningVerdict, description: string) => void;
}

export const CallModal: React.FC<CallModalProps> = ({ log, onClose, onAddRule }) => {
  if (!log) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
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
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-md)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{log.callerName}</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-glow)', marginTop: 2 }}>
              {log.phoneNumber}
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

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
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Category: <strong>{log.category.replace('_', ' ')}</strong>
          </span>
        </div>

        {/* AI Rationale Block */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-glow)', marginBottom: 4 }}>
            AI Security Analysis & Reasoning
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
            {log.rationale}
          </p>
        </div>

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
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
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
