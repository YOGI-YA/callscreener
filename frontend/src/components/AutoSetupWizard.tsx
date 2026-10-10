import React, { useState } from 'react';
import { Shield, CheckCircle2, Smartphone, Zap, Sparkles, ArrowRight } from 'lucide-react';
import { CapacitorService } from '../services/capacitorService';
import { ApiService } from '../services/api';

interface AutoSetupWizardProps {
  onComplete: () => void;
}

export const AutoSetupWizard: React.FC<AutoSetupWizardProps> = ({ onComplete }) => {
  const [isActivating, setIsActivating] = useState(false);
  const [roleGranted, setRoleGranted] = useState(false);
  const [stepMessage, setStepMessage] = useState<string | null>(null);

  const handleOneTapActivate = async () => {
    setIsActivating(true);
    setStepMessage('Requesting Android Telecom Call Screening permission...');

    try {
      const res = await CapacitorService.requestScreeningRole();
      if (res.success) {
        setRoleGranted(true);
        setStepMessage('Telecom CallScreeningService successfully activated!');
      } else {
        setStepMessage(res.message);
      }
    } catch (e: any) {
      setStepMessage('Setup completed in on-device mode.');
    } finally {
      setIsActivating(false);
      ApiService.completeFirstRun();
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#080c14',
        backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 24px',
        color: '#fff',
        animation: 'overlayFadeIn 0.4s ease-out'
      }}
    >
      {/* Top Branding */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 0 35px rgba(99, 102, 241, 0.55)'
          }}
        >
          <Shield size={44} color="#fff" />
        </div>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
          AegisCall AI
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Self-Contained On-Device Telecom Spam Defense
        </p>
      </div>

      {/* Automatic Pre-Configuration Checklist */}
      <div
        className="glass-card"
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid var(--border-glow)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-glow)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} /> Automatic Setup Status
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={18} color="var(--color-safe)" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>On-Device AI Engine</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Embedded directly in mobile code — 0 cloud required</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={18} color="var(--color-safe)" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fraud &amp; Emergency Rules</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Emergency bypass &amp; toll fraud database preloaded</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Smartphone size={18} color={roleGranted ? 'var(--color-safe)' : 'var(--accent-glow)'} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Android Telecom Shield</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {roleGranted ? 'Active Default Screener' : 'Ready to activate on your phone'}
            </div>
          </div>
        </div>

        {stepMessage && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-glow)', background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
            {stepMessage}
          </div>
        )}
      </div>

      {/* Primary Action */}
      <div>
        <button
          onClick={handleOneTapActivate}
          disabled={isActivating}
          className="btn-primary"
          style={{ width: '100%', padding: '16px 20px', fontSize: '1rem', fontWeight: 700 }}
        >
          <span>{isActivating ? 'Activating Defense...' : 'Activate Spam Protection (1-Tap)'}</span>
          <ArrowRight size={18} />
        </button>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
          100% Private • Operates Offline • Zero Subscription Fees
        </div>
      </div>
    </div>
  );
};
