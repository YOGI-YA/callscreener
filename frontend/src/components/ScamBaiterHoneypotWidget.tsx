import React, { useState } from 'react';
import { Skull, Bot, Timer, Shield, Sparkles, MessageSquare, Flame } from 'lucide-react';
import { ApiService } from '../services/api';

export interface ScamBaiterHoneypotWidgetProps {
  phoneNumber?: string;
  isScamCall?: boolean;
}

export const ScamBaiterHoneypotWidget: React.FC<ScamBaiterHoneypotWidgetProps> = ({
  phoneNumber = '+1 (800) 555-0199',
  isScamCall = true,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [persona, setPersona] = useState<'ELDERLY_CONFUSED' | 'SLOW_TYPING_WORKER' | 'BUREAUCRATIC_OFFICIAL'>('ELDERLY_CONFUSED');
  const [turns, setTurns] = useState<{ sender: 'SCAMMER' | 'HONEYPOT_AI'; text: string; seconds: number }[]>([
    {
      sender: 'SCAMMER',
      text: 'You have a pending arrest warrant for money laundering! Transfer the verification fee immediately.',
      seconds: 5
    },
    {
      sender: 'HONEYPOT_AI',
      text: "Oh heavens, police? Please don't wake up the neighborhood cat, she's very sensitive! Let me find my slippers under the sofa, don't hang up...",
      seconds: 42
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [totalSecondsWasted, setTotalSecondsWasted] = useState(42);

  const handleSendScammerLine = async () => {
    if (!inputText.trim()) return;
    const scammerLine = inputText.trim();
    setInputText('');

    const newTurns = [...turns, { sender: 'SCAMMER' as const, text: scammerLine, seconds: 6 }];
    setTurns(newTurns);
    setIsGenerating(true);

    try {
      const response = await fetch(`${ApiService.getBaseUrl()}/api/honeypot/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          scammerUtterance: scammerLine,
          turnIndex: newTurns.length,
          preferredPersona: persona
        })
      });
      const data = await response.json();
      if (data.success && data.data) {
        const stalling = data.data.aiStallingResponse;
        const wasted = data.data.scammerSecondsWasted || 45;
        setTurns((prev) => [...prev, { sender: 'HONEYPOT_AI', text: stalling, seconds: wasted }]);
        setTotalSecondsWasted((prev) => prev + wasted);
      }
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          sender: 'HONEYPOT_AI',
          text: "Wait just a moment, darling... my reading glasses are in the coat pocket. Can you repeat that very slowly?",
          seconds: 35
        }
      ]);
      setTotalSecondsWasted((prev) => prev + 35);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.85))',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(139, 92, 246, 0.5)'
            }}
          >
            <Flame size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              AI Counter-Honeypot (Scam-Baiter)
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(236, 72, 153, 0.25)',
                  color: '#f472b6',
                  border: '1px solid rgba(236, 72, 153, 0.4)',
                  fontWeight: 700
                }}
              >
                NEW FEATURE
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Autonomous time-wasting counter-dialogue to protect vulnerable citizens
            </div>
          </div>
        </div>

        {/* Telemetry Counter */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
            {totalSecondsWasted}s
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Scammer Time Wasted</div>
        </div>
      </div>

      {/* Persona Selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { id: 'ELDERLY_CONFUSED', label: '👵 Dadi Shanti / Harold' },
          { id: 'SLOW_TYPING_WORKER', label: '💻 Slow Typing Clerk' },
          { id: 'BUREAUCRATIC_OFFICIAL', label: '📋 Compliance Jenkins' }
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPersona(p.id as any)}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.68rem',
              fontWeight: 700,
              background: persona === p.id ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.04)',
              color: persona === p.id ? '#c4b5fd' : 'var(--text-muted)',
              border: '1px solid',
              borderColor: persona === p.id ? 'rgba(139, 92, 246, 0.6)' : 'rgba(255, 255, 255, 0.08)',
              cursor: 'pointer'
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Live Honeypot Dialogue Feed */}
      <div
        style={{
          maxHeight: 180,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'rgba(0, 0, 0, 0.3)',
          padding: 10,
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}
      >
        {turns.map((t, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: t.sender === 'HONEYPOT_AI' ? 'flex-start' : 'flex-end',
              maxWidth: '88%',
              background: t.sender === 'HONEYPOT_AI' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${t.sender === 'HONEYPOT_AI' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`,
              padding: '7px 10px',
              borderRadius: 8,
              fontSize: '0.74rem',
              color: '#f1f5f9',
              lineHeight: 1.35
            }}
          >
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: t.sender === 'HONEYPOT_AI' ? '#a78bfa' : '#f87171', marginBottom: 2 }}>
              {t.sender === 'HONEYPOT_AI' ? '🤖 Honeypot Staller (+'+t.seconds+'s wasted)' : '👤 Scammer'}
            </div>
            {t.text}
          </div>
        ))}
        {isGenerating && (
          <div style={{ fontSize: '0.7rem', color: '#c4b5fd', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={12} /> Fabricating stalling excuse...
          </div>
        )}
      </div>

      {/* Input box to test / feed scammer dialogue */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Test scammer phrase (e.g. 'Give OTP now')..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendScammerLine()}
          style={{
            flex: 1,
            padding: '7px 10px',
            fontSize: '0.76rem',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff'
          }}
        />
        <button
          onClick={handleSendScammerLine}
          disabled={isGenerating || !inputText.trim()}
          style={{
            padding: '7px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-gradient)',
            color: '#fff',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
            opacity: isGenerating || !inputText.trim() ? 0.6 : 1
          }}
        >
          Bait Scammer
        </button>
      </div>
    </div>
  );
};
