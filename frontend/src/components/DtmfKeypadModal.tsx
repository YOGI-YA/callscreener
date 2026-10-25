import React, { useState } from 'react';

export interface DtmfKeypadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendTone: (digit: string) => void;
}

const DTMF_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#']
];

const DTMF_AUDIO_FREQS: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
};

export const DtmfKeypadModal: React.FC<DtmfKeypadModalProps> = ({
  isOpen,
  onClose,
  onSendTone
}) => {
  const [sentSequence, setSentSequence] = useState<string>('');

  if (!isOpen) return null;

  const playLocalFeedbackTone = (digit: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const freqs = DTMF_AUDIO_FREQS[digit];
      if (!freqs) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = freqs[0];
      osc2.frequency.value = freqs[1];

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext unavailable in test/headless environment
    }
  };

  const handleKeyPress = (digit: string) => {
    playLocalFeedbackTone(digit);
    setSentSequence(prev => prev + digit);
    onSendTone(digit);
  };

  return (
    <div
      className="dtmf-keypad-modal-overlay"
      data-testid="dtmf-keypad-modal"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          color: '#f8fafc',
          textAlign: 'center'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Telecom DTMF Uplink</h3>
          <button
            onClick={onClose}
            data-testid="close-dtmf-modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Display sequence */}
        <div
          data-testid="dtmf-sequence-display"
          style={{
            height: '42px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            letterSpacing: '0.2em',
            fontFamily: 'monospace',
            color: '#38bdf8',
            marginBottom: '16px'
          }}
        >
          {sentSequence || 'Dial tones...'}
        </div>

        {/* Keypad Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {DTMF_KEYS.flat().map((key) => (
            <button
              key={key}
              data-testid={`dtmf-key-${key}`}
              onClick={() => handleKeyPress(key)}
              style={{
                height: '52px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(30, 41, 59, 0.8)',
                color: '#f8fafc',
                fontSize: '1.3rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Quick presets for automated IVR menus */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            onClick={() => handleKeyPress('1')}
            style={{
              flex: 1,
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#93c5fd',
              padding: '6px 4px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            Press 1 (Agent)
          </button>
          <button
            onClick={() => handleKeyPress('9')}
            style={{
              flex: 1,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '6px 4px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            Press 9 (Opt-Out)
          </button>
          <button
            onClick={() => handleKeyPress('#')}
            style={{
              flex: 1,
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#6ee7b7',
              padding: '6px 4px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            Press # (Confirm)
          </button>
        </div>
      </div>
    </div>
  );
};
