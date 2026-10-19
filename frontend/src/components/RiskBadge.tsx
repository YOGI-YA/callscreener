import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, PhoneCall } from 'lucide-react';
import { RiskLevel, ScreeningVerdict } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
  verdict?: ScreeningVerdict;
  score?: number;
  showScore?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, verdict, score, showScore = true }) => {
  const getBadgeClass = () => {
    switch (level) {
      case 'SAFE':
        return 'risk-badge safe';
      case 'LOW':
      case 'SUSPICIOUS':
        return 'risk-badge suspicious';
      case 'CRITICAL_SPAM':
      default:
        return 'risk-badge critical_spam';
    }
  };

  const getIcon = () => {
    switch (level) {
      case 'SAFE':
        return <ShieldCheck size={14} />;
      case 'LOW':
      case 'SUSPICIOUS':
        return <ShieldAlert size={14} />;
      case 'CRITICAL_SPAM':
      default:
        return <ShieldX size={14} />;
    }
  };

  const getLabel = () => {
    if (verdict) {
      return verdict === 'ALLOW' ? 'Allowed' : verdict === 'SILENCE' ? 'Silenced' : 'Blocked';
    }
    switch (level) {
      case 'SAFE':
        return 'Verified Safe';
      case 'LOW':
        return 'Low Risk';
      case 'SUSPICIOUS':
        return 'Suspicious';
      case 'CRITICAL_SPAM':
        return 'High Risk Spam';
    }
  };

  return (
    <span className={getBadgeClass()} title={`Risk Score: ${score ?? 0}/100`}>
      {getIcon()}
      <span>{getLabel()}</span>
      {showScore && score !== undefined && (
        <span style={{ opacity: 0.8, fontSize: '0.7rem', fontWeight: 600 }}>
          ({score})
        </span>
      )}
    </span>
  );
};

export interface StirShakenBadgeProps {
  status?: 'VERIFIED_A' | 'PARTIAL_B' | 'GATEWAY_C' | 'FAILED_SPOOF' | 'NOT_VERIFIED';
  compact?: boolean;
}

export const StirShakenBadge: React.FC<StirShakenBadgeProps> = ({ status = 'NOT_VERIFIED', compact = false }) => {
  if (status === 'VERIFIED_A') {
    return (
      <span
        className="stir-shaken-badge verified-a"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: '999px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.02em'
        }}
        title="STIR/SHAKEN Level A Full Attestation: Caller identity cryptographically verified by carrier"
      >
        <ShieldCheck size={12} />
        <span>{compact ? 'Verified A' : 'STIR/SHAKEN Verified (A)'}</span>
      </span>
    );
  }

  if (status === 'PARTIAL_B') {
    return (
      <span
        className="stir-shaken-badge partial-b"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: '999px',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          color: '#f59e0b',
          fontSize: '0.72rem',
          fontWeight: 600
        }}
        title="STIR/SHAKEN Level B Partial Attestation: Origin customer known, but telephone number not verified"
      >
        <ShieldAlert size={12} />
        <span>{compact ? 'Partial B' : 'STIR/SHAKEN Partial (B)'}</span>
      </span>
    );
  }

  if (status === 'FAILED_SPOOF') {
    return (
      <span
        className="stir-shaken-badge failed-spoof"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: '999px',
          background: 'rgba(239, 68, 68, 0.18)',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          color: '#ef4444',
          fontSize: '0.72rem',
          fontWeight: 700
        }}
        title="Carrier Spoof Alert: Cryptographic verification failed! Caller ID was forged."
      >
        <ShieldX size={12} />
        <span>{compact ? 'Spoof Alert' : 'Carrier Spoofed (FAILED)'}</span>
      </span>
    );
  }

  return (
    <span
      className="stir-shaken-badge not-verified"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: '999px',
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        color: '#94a3b8',
        fontSize: '0.72rem',
        fontWeight: 500
      }}
      title="STIR/SHAKEN verification not supported or unverified by origin carrier"
    >
      <PhoneCall size={12} />
      <span>{compact ? 'Unverified' : 'Carrier Unverified'}</span>
    </span>
  );
};
