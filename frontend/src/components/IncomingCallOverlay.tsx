import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Volume2, VolumeX, Mic, MicOff,
  Sparkles, MessageSquare, Bot, User, Pause, Play,
  Send, PhoneCall, Radio, Grid, ChevronDown, Check,
  AlertCircle
} from 'lucide-react';
import { IncomingCallPayload, ScreeningResult, DialogueTurn, ScreeningVerdict } from '../types';
import { RiskBadge } from './RiskBadge';
import { CapacitorService } from '../services/capacitorService';
import { ApiService } from '../services/api';

interface IncomingCallOverlayProps {
  incomingCall: IncomingCallPayload;
  screeningResult: ScreeningResult | null;
  isProcessing: boolean;
  onDismiss: () => void;
  onOverrideAction: (action: ScreeningVerdict) => void;
}

const DTMF_KEYS = [
  ['1', ''],     ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'],  ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''],     ['0', '+'],   ['#', '']
];

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  incomingCall,
  screeningResult,
  isProcessing,
  onDismiss,
  onOverrideAction
}) => {
  const savedLang = (localStorage.getItem('aegis_screener_language') || 'AUTO') as 'AUTO' | 'EN' | 'HI' | 'HINGLISH';

  // Always start in RINGING unless explicitly initiated as an outgoing call
  const [callPhase, setCallPhase] = useState<'RINGING' | 'SCREENING' | 'CONNECTED'>(
    incomingCall.isOutgoing ? 'CONNECTED' : 'RINGING'
  );

  // In-call active controls state
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(false);
  const [isOnHold, setIsOnHold] = useState<boolean>(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [dialedDtmf, setDialedDtmf] = useState<string>('');
  const [callDuration, setCallDuration] = useState<number>(0);

  // Screening dialogue state
  const [listenIn, setListenIn] = useState<boolean>(false);
  const [dialogue, setDialogue] = useState<DialogueTurn[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [dynamicChips, setDynamicChips] = useState<string[]>([]);
  const [liveAssessment, setLiveAssessment] = useState<{ category: string; riskScore: number; verdict: ScreeningVerdict } | null>(null);
  const [callerStreamText, setCallerStreamText] = useState<string>('');
  const [isCallerSpeaking, setIsCallerSpeaking] = useState<boolean>(false);
  const [callEndedNotice, setCallEndedNotice] = useState<string | null>(null);
  const [customReplyInput, setCustomReplyInput] = useState<string>('');

  const dialogueEndRef = useRef<HTMLDivElement>(null);

  // Language detection
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

  // Call timer when connected
  useEffect(() => {
    let timer: any = null;
    if (callPhase === 'CONNECTED') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callPhase]);

  // Scroll transcript to bottom
  useEffect(() => {
    if (dialogueEndRef.current) {
      dialogueEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dialogue, callerStreamText]);

  // Native telephony listeners
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
        handleProcessCallerUtterance(data.text);
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
      setTimeout(() => setIsAiSpeaking(false), 2400);
    });

    const unlistenEnded = CapacitorService.addCallEndedListener(() => {
      setCallEndedNotice('Call Disconnected');
      setTimeout(() => onDismiss(), 1200);
    });

    const unlistenPickedUp = CapacitorService.addCallPickedUpListener(() => {
      setCallPhase('CONNECTED');
    });

    const unlistenAudio = CapacitorService.addCallAudioStateListener((data) => {
      setIsMuted(data.muted);
      setIsSpeakerOn(data.speakerOn);
    });

    return () => {
      if (unlistenTranscript) unlistenTranscript();
      if (unlistenAiSpeech) unlistenAiSpeech();
      if (unlistenEnded) unlistenEnded();
      if (unlistenPickedUp) unlistenPickedUp();
      if (unlistenAudio) unlistenAudio();
    };
  }, [onDismiss]);

  // Format call duration MM:SS
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Actions
  const handleStartAiScreening = async () => {
    CapacitorService.triggerHapticFeedback();
    setCallPhase('SCREENING');

    const firstTurn: DialogueTurn = {
      sender: 'AI_ASSISTANT',
      text: defaultGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setDialogue([firstTurn]);
    setIsAiSpeaking(true);

    // Native telephony engine transmits directly to caller on call line; only use webview audio if user enabled local listen-in
    if (listenIn && !CapacitorService.isNative()) {
      const ttsLang = activeLang === 'HI' ? 'hi-IN' : activeLang === 'HINGLISH' ? 'hi-IN' : 'en-US';
      CapacitorService.speakOutLoud(defaultGreeting, ttsLang);
    }
    await CapacitorService.screenCallWithAi(activeLang.toLowerCase());

    // If simulating or caller has simulated transcript, start stream after greeting
    if (incomingCall.simulatedAudioTranscript) {
      setTimeout(() => {
        setIsAiSpeaking(false);
        setIsCallerSpeaking(true);
        const fullText = incomingCall.simulatedAudioTranscript!;
        let charIdx = 0;
        const interval = setInterval(() => {
          if (charIdx < fullText.length) {
            charIdx += 4;
            setCallerStreamText(fullText.substring(0, charIdx));
          } else {
            clearInterval(interval);
            setIsCallerSpeaking(false);
            setDialogue((prev) => [
              ...prev,
              {
                sender: 'CALLER',
                text: fullText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }
            ]);
            setCallerStreamText('');
            handleProcessCallerUtterance(fullText);
          }
        }, 40);
      }, 1600);
    } else {
      setTimeout(() => setIsAiSpeaking(false), 2400);
    }
  };

  const handleAnswerDirectly = async () => {
    CapacitorService.triggerHapticFeedback();
    setCallPhase('CONNECTED');
    await CapacitorService.answerCall();
  };

  const handleDeclineCall = async () => {
    CapacitorService.triggerHapticFeedback();
    await CapacitorService.rejectCall();
    onOverrideAction('REJECT');
    setCallEndedNotice('Call Declined');
    setTimeout(() => onDismiss(), 600);
  };

  const handlePickupTakeover = async () => {
    CapacitorService.triggerHapticFeedback();
    setCallPhase('CONNECTED');
    await CapacitorService.pickupCall();
  };

  const handleHangUp = async () => {
    CapacitorService.triggerHapticFeedback();
    await CapacitorService.rejectCall();
    setCallEndedNotice(`Call Ended • ${formatTimer(callDuration)}`);
    setTimeout(() => onDismiss(), 800);
  };

  // In-Call phone controls
  const handleToggleMute = async () => {
    CapacitorService.triggerHapticFeedback();
    const next = !isMuted;
    setIsMuted(next);
    await CapacitorService.setMuted(next);
  };

  const handleToggleSpeaker = async () => {
    CapacitorService.triggerHapticFeedback();
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    await CapacitorService.setSpeakerphone(next);
  };

  const handleToggleHold = async () => {
    CapacitorService.triggerHapticFeedback();
    const next = !isOnHold;
    setIsOnHold(next);
    await CapacitorService.holdCall(next);
  };

  const handleDtmfPress = async (digit: string) => {
    CapacitorService.triggerHapticFeedback();
    setDialedDtmf((prev) => prev + digit);
    await CapacitorService.playDtmfTone(digit);
  };

  // Real-time ChatGPT-style conversational turn generator (Gemini Flash / Local AI)
  const handleProcessCallerUtterance = async (callerText: string) => {
    if (!callerText.trim()) return;
    try {
      setIsAiThinking(true);
      const turn = await ApiService.generateChatTurn({
        phoneNumber: incomingCall.phoneNumber,
        callerName: incomingCall.callerName,
        callerUtterance: callerText,
        dialogueHistory: dialogue,
        language: activeLang
      });

      setLiveAssessment({
        category: turn.intentCategory,
        riskScore: turn.riskScore,
        verdict: turn.recommendedVerdict
      });

      if (turn.suggestedSmartReplies && turn.suggestedSmartReplies.length > 0) {
        setDynamicChips(turn.suggestedSmartReplies);
      }

      // Natural brief human pause (300ms) before AI speaks the response to caller
      setTimeout(() => {
        setIsAiThinking(false);
        handleAiSpeakUtterance(turn.aiSpeech);
      }, 350);
    } catch {
      setIsAiThinking(false);
    }
  };

  // AI smart speech trigger
  const handleAiSpeakUtterance = async (aiSpeech: string, callerResponseFallback?: string) => {
    CapacitorService.triggerHapticFeedback();
    setIsAiSpeaking(true);

    setDialogue((prev) => [
      ...prev,
      {
        sender: 'AI_ASSISTANT',
        text: aiSpeech,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    ]);

    // Native telephony engine speaks directly to caller; only play in webview if listenIn enabled and in browser
    if (listenIn && !CapacitorService.isNative()) {
      const ttsLang = activeLang === 'HI' ? 'hi-IN' : activeLang === 'HINGLISH' ? 'hi-IN' : 'en-US';
      CapacitorService.speakOutLoud(aiSpeech, ttsLang);
    }
    await CapacitorService.sendAiReply(aiSpeech);

    if (callerResponseFallback) {
      setTimeout(() => {
        setIsAiSpeaking(false);
        setIsCallerSpeaking(true);
        let charIdx = 0;
        const interval = setInterval(() => {
          if (charIdx < callerResponseFallback.length) {
            charIdx += 4;
            setCallerStreamText(callerResponseFallback.substring(0, charIdx));
          } else {
            clearInterval(interval);
            setIsCallerSpeaking(false);
            setDialogue((prev) => [
              ...prev,
              {
                sender: 'CALLER',
                text: callerResponseFallback,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              }
            ]);
            setCallerStreamText('');
          }
        }, 35);
      }, 1200);
    } else {
      setTimeout(() => setIsAiSpeaking(false), 2000);
    }
  };

  const handleSendCustomInstruction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customReplyInput.trim()) return;
    const text = customReplyInput.trim();
    setCustomReplyInput('');
    handleAiSpeakUtterance(text, 'Understood, thank you.');
  };

  const getSmartChips = () => {
    const text = (incomingCall.simulatedAudioTranscript || '').toLowerCase();

    const dynamicList = dynamicChips.map((chip) => ({
      label: chip.length > 28 ? chip.substring(0, 26) + '…' : chip,
      prompt: chip,
      reply: undefined
    }));

    let defaultChips: { label: string; prompt: string; reply?: string }[] = [];
    if (activeLang === 'HI') {
      if (text.includes('irs') || text.includes('warrant') || text.includes('tax') || text.includes('bijli') || text.includes('otp') || text.includes('बिजली')) {
        defaultChips = [
          { label: 'आईडी और विभाग पूछें', prompt: 'क्या आप अपनी आधिकारिक आईडी और विभाग की जानकारी दे सकते हैं?', reply: 'हम मुख्यालय से हैं, आपको तुरंत वेरिफाई करना होगा।' },
          { label: 'शाखा में जाने का कहें', prompt: 'हम सीधे आधिकारिक शाखा में जाकर संपर्क करेंगे।', reply: 'शाखा जाने का समय नहीं है, अभी तुरंत करना होगा।' },
          { label: 'संदिग्ध बताकर काटें', prompt: 'यह कॉल संदिग्ध फ्रॉड पाई गई है। डिस्कनेक्ट किया जा रहा है।', reply: 'रुको— [कॉल समाप्त]' }
        ];
      } else {
        defaultChips = [
          { label: 'कॉल का कारण पूछें', prompt: 'क्या आप बता सकते हैं कि यह कॉल किस विषय में है?', reply: 'हाँ, हम आपके अकाउंट और सर्विस के सिलसिले में बात कर रहे हैं।' },
          { label: 'दरवाजे पर रखने कहें', prompt: 'कृपया पार्सल मेन दरवाजे के पास सुरक्षित छोड़ दें।', reply: 'जी ठीक है, मैंने पार्सल दरवाजे पर रख दिया है।' },
          { label: 'बाद में कॉल करें', prompt: 'प्राप्तकर्ता अभी व्यस्त हैं। कृपया थोड़ी देर बाद कॉल करें।', reply: 'कोई बात नहीं, मैं बाद में संपर्क करूँगा।' }
        ];
      }
    } else if (activeLang === 'HINGLISH') {
      defaultChips = [
        { label: 'Koun bol raha hai?', prompt: 'Aap koun bol rahe hain aur kis silsile mein call hai?', reply: 'Main aapke recent application/service ke liye call kar raha hoon.' },
        { label: 'Door pe rakh do', prompt: 'Bhaiya parcel flat ke main door pe chhod dijiye, thank you.', reply: 'Theek hai bhaiya, door pe rakh diya hai.' },
        { label: 'Baad mein call karein', prompt: 'Recipient abhi busy hain, please thodi der baad call karein.', reply: 'Okay sir, main baad mein call karta hoon.' },
        { label: 'Spam bolke disconnect', prompt: 'Ye unauthorized scam call mark hui hai. Disconnecting now.', reply: 'Wait— [Disconnected]' }
      ];
    } else {
      defaultChips = [
        { label: 'Who is calling?', prompt: 'Could you please state your name and company?', reply: 'I am calling from customer service regarding your recent request.' },
        { label: 'What is this regarding?', prompt: 'Could you give me more details on what this call is regarding?', reply: 'Yes, this is an important notification regarding your account.' },
        { label: 'Leave at front door', prompt: 'Please leave the package securely at the front door.', reply: 'Understood, placing it at the front door now.' },
        { label: 'Call back later', prompt: 'The recipient is currently unavailable. Please call back later.', reply: 'Understood, I will call back in an hour.' },
        { label: 'Report spam & hang up', prompt: 'This call is identified as unsolicited spam. Disconnecting now.', reply: 'Wait, don’t hang up—' }
      ];
    }

    return [...dynamicList, ...defaultChips];
  };

  const callerInitials = (incomingCall.callerName || incomingCall.phoneNumber || 'C')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      className="call-overlay-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'linear-gradient(180deg, #070b14 0%, #0d1527 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 20px',
        color: '#fff',
        fontFamily: 'var(--font-main)'
      }}
    >
      {/* ────────────────────────────────────────────────────────────────
          TOP BAR: Status Indicator & Mode Label
         ──────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className="status-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor:
                callPhase === 'CONNECTED' ? 'var(--color-safe)' :
                callPhase === 'SCREENING' ? 'var(--accent-glow)' : 'var(--color-warning)'
            }}
          />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
            {callPhase === 'RINGING' && 'Incoming Call'}
            {callPhase === 'SCREENING' && (
              <>
                <Bot size={15} color="var(--accent-glow)" />
                AI Call Screener Active
              </>
            )}
            {callPhase === 'CONNECTED' && (
              <>
                <PhoneCall size={15} color="var(--color-safe)" />
                {isOnHold ? 'Call On Hold' : 'Call Connected (HD Voice)'}
              </>
            )}
          </span>
        </div>

        {callPhase === 'CONNECTED' && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: isOnHold ? 'var(--color-warning)' : 'var(--color-safe)',
              background: 'rgba(255,255,255,0.06)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)'
            }}
          >
            {formatTimer(callDuration)}
          </div>
        )}

        {callPhase === 'SCREENING' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                CapacitorService.triggerHapticFeedback();
                setListenIn(!listenIn);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: listenIn ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${listenIn ? 'var(--accent-glow)' : 'var(--border-subtle)'}`,
                color: listenIn ? 'var(--accent-glow)' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 600
              }}
              title={listenIn ? 'Local audio monitor active' : 'Silent Screen mode: Only caller hears AI'}
            >
              {listenIn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{listenIn ? 'Listening In' : 'Silent Screen'}</span>
            </button>
            <button
              onClick={onDismiss}
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {callPhase === 'RINGING' && (
          <button
            onClick={onDismiss}
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            Dismiss
          </button>
        )}
      </div>

      {callEndedNotice && (
        <div
          style={{
            margin: '8px 0',
            padding: 12,
            textAlign: 'center',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            fontWeight: 700
          }}
        >
          {callEndedNotice}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          CALLER AVATAR & INFO SECTION
         ──────────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', margin: callPhase === 'CONNECTED' ? '10px 0' : '16px 0 10px', flexShrink: 0 }}>
        <div
          style={{
            width: callPhase === 'CONNECTED' ? 84 : 96,
            height: callPhase === 'CONNECTED' ? 84 : 96,
            borderRadius: '50%',
            background:
              callPhase === 'CONNECTED'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: '2rem',
            fontWeight: 800,
            color: '#fff',
            boxShadow:
              callPhase === 'CONNECTED'
                ? '0 0 30px rgba(16, 185, 129, 0.4)'
                : '0 0 35px rgba(99, 102, 241, 0.5)',
            border: '3px solid rgba(255,255,255,0.15)',
            animation: callPhase === 'RINGING' ? 'pulseGlow 1.4s infinite' : 'none'
          }}
        >
          {callerInitials}
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>
          {incomingCall.callerName || 'Unknown Caller'}
        </h1>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            color: 'var(--accent-glow)',
            fontWeight: 600,
            letterSpacing: '0.04em'
          }}
        >
          {incomingCall.phoneNumber}
        </div>

        {incomingCall.location && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            📍 {incomingCall.location} {incomingCall.carrier ? `• ${incomingCall.carrier}` : ''}
          </div>
        )}

        {callPhase === 'SCREENING' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 14px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontSize: '0.74rem',
                color: 'var(--color-safe)',
                fontWeight: 700
              }}
            >
              <Radio size={13} color="var(--color-safe)" />
              <span>Transmitting AI Voice to Caller on Phone Line</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {listenIn ? 'Local audio monitor active' : 'Your device is silent • Live transcript updating below'} • {activeLang === 'HI' ? 'हिंदी (Hindi)' : activeLang === 'HINGLISH' ? 'Hinglish' : 'English'}
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────
          PHASE 1: RINGING — Asks user: Answer, Decline, or Screen with AI
         ──────────────────────────────────────────────────────────────── */}
      {callPhase === 'RINGING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: 'center' }}>
          {/* Decision Explanation Card */}
          <div
            className="glass-card"
            style={{
              padding: '16px 18px',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--border-glow)'
            }}
          >
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-glow)', marginBottom: 4 }}>
              Choose How to Handle This Call
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
              Pick up now, decline, or let <strong>AegisCall AI</strong> answer on your behalf while you see the live transcript.
            </p>
          </div>

          {/* 3 Clear Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {/* 1. Screen Call with AI (Primary Highlight) */}
            <button
              onClick={handleStartAiScreening}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '1.02rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 0 25px rgba(99, 102, 241, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <Bot size={22} />
              <span>Screen Call with AI</span>
            </button>

            {/* 2. Decline and Answer Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                onClick={handleDeclineCall}
                className="btn-danger"
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}
              >
                <PhoneOff size={20} />
                <span>Decline</span>
              </button>

              <button
                onClick={handleAnswerDirectly}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '16px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Phone size={20} />
                <span>Answer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          PHASE 2: SCREENING — AI talks on your behalf, live transcript
         ──────────────────────────────────────────────────────────────── */}
      {callPhase === 'SCREENING' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 10, minHeight: 0 }}>
          {/* Assessment Banner */}
          {(liveAssessment || screeningResult) && (
            <div
              className="glass-card"
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(21, 30, 49, 0.9)',
                flexShrink: 0
              }}
            >
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Caller Intent
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                  {(liveAssessment?.category || screeningResult?.category || 'Analyzing').replace('_', ' ')}
                </div>
              </div>
              <RiskBadge
                level={liveAssessment ? (liveAssessment.riskScore > 70 ? 'CRITICAL_SPAM' : liveAssessment.riskScore > 40 ? 'SUSPICIOUS' : 'LOW') : screeningResult!.riskLevel}
                verdict={liveAssessment?.verdict || screeningResult!.verdict}
                score={liveAssessment?.riskScore ?? screeningResult!.riskScore}
              />
            </div>
          )}

          {/* Real-time Dialogue Transcript */}
          <div
            className="glass-card"
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'rgba(10, 15, 26, 0.95)',
              border: '1px solid var(--border-medium)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minHeight: 180
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={13} /> Live Conversation Transcript
              </span>
              {(isAiSpeaking || isCallerSpeaking) && (
                <div className="audio-wave-container" style={{ height: 18 }}>
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                </div>
              )}
            </div>

            {dialogue.map((turn, idx) => {
              const isAi = turn.sender === 'AI_ASSISTANT';
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isAi ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    background: isAi ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${isAi ? 'rgba(99, 102, 241, 0.38)' : 'rgba(255, 255, 255, 0.12)'}`,
                    padding: '8px 12px',
                    borderRadius: isAi ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                    fontSize: '0.8rem',
                    lineHeight: 1.4
                  }}
                >
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isAi ? 'var(--accent-glow)' : 'var(--text-secondary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isAi ? <Bot size={11} /> : <User size={11} />}
                    <span>{isAi ? 'AegisCall AI (Speaking for You)' : 'Caller'}</span>
                  </div>
                  <div style={{ color: '#fff' }}>"{turn.text}"</div>
                </div>
              );
            })}

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
                <div style={{ color: '#fff' }}>"{callerStreamText}"</div>
              </div>
            )}

            {isAiThinking && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px dashed rgba(99, 102, 241, 0.4)',
                  padding: '8px 12px',
                  borderRadius: '14px 14px 14px 2px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--accent-glow)'
                }}
              >
                <div className="audio-wave-container" style={{ height: 14 }}>
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                </div>
                <span>✨ AI formulating response...</span>
              </div>
            )}

            <div ref={dialogueEndRef} />
          </div>

          {/* Quick Smart Reply Chips */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} color="var(--accent-glow)" /> Quick Responses (AI speaks to caller):
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {getSmartChips().map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAiSpeakUtterance(chip.prompt, chip.reply)}
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

          {/* Custom Reply Input Form */}
          <form onSubmit={handleSendCustomInstruction} style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Tell caller anything via AI..."
              value={customReplyInput}
              onChange={(e) => setCustomReplyInput(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!customReplyInput.trim()}
              className="btn-primary"
              style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', opacity: customReplyInput.trim() ? 1 : 0.5 }}
            >
              <Send size={15} />
            </button>
          </form>

          {/* Takeover and Hang up buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10, marginTop: 4, flexShrink: 0 }}>
            <button
              onClick={handleHangUp}
              className="btn-danger"
              style={{ justifyContent: 'center', padding: '14px', gap: 6, fontWeight: 700, borderRadius: 'var(--radius-md)' }}
            >
              <PhoneOff size={18} />
              <span>Hang Up</span>
            </button>

            <button
              onClick={handlePickupTakeover}
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
              <span>Answer (Take Over)</span>
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          PHASE 3: CONNECTED — Production Phone In-Call Controls
         ──────────────────────────────────────────────────────────────── */}
      {callPhase === 'CONNECTED' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', padding: '10px 0' }}>
          {/* Status banner */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                borderRadius: 'var(--radius-full)',
                background: isOnHold ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: isOnHold ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: isOnHold ? 'var(--color-warning)' : 'var(--color-safe)'
              }}
            >
              {isOnHold ? <Pause size={14} /> : <PhoneCall size={14} />}
              <span>{isOnHold ? 'CALL ON HOLD' : 'CALL CONNECTED'}</span>
              {isRecording && <span style={{ color: 'var(--color-danger)', marginLeft: 6 }}>● REC</span>}
            </div>
          </div>

          {/* DTMF In-Call Keypad Overlay (if open) */}
          {isKeypadOpen ? (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              {/* Dialed string display */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '0.1em' }}>
                  {dialedDtmf || 'Dial digits…'}
                </span>
                <button
                  onClick={() => setIsKeypadOpen(false)}
                  style={{
                    color: 'var(--accent-glow)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <ChevronDown size={14} /> Hide
                </button>
              </div>

              {/* DTMF Pad Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {DTMF_KEYS.map(([digit, letters]) => (
                  <button
                    key={digit}
                    onClick={() => handleDtmfPress(digit)}
                    style={{
                      padding: '12px 0',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      color: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      userSelect: 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>{digit}</span>
                    {letters && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-muted)' }}>{letters}</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* 6-Button Phone In-Call Controls Grid */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 16,
                padding: '10px 10px 20px',
                maxWidth: 360,
                margin: '0 auto',
                width: '100%'
              }}
            >
              {/* 1. Mute */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={handleToggleMute}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: '50%',
                    background: isMuted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1.5px solid ${isMuted ? 'var(--color-danger)' : 'var(--border-medium)'}`,
                    color: isMuted ? 'var(--color-danger)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                <span style={{ fontSize: '0.72rem', color: isMuted ? 'var(--color-danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </span>
              </div>

              {/* 2. Keypad */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setIsKeypadOpen(true)}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1.5px solid var(--border-medium)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Grid size={24} />
                </button>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Keypad
                </span>
              </div>

              {/* 3. Speaker */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={handleToggleSpeaker}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: '50%',
                    background: isSpeakerOn ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1.5px solid ${isSpeakerOn ? 'var(--accent-glow)' : 'var(--border-medium)'}`,
                    color: isSpeakerOn ? 'var(--accent-glow)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
                </button>
                <span style={{ fontSize: '0.72rem', color: isSpeakerOn ? 'var(--accent-glow)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  Speaker
                </span>
              </div>

              {/* 4. Hold */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={handleToggleHold}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: '50%',
                    background: isOnHold ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1.5px solid ${isOnHold ? 'var(--color-warning)' : 'var(--border-medium)'}`,
                    color: isOnHold ? 'var(--color-warning)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  {isOnHold ? <Play size={24} /> : <Pause size={24} />}
                </button>
                <span style={{ fontSize: '0.72rem', color: isOnHold ? 'var(--color-warning)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  {isOnHold ? 'Resume' : 'Hold'}
                </span>
              </div>

              {/* 5. AI Assistant note/switch back to screen */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setCallPhase('SCREENING')}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1.5px solid rgba(99, 102, 241, 0.35)',
                    color: 'var(--accent-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Switch to AI Call Screener"
                >
                  <Bot size={24} />
                </button>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-glow)', fontWeight: 600 }}>
                  AI Screener
                </span>
              </div>

              {/* 6. Record */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => {
                    CapacitorService.triggerHapticFeedback();
                    setIsRecording(!isRecording);
                  }}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: '50%',
                    background: isRecording ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1.5px solid ${isRecording ? 'var(--color-danger)' : 'var(--border-medium)'}`,
                    color: isRecording ? 'var(--color-danger)' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <Radio size={24} />
                </button>
                <span style={{ fontSize: '0.72rem', color: isRecording ? 'var(--color-danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  {isRecording ? 'Recording' : 'Record'}
                </span>
              </div>
            </div>
          )}

          {/* End Call Button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <button
              onClick={handleHangUp}
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(239, 68, 68, 0.55)',
                cursor: 'pointer'
              }}
            >
              <PhoneOff size={32} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
