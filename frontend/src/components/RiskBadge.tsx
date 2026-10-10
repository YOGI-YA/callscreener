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
