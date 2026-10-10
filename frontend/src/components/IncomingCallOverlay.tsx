import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, VolumeX, Sparkles, MessageSquare, Bot, User, CheckCircle, ArrowRight, Mic, Volume2 } from 'lucide-react';
import { IncomingCallPayload, ScreeningResult, DialogueTurn, ScreeningVerdict } from '../types';
import { RiskBadge } from './RiskBadge';
import { CapacitorService } from '../services/capacitorService';

interface IncomingCallOverlayProps {
  incomingCall: IncomingCallPayload;
  screeningResult: ScreeningResult | null;
  isProcessing: boolean;
  onDismiss: () => void;
  onOverrideAction: (action: ScreeningVerdict) => void;
}

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  incomingCall,
  screeningResult,
  isProcessing,
  onDismiss,
  onOverrideAction
}) => {
  const defaultGreeting = "Hi, I'm screening calls for the recipient. Please state your name and the reason for your call.";

  const [dialogue, setDialogue] = useState<DialogueTurn[]>([
    {
      sender: 'AI_ASSISTANT',
      text: defaultGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  ]);

  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(true);
  const [callerStreamText, setCallerStreamText] = useState<string>('');
  const [isCallerSpeaking, setIsCallerSpeaking] = useState<boolean>(false);

  useEffect(() => {
    CapacitorService.triggerHapticFeedback();

    // 1. Simulate AI Agent speaking initial greeting (1.2s)
    const aiTimer = setTimeout(() => {
      setIsAiSpeaking(false);
      setIsCallerSpeaking(true);

      // 2. Stream caller's live response text
      const fullText = incomingCall.simulatedAudioTranscript || "Hello? I am calling regarding your recent inquiry.";
      let charIdx = 0;

      const streamInterval = setInterval(() => {
        if (charIdx < fullText.length) {
          charIdx += 4;
          setCallerStreamText(fullText.substring(0, charIdx));
        } else {
          clearInterval(streamInterval);
          setIsCallerSpeaking(false);
          setDialogue((prev) => [
            ...prev,
            {
              sender: 'CALLER',
              text: fullText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
          ]);
        }
      }, 40);

      return () => clearInterval(streamInterval);
    }, 1200);

    return () => clearTimeout(aiTimer);
  }, [incomingCall]);

  const handleSmartReply = (promptText: string, callerReplyText: string) => {
    CapacitorService.triggerHapticFeedback();
    setIsAiSpeaking(true);

    // Add AI message to conversation
    setDialogue((prev) => [
      ...prev,
      {
        sender: 'AI_ASSISTANT',
        text: promptText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);

    setTimeout(() => {
      setIsAiSpeaking(false);
      setIsCallerSpeaking(true);
      setCallerStreamText('');

      let charIdx = 0;
      const interval = setInterval(() => {
        if (charIdx < callerReplyText.length) {
          charIdx += 4;
          setCallerStreamText(callerReplyText.substring(0, charIdx));
        } else {
          clearInterval(interval);
          setIsCallerSpeaking(false);
          setDialogue((prev) => [
            ...prev,
            {
              sender: 'CALLER',
              text: callerReplyText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
          ]);
        }
      }, 35);
    }, 1000);
  };

  const getSmartChips = () => {
    const text = (incomingCall.simulatedAudioTranscript || '').toLowerCase();
    if (text.includes('irs') || text.includes('warrant') || text.includes('tax') || text.includes('warranty')) {
      return [
        { label: 'Ask for badge ID', prompt: 'Could you please provide your official department badge ID and case number?', reply: 'Uh... you must pay immediately or local police will arrive at your home.' },
        { label: 'Mark as Spam & Hang up', prompt: 'This call has been identified as unauthorized telemarketing. Disconnecting now.', reply: 'Wait— [Call Ended]' },
        { label: 'Ask for callback number', prompt: 'What is your official callback phone number so we can verify with the department?', reply: 'You cannot call back, you must resolve this on this line right now.' }
      ];
    } else if (text.includes('delivery') || text.includes('package') || text.includes('amazon') || text.includes('courier')) {
      return [
        { label: 'Ask to leave at front door', prompt: 'Can you please leave the parcel at the front door or porch?', reply: 'Sure thing, leaving the package right next to the front mat now. Have a good day!' },
        { label: 'Give gate access code', prompt: 'The gate code is #4821. Please proceed to building B.', reply: 'Got it! Heading in now. Thanks!' },
        { label: 'Ask for company name', prompt: 'Which delivery service and recipient name is on the parcel?', reply: 'Amazon Logistics parcel for Yogi.' }
      ];
    } else {
      return [
        { label: 'Ask for more details', prompt: 'Could you give me a few more details on what this is regarding?', reply: 'Yes, I am following up on the appointment schedule.' },
        { label: 'Ask if it is urgent', prompt: 'Is this an urgent matter, or can I have them call you back?', reply: 'Not super urgent, but please let them know to call back before 5 PM.' },
        { label: 'Take a message', prompt: 'The recipient is unavailable right now. May I take a brief message?', reply: 'Please ask them to check their email regarding the confirmation.' }
      ];
    }
  };

  return (
    <div className="call-overlay-backdrop" style={{ background: 'rgba(8, 12, 20, 0.96)', padding: '24px 18px 20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="status-dot" style={{ backgroundColor: isProcessing ? 'var(--color-warning)' : 'var(--color-safe)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-glow)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bot size={15} /> AI Call Screener Active
          </span>
        </div>
        <button
          onClick={onDismiss}
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          Close
        </button>
      </div>

      {/* Caller Header Card */}
      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{incomingCall.callerName || 'Unknown Caller'}</h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', color: 'var(--accent-glow)', fontWeight: 600 }}>
          {incomingCall.phoneNumber}
        </div>
        {incomingCall.location && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            📍 {incomingCall.location} {incomingCall.carrier ? `• ${incomingCall.carrier}` : ''}
          </div>
        )}
      </div>

      {/* Live Intent & Risk Analysis Banner */}
      {screeningResult && (
        <div
          className="glass-card"
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(21, 30, 49, 0.9)',
            border: '1px solid var(--border-medium)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Live AI Assessment
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', marginTop: 1 }}>
              {screeningResult.category.replace('_', ' ')}
            </div>
          </div>
          <RiskBadge level={screeningResult.riskLevel} verdict={screeningResult.verdict} score={screeningResult.riskScore} />
        </div>
      )}

      {/* Live Conversation Transcript Feed */}
      <div
        className="glass-card"
        style={{
          flex: 1,
          maxHeight: 280,
          overflowY: 'auto',
          background: 'rgba(12, 17, 29, 0.95)',
          border: '1px solid var(--border-medium)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={13} /> Live Conversation Transcript
          </span>
          {(isAiSpeaking || isCallerSpeaking) && (
            <div className="audio-wave-container" style={{ height: 20 }}>
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
            </div>
          )}
        </div>

        {/* Dialogue Bubbles */}
        {dialogue.map((turn, idx) => {
          const isAi = turn.sender === 'AI_ASSISTANT';
          return (
            <div
              key={idx}
              style={{
                alignSelf: isAi ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                background: isAi ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${isAi ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.12)'}`,
                padding: '8px 12px',
                borderRadius: isAi ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                fontSize: '0.8rem',
                lineHeight: 1.4
              }}
            >
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isAi ? 'var(--accent-glow)' : 'var(--text-secondary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                {isAi ? <Bot size={11} /> : <User size={11} />}
                <span>{isAi ? 'AegisCall AI Screener' : 'Caller'}</span>
              </div>
              <div style={{ color: '#fff' }}>"{turn.text}"</div>
            </div>
          );
        })}

        {/* Live Streaming Spoken Words */}
        {isCallerSpeaking && callerStreamText && (
          <div
            style={{
              alignSelf: 'flex-end',
              maxWidth: '85%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '8px 12px',
              borderRadius: '14px 14px 2px 14px',
              fontSize: '0.8rem',
              lineHeight: 1.4,
              borderLeft: '3px solid var(--accent-glow)'
            }}
          >
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <User size={11} />
              <span>Caller Speaking...</span>
            </div>
            <div style={{ color: '#fff' }}>"{callerStreamText}" <span className="status-dot" style={{ display: 'inline-block', width: 6, height: 6 }} /></div>
          </div>
        )}
      </div>

      {/* Smart Quick Reply Chips */}
      <div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={12} color="var(--accent-glow)" /> Ask Caller (Smart Reply):
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {getSmartChips().map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSmartReply(chip.prompt, chip.reply)}
              className="btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '0.72rem',
                whiteSpace: 'nowrap',
                background: 'rgba(99, 102, 241, 0.12)',
                borderColor: 'var(--border-glow)'
              }}
            >
              💬 {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Call Decision Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        <button
          onClick={() => onOverrideAction('REJECT')}
          className="btn-danger"
          style={{ justifyContent: 'center', padding: '14px', gap: 6, fontWeight: 700 }}
        >
          <PhoneOff size={18} />
          <span>Decline / End</span>
        </button>

        <button
          onClick={() => onOverrideAction('ALLOW')}
          style={{
            background: 'var(--color-safe-bg)',
            border: '1px solid var(--color-safe-border)',
            color: 'var(--color-safe)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '14px',
            fontWeight: 700,
            fontSize: '0.9rem'
          }}
        >
          <Phone size={18} />
          <span>Answer Call</span>
        </button>
      </div>
    </div>
  );
};
