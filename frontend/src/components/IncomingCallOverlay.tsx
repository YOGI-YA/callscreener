import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, VolumeX, Sparkles, MessageSquare, Bot, User, CheckCircle, ArrowRight, Mic, Volume2, ShieldAlert, PhoneCall } from 'lucide-react';
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
  const savedLang = (localStorage.getItem('aegis_screener_language') || 'AUTO') as 'AUTO' | 'EN' | 'HI' | 'HINGLISH';

  // State machine for call phase: RINGING -> SCREENING -> CONNECTED
  // If simulatedAudioTranscript is present and user launched from simulator, start directly in SCREENING mode
  const isSimulation = Boolean(incomingCall.simulatedAudioTranscript);
  const [callPhase, setCallPhase] = useState<'RINGING' | 'SCREENING' | 'CONNECTED'>(
    isSimulation ? 'SCREENING' : 'RINGING'
  );

  const [dialogue, setDialogue] = useState<DialogueTurn[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [callerStreamText, setCallerStreamText] = useState<string>('');
  const [isCallerSpeaking, setIsCallerSpeaking] = useState<boolean>(false);
  const [callEndedNotice, setCallEndedNotice] = useState<string | null>(null);

  // Helper to detect caller's spoken language
  const detectLanguage = (text: string): 'HI' | 'HINGLISH' | 'EN' => {
    if (!text) return 'EN';
    if (/[\u0900-\u097F]/.test(text)) return 'HI';
    const lower = text.toLowerCase();
    const hinglishKeywords = [
      'aapka', 'aapke', 'karein', 'karna', 'karo', 'hai', 'hain', 'bhaiya', 'hoon', 'kripya',
      'raha', 'rahi', 'rahe', 'pe', 'mein', 'nahi', 'hua', 'turant', 'namaste', 'bijli',
      'batao', 'batayein', 'dein', 'leke', 'khada', 'dijiye', 'gayi', 'hoga', 'band'
    ];
    for (const word of hinglishKeywords) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) return 'HINGLISH';
    }
    return 'EN';
  };

  const detectedCallerLang = detectLanguage(incomingCall.simulatedAudioTranscript || '');
  const activeLang = savedLang === 'AUTO' ? detectedCallerLang : savedLang;

  const defaultGreeting =
    activeLang === 'HI'
      ? 'नमस्ते, मैं प्राप्तकर्ता के लिए कॉल स्क्रीन कर रहा हूँ। कृपया अपना नाम और कॉल करने का कारण बताएं।'
      : activeLang === 'HINGLISH'
      ? 'Namaste! Main recipient ke liye call screen kar raha hoon. Please apna naam aur call reason batayein.'
      : "Hi, I'm screening calls for the recipient. Please state your name and the reason for your call.";

  // Wire native telephony listeners
  useEffect(() => {
    CapacitorService.triggerHapticFeedback();

    const unlistenTranscript = CapacitorService.addLiveTranscriptListener((data) => {
      setIsCallerSpeaking(true);
      setCallerStreamText(data.text);
      if (data.isFinal) {
        setIsCallerSpeaking(false);
        setDialogue((prev) => [
          ...prev,
          {
            sender: 'CALLER',
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }
        ]);
        setCallerStreamText('');
      }
    });

    const unlistenAiSpeech = CapacitorService.addAiSpeechListener((data) => {
      setIsAiSpeaking(true);
      setDialogue((prev) => [
        ...prev,
        {
          sender: 'AI_ASSISTANT',
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      ]);
      setTimeout(() => setIsAiSpeaking(false), 2200);
    });

    const unlistenEnded = CapacitorService.addCallEndedListener(() => {
      setCallEndedNotice('Call Disconnected');
      setTimeout(() => onDismiss(), 1400);
    });

    const unlistenPickedUp = CapacitorService.addCallPickedUpListener(() => {
      setCallPhase('CONNECTED');
    });

    return () => {
      if (unlistenTranscript) unlistenTranscript();
      if (unlistenAiSpeech) unlistenAiSpeech();
      if (unlistenEnded) unlistenEnded();
      if (unlistenPickedUp) unlistenPickedUp();
    };
  }, [onDismiss]);

  // Handle simulation flow if simulated audio exists
  useEffect(() => {
    if (callPhase !== 'SCREENING' || !isSimulation) return;

    setDialogue([
      {
        sender: 'AI_ASSISTANT',
        text: defaultGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);
    setIsAiSpeaking(true);

    const aiTimer = setTimeout(() => {
      setIsAiSpeaking(false);
      setIsCallerSpeaking(true);

      const fullText = incomingCall.simulatedAudioTranscript || 'Hello? I am calling regarding your recent request.';
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
  }, [callPhase, isSimulation, incomingCall.simulatedAudioTranscript, defaultGreeting]);

  // Actions
  const handleStartAiScreening = async () => {
    CapacitorService.triggerHapticFeedback();
    setCallPhase('SCREENING');
    setDialogue([
      {
        sender: 'AI_ASSISTANT',
        text: defaultGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);
    setIsAiSpeaking(true);
    await CapacitorService.screenCallWithAi(activeLang.toLowerCase());
  };

  const handlePickupCall = async () => {
    CapacitorService.triggerHapticFeedback();
    setCallPhase('CONNECTED');
    await CapacitorService.pickupCall();
  };

  const handleDeclineCall = async () => {
    CapacitorService.triggerHapticFeedback();
    await CapacitorService.rejectCall();
    onOverrideAction('REJECT');
    onDismiss();
  };

  const handleAnswerDirectly = async () => {
    CapacitorService.triggerHapticFeedback();
    await CapacitorService.answerCall();
    setCallPhase('CONNECTED');
  };

  const handleSmartReply = async (promptText: string, callerReplyFallback: string) => {
    CapacitorService.triggerHapticFeedback();
    setIsAiSpeaking(true);

    setDialogue((prev) => [
      ...prev,
      {
        sender: 'AI_ASSISTANT',
        text: promptText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);

    // Send to native TTS on phone
    await CapacitorService.sendAiReply(promptText);

    // If simulating in browser, stream fallback
    if (isSimulation) {
      setTimeout(() => {
        setIsAiSpeaking(false);
        setIsCallerSpeaking(true);
        setCallerStreamText('');

        let charIdx = 0;
        const interval = setInterval(() => {
          if (charIdx < callerReplyFallback.length) {
            charIdx += 4;
            setCallerStreamText(callerReplyFallback.substring(0, charIdx));
          } else {
            clearInterval(interval);
            setIsCallerSpeaking(false);
            setDialogue((prev) => [
              ...prev,
              {
                sender: 'CALLER',
                text: callerReplyFallback,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }
            ]);
          }
        }, 35);
      }, 1000);
    }
  };

  const getSmartChips = () => {
    const text = (incomingCall.simulatedAudioTranscript || '').toLowerCase();

    if (activeLang === 'HI') {
      if (text.includes('irs') || text.includes('warrant') || text.includes('tax') || text.includes('bijli') || text.includes('otp') || text.includes('kyc') || text.includes('बिजली') || text.includes('ओटीपी')) {
        return [
          { label: 'आईडी और विभाग पूछें', prompt: 'क्या आप अपनी आधिकारिक आईडी और विभाग की जानकारी दे सकते हैं?', reply: 'आपको अभी पेमेंट करना होगा वरना तुरंत बिजली काट दी जाएगी।' },
          { label: 'फ्रॉड मार्क करके काटें', prompt: 'यह कॉल संदिग्ध फ्रॉड पाई गई है। डिस्कनेक्ट किया जा रहा है।', reply: 'रुको— [कॉल समाप्त]' },
          { label: 'शाखा में मिलने को कहें', prompt: 'हम सीधे आधिकारिक शाखा में जाकर संपर्क करेंगे।', reply: 'शाखा में जाने का समय नहीं है, अभी तुरंत करना होगा।' }
        ];
      } else if (text.includes('delivery') || text.includes('package') || text.includes('zomato') || text.includes('swiggy') || text.includes('gate') || text.includes('पार्सल')) {
        return [
          { label: 'दरवाजे पर छोड़ दें', prompt: 'क्या आप पार्सल मुख्य दरवाजे के पास छोड़ सकते हैं?', reply: 'हाँजी, मैंने पार्सल मुख्य दरवाजे पर रख दिया है।' },
          { label: 'गेट गार्ड को देने कहें', prompt: 'कृपया पार्सल सोसाइटी के मेन गेट सुरक्षा गार्ड के पास जमा करा दें।', reply: 'ठीक है, मैंने गार्ड रूम में एंट्री करवा दी है।' },
          { label: 'किसका पार्सal है पूछें', prompt: 'पार्सल पर किसका नाम और कौन सा ऑर्डर लिखा है?', reply: 'यह योगी जी के नाम पर खाने का ऑर्डर है।' }
        ];
      } else {
        return [
          { label: 'विस्तार से बताएं', prompt: 'क्या आप बता सकते हैं कि यह कॉल किस विषय में है?', reply: 'हाँ, हम आपके अपॉइंटमेंट के सिलसिले में बात कर रहे हैं।' },
          { label: 'क्या जरूरी है पूछें', prompt: 'क्या यह बहुत जरूरी है या बाद में कॉल करेंगे?', reply: 'ज्यादा जरूरी नहीं है, आप शाम 5 बजे से पहले कॉल बैक कर लें।' },
          { label: 'मैसेज नोट करें', prompt: 'प्राप्तकर्ता अभी व्यस्त हैं। क्या आप कोई संदेश छोड़ना चाहेंगे?', reply: 'कृपया उन्हें ईमेल चेक करने के लिए बोल दीजिएगा।' }
        ];
      }
    } else if (activeLang === 'HINGLISH') {
      return [
        { label: 'Koun bol raha hai?', prompt: 'Aap koun bol rahe hain aur kiske regarding call hai?', reply: 'Main aapke recent service request ke liye call kar raha hoon.' },
        { label: 'Door pe chhod do', prompt: 'Bhaiya parcel flat ke main door ke paas chhod dijiye.', reply: 'Theek hai bhaiya, door pe rakh diya hai. Thank you!' },
        { label: 'Baad mein call karein', prompt: 'Recipient abhi busy hain. Please thodi der baad call karein.', reply: 'Okay sir, main 1 ghante baad try karta hoon.' },
        { label: 'Spam bolke disconnect', prompt: 'Ye call unauthorized scam mark hui hai. Disconnecting now.', reply: 'Wait— [Call Ended]' }
      ];
    } else {
      return [
        { label: 'Who is calling?', prompt: 'Could you please state your name and company?', reply: 'Hi, I am calling from Customer Support regarding your delivery.' },
        { label: 'What is this regarding?', prompt: 'Could you give me a few more details on what this call is regarding?', reply: 'Yes, this is a follow-up confirmation call.' },
        { label: 'Leave at the front door', prompt: 'Please leave the package at the front door.', reply: 'Understood, placing it safely at the porch now.' },
        { label: 'Call back later', prompt: 'The recipient is unavailable right now. Please call back later.', reply: 'No problem, I will call back this afternoon.' },
        { label: 'Report spam & hang up', prompt: 'This call is identified as unsolicited spam. Disconnecting now.', reply: 'Wait, don’t hang up—' }
      ];
    }
  };

  return (
    <div className="call-overlay-backdrop" style={{ background: 'rgba(8, 12, 20, 0.98)', padding: '24px 18px 20px', zIndex: 9999 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className="status-dot"
            style={{
              backgroundColor: callPhase === 'CONNECTED' ? 'var(--color-safe)' : callPhase === 'SCREENING' ? 'var(--accent-glow)' : 'var(--color-warning)'
            }}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            {callPhase === 'RINGING' && '📞 Incoming Call'}
            {callPhase === 'SCREENING' && <><Bot size={15} color="var(--accent-glow)" /> Pixel-Grade AI Screener Active</>}
            {callPhase === 'CONNECTED' && <><PhoneCall size={15} color="var(--color-safe)" /> Call Connected (You are Speaking)</>}
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
          Dismiss
        </button>
      </div>

      {/* Caller Header Card */}
      <div style={{ textAlign: 'center', margin: '14px 0 10px' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: callPhase === 'CONNECTED' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            boxShadow: '0 0 25px rgba(99, 102, 241, 0.45)',
            animation: callPhase === 'RINGING' ? 'pulseGlow 1.5s infinite' : 'none'
          }}
        >
          {callPhase === 'CONNECTED' ? <PhoneCall size={34} color="#fff" /> : <User size={34} color="#fff" />}
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{incomingCall.callerName || 'Unknown Caller'}</h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.98rem', color: 'var(--accent-glow)', fontWeight: 600 }}>
          {incomingCall.phoneNumber}
        </div>
        {incomingCall.location && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            📍 {incomingCall.location} {incomingCall.carrier ? `• ${incomingCall.carrier}` : ''}
          </div>
        )}
        {callPhase === 'SCREENING' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.7rem', color: '#a5b4fc', fontWeight: 600 }}>
            <span>🌐 Speaking in: {activeLang === 'HI' ? 'हिंदी (Hindi)' : activeLang === 'HINGLISH' ? 'Hinglish (Hindi + English)' : 'English'}</span>
          </div>
        )}
      </div>

      {callEndedNotice && (
        <div style={{ textAlign: 'center', padding: 12, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontWeight: 700, margin: '8px 0' }}>
          🛑 {callEndedNotice}
        </div>
      )}

      {/* PHASE 1: INITIAL RINGING VIEW (Truecaller / Pixel Style) */}
      {callPhase === 'RINGING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: 16, textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid var(--border-glow)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-glow)', marginBottom: 4 }}>
              AI Smart Call Screener Ready
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
              Let AegisCall AI answer this phone call on your behalf. You can watch the real-time transcript on this screen and pick up at any time.
            </p>
          </div>

          {/* 3 Main Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {/* 1. Screen with AI button */}
            <button
              onClick={handleStartAiScreening}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '1rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 0 25px rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10
              }}
            >
              <Bot size={22} />
              <span>Screen Call with AI</span>
            </button>

            {/* 2. Direct Answer and Decline Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={handleDeclineCall}
                className="btn-danger"
                style={{ justifyContent: 'center', padding: '14px', gap: 8, fontWeight: 700 }}
              >
                <PhoneOff size={18} />
                <span>Decline</span>
              </button>

              <button
                onClick={handleAnswerDirectly}
                style={{
                  background: 'var(--color-safe-bg)',
                  border: '1px solid var(--color-safe-border)',
                  color: 'var(--color-safe)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '14px',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              >
                <Phone size={18} />
                <span>Answer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: AI SCREENING IN PROGRESS (Live Transcript & Smart Replies) */}
      {callPhase === 'SCREENING' && (
        <>
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
                border: '1px solid var(--border-medium)',
                marginBottom: 8
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
              maxHeight: 250,
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
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} color="var(--accent-glow)" /> Ask Caller (AI Smart Reply):
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

          {/* Primary Takeover & Hangup Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10, marginTop: 8 }}>
            <button
              onClick={handleDeclineCall}
              className="btn-danger"
              style={{ justifyContent: 'center', padding: '14px', gap: 6, fontWeight: 700 }}
            >
              <PhoneOff size={18} />
              <span>Hang Up</span>
            </button>

            <button
              onClick={handlePickupCall}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px',
                fontWeight: 800,
                fontSize: '0.95rem',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
              }}
            >
              <PhoneCall size={20} />
              <span>Pick Up Call (Takeover)</span>
            </button>
          </div>
        </>
      )}

      {/* PHASE 3: USER PICKED UP / CALL CONNECTED */}
      {callPhase === 'CONNECTED' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: 24, textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-safe)', marginBottom: 6 }}>
              Call Connected to You
            </div>
            <p style={{ fontSize: '0.85rem', color: '#fff', lineHeight: 1.4, margin: 0 }}>
              AI has stepped aside. Your phone's microphone and earpiece are now connected directly to the caller.
            </p>
          </div>

          <button
            onClick={handleDeclineCall}
            className="btn-danger"
            style={{ width: '100%', justifyContent: 'center', padding: '16px', gap: 8, fontWeight: 800, fontSize: '1rem' }}
          >
            <PhoneOff size={20} />
            <span>End Call</span>
          </button>
        </div>
      )}
    </div>
  );
};
