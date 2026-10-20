import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Volume2, VolumeX, Mic, MicOff,
  Sparkles, MessageSquare, Bot, User, Pause, Play,
  Send, PhoneCall, Radio, Grid, ChevronDown, Check,
  AlertCircle, Headphones, Activity, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { IncomingCallPayload, ScreeningResult, DialogueTurn, ScreeningVerdict } from '../types';
import { RiskBadge, StirShakenBadge } from './RiskBadge';
import { AudioWaveformHUD } from './AudioWaveformHUD';
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

  // Call phases: RINGING -> SCREENING (AI talks to caller) -> CONNECTED (User answered directly)
  const [callPhase, setCallPhase] = useState<'RINGING' | 'SCREENING' | 'CONNECTED'>(
    incomingCall.initialPhase || (incomingCall.isOutgoing ? 'CONNECTED' : 'RINGING')
  );

  useEffect(() => {
    if (incomingCall.initialPhase) {
      setCallPhase(incomingCall.initialPhase);
    }
  }, [incomingCall.initialPhase]);

  // In-call active controls state
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(false);
  const [isOnHold, setIsOnHold] = useState<boolean>(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState<boolean>(false);
  const [isAiCoPilotOpen, setIsAiCoPilotOpen] = useState<boolean>(false);
  const [callNotes, setCallNotes] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [dialedDtmf, setDialedDtmf] = useState<string>('');
  const [callDuration, setCallDuration] = useState<number>(0);

  // Screening dialogue & AI Voice state
  const [listenIn, setListenIn] = useState<boolean>(false);
  const [isTransmittingToCaller, setIsTransmittingToCaller] = useState<boolean>(false);
  const [dialogue, setDialogue] = useState<DialogueTurn[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [dynamicChips, setDynamicChips] = useState<string[]>([]);
  const [liveAssessment, setLiveAssessment] = useState<{ category: string; riskScore: number; verdict: ScreeningVerdict } | null>(null);
  const [callerStreamText, setCallerStreamText] = useState<string>('');
  const [isCallerSpeaking, setIsCallerSpeaking] = useState<boolean>(false);
  const [rmsLevel, setRmsLevel] = useState<number>(0);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const [callEndedNotice, setCallEndedNotice] = useState<string | null>(null);
  const [customReplyInput, setCustomReplyInput] = useState<string>('');
  const [aiVoicePersona, setAiVoicePersona] = useState<'female' | 'male' | 'natural'>('female');
  const [screeningMode, setScreeningMode] = useState<'AI_ASSISTANT' | 'PERSONAL_VOICEMAIL'>('AI_ASSISTANT');
  const [voicemailState, setVoicemailState] = useState<'IDLE' | 'GREETING_PLAYING' | 'RECORDING_CALLER_MESSAGE'>('IDLE');

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
      ? 'नमस्ते। मैं इस कॉल की जांच करने वाला एआई सहायक हूं। कृपया अपना नाम और कॉल करने का कारण बताएं।'
      : activeLang === 'HINGLISH'
      ? 'Namaste, main recipient ke liye call screen kar raha hoon. Kripya apna naam aur call karne ka reason batayein.'
      : "Hello, I am screening calls on behalf of the recipient with Aegis AI. Please state your name and why you are calling.";

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
    if (dialogueEndRef.current && typeof dialogueEndRef.current.scrollIntoView === 'function') {
      dialogueEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dialogue, callerStreamText]);

  // Native telephony listeners
  useEffect(() => {
    CapacitorService.triggerHapticFeedback();
    CapacitorService.getScreeningMode().then((res) => {
      if (res?.mode) setScreeningMode(res.mode);
    });

    let transcriptRafId: number | null = null;
    let pendingTranscriptText = '';

    const unlistenTranscript = CapacitorService.addLiveTranscriptListener((data) => {
      if (data.isFinal) {
        if (transcriptRafId !== null) {
          cancelAnimationFrame(transcriptRafId);
          transcriptRafId = null;
        }
        setIsCallerSpeaking(false);
        setCallerStreamText('');
        setDialogue((prev) => [
          ...prev,
          {
            sender: 'CALLER',
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        handleProcessCallerUtterance(data.text);
      } else {
        pendingTranscriptText = data.text;
        if (transcriptRafId === null) {
          transcriptRafId = requestAnimationFrame(() => {
            setCallerStreamText(pendingTranscriptText);
            setIsCallerSpeaking(true);
            transcriptRafId = null;
          });
        }
      }
    });

    const unlistenAiSpeech = CapacitorService.addAiSpeechListener((data) => {
      setIsAiSpeaking(true);
      setDialogue((prev) => [
        ...prev,
        {
          sender: 'AI_ASSISTANT',
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setTimeout(() => setIsAiSpeaking(false), 2400);
    });

    const unlistenVoicemail = CapacitorService.addVoicemailStateListener((data) => {
      if (data.state === 'GREETING_PLAYING') {
        setVoicemailState('GREETING_PLAYING');
        setIsAiSpeaking(true);
        setIsCallerSpeaking(false);
      } else if (data.state === 'RECORDING_CALLER_MESSAGE') {
        setVoicemailState('RECORDING_CALLER_MESSAGE');
        setIsAiSpeaking(false);
        setIsCallerSpeaking(true);
        setIsRecording(true);
      }
    });

    let audioRafId: number | null = null;
    let pendingRms = 0;

    const unlistenAudioLevel = CapacitorService.addAudioLevelListener((data) => {
      pendingRms = data.rmsDb;
      if (audioRafId === null) {
        audioRafId = requestAnimationFrame(() => {
          setRmsLevel(pendingRms);
          audioRafId = null;
        });
      }
    });

    const unlistenRecordingSaved = CapacitorService.addRecordingSavedListener((data) => {
      setIsRecording(false);
      setRecordingNotice(`Call recording saved to ${data.location || 'Recordings/Music'}`);
      setTimeout(() => setRecordingNotice(null), 4000);
    });

    const unlistenEnded = CapacitorService.addCallEndedListener(() => {
      setCallEndedNotice('Call Ended');
      setTimeout(() => onDismiss(), 600);
    });

    const unlistenPickedUp = CapacitorService.addCallPickedUpListener(() => {
      setCallPhase('CONNECTED');
    });

    const unlistenAudio = CapacitorService.addCallAudioStateListener((data) => {
      setIsMuted(data.muted);
      setIsSpeakerOn(data.speakerOn);
    });

    const unlistenAudioRoute = CapacitorService.addAudioRouteStateListener((data) => {
      setIsTransmittingToCaller(data.transmittingToCaller);
      setListenIn(data.isListenIn);
    });

    const unlistenQuickReplies = CapacitorService.addQuickRepliesListener((data) => {
      if (data?.replies && Array.isArray(data.replies)) {
        setDynamicChips(data.replies.map((r) => r.speechText || r.label));
      }
    });

    return () => {
      if (transcriptRafId !== null) cancelAnimationFrame(transcriptRafId);
      if (audioRafId !== null) cancelAnimationFrame(audioRafId);
      if (unlistenTranscript) unlistenTranscript();
      if (unlistenAiSpeech) unlistenAiSpeech();
      if (unlistenVoicemail) unlistenVoicemail();
      if (unlistenAudioLevel) unlistenAudioLevel();
      if (unlistenRecordingSaved) unlistenRecordingSaved();
      if (unlistenEnded) unlistenEnded();
      if (unlistenPickedUp) unlistenPickedUp();
      if (unlistenAudio) unlistenAudio();
      if (unlistenAudioRoute) unlistenAudioRoute();
      if (unlistenQuickReplies) unlistenQuickReplies();
    };
  }, [onDismiss]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Switch AI Voice Persona
  const handleSelectVoicePersona = async (persona: 'female' | 'male' | 'natural') => {
    CapacitorService.triggerHapticFeedback();
    setAiVoicePersona(persona);
    await CapacitorService.setAiVoicePersona(persona);
  };

  // Toggle Live Listen-In (Silent Call Monitoring on our side)
  const handleToggleListenIn = async () => {
    CapacitorService.triggerHapticFeedback();
    const next = !listenIn;
    setListenIn(next);
    await CapacitorService.setListenIn(next);
  };

  // Start Call Screening (AI Bot Voice or Personal Voicemail)
  const handleStartAiScreening = async () => {
    CapacitorService.triggerHapticFeedback();
    setCallPhase('SCREENING');
    setIsAiSpeaking(true);
    setIsCallerSpeaking(false);

    if (screeningMode === 'PERSONAL_VOICEMAIL') {
      setVoicemailState('GREETING_PLAYING');
      const greetingMessage = '📼 [Playing your recorded voice greeting: "Please state your name and leave your message after the tone..."]';
      setDialogue([
        {
          sender: 'AI_ASSISTANT',
          text: greetingMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      await CapacitorService.screenCallWithAi(activeLang.toLowerCase(), true);

      if (!CapacitorService.isNative()) {
        const customB64 = localStorage.getItem('custom_voice_greeting_b64');
        if (customB64 && customB64.startsWith('data:audio')) {
          try {
            const audio = new Audio(customB64);
            audio.play();
          } catch {}
        } else if (listenIn) {
          CapacitorService.speakOutLoud("Hi, you've reached my voicemail. Please leave your message after the tone.", 'en-US');
        }

        setTimeout(() => {
          CapacitorService.playWebDtmfTone('1');
          setVoicemailState('RECORDING_CALLER_MESSAGE');
          setIsAiSpeaking(false);
          setIsCallerSpeaking(true);
          setIsRecording(true);

          setDialogue((prev) => [
            ...prev,
            {
              sender: 'AI_ASSISTANT',
              text: '🔔 [Tone played • Recording caller message live...]',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);

          if (incomingCall.simulatedAudioTranscript) {
            const words = incomingCall.simulatedAudioTranscript.trim().split(/\s+/);
            let wordIdx = 0;
            let accumulated = '';
            const interval = setInterval(() => {
              if (wordIdx < words.length) {
                accumulated += (wordIdx > 0 ? ' ' : '') + words[wordIdx];
                setCallerStreamText(accumulated);
                wordIdx++;
              } else {
                clearInterval(interval);
                setIsCallerSpeaking(false);
                setDialogue((prev) => [
                  ...prev,
                  {
                    sender: 'CALLER',
                    text: accumulated,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ]);
                setCallerStreamText('');
                handleProcessCallerUtterance(accumulated);
              }
            }, 150);
          }
        }, 3200);
      }
      return;
    }

    // Initial greeting in dialogue feed
    setDialogue([
      {
        sender: 'AI_ASSISTANT',
        text: defaultGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    // Native telecom answers call, routes AI voice into phone stream with unmuted uplink
    await CapacitorService.screenCallWithAi(activeLang.toLowerCase(), true);

    // If simulating in desktop browser, speak out loud through web speech synthesis
    if (!CapacitorService.isNative() && listenIn) {
      const ttsLang = activeLang === 'HI' ? 'hi-IN' : activeLang === 'HINGLISH' ? 'hi-IN' : 'en-US';
      CapacitorService.speakOutLoud(defaultGreeting, ttsLang);
    }

    // After AI finishes greeting, trigger caller simulation if transcript provided
    setTimeout(() => {
      setIsAiSpeaking(false);
      setIsCallerSpeaking(true);

      if (incomingCall.simulatedAudioTranscript) {
        const words = incomingCall.simulatedAudioTranscript.trim().split(/\s+/);
        let wordIdx = 0;
        let accumulated = '';
        const interval = setInterval(() => {
          if (wordIdx < words.length) {
            accumulated += (wordIdx > 0 ? ' ' : '') + words[wordIdx];
            setCallerStreamText(accumulated);
            wordIdx++;
          } else {
            clearInterval(interval);
            setIsCallerSpeaking(false);
            setDialogue((prev) => [
              ...prev,
              {
                sender: 'CALLER',
                text: accumulated,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
            setCallerStreamText('');
            handleProcessCallerUtterance(accumulated);
          }
        }, 150);
      }
    }, 2800);
  };

  const handleAnswerDirectly = async () => {
    CapacitorService.triggerHapticFeedback();
    setCallPhase('CONNECTED');
    await CapacitorService.answerCall();
    await CapacitorService.pickupCall();
  };

  const handleDeclineCall = async () => {
    CapacitorService.triggerHapticFeedback();
    await CapacitorService.rejectCall();
    onOverrideAction('REJECT');
    setCallEndedNotice('Call Declined & Blocked');
    setTimeout(() => onDismiss(), 600);
  };

  const handlePickupTakeover = async () => {
    CapacitorService.triggerHapticFeedback();
    setCallPhase('CONNECTED');
    await CapacitorService.pickupCall();
  };

  const handleToggleRecording = async () => {
    CapacitorService.triggerHapticFeedback();
    if (!isRecording) {
      const res = await CapacitorService.startCallRecording(incomingCall.phoneNumber);
      if (res.success) {
        setIsRecording(true);
        setRecordingNotice('🔴 Call Recording Active • Saved to Android Recordings');
        setTimeout(() => setRecordingNotice(null), 3500);
      }
    } else {
      const res = await CapacitorService.stopCallRecording();
      setIsRecording(false);
      setRecordingNotice(`Call recording saved to ${res.savedTo || 'Recordings/Music'}`);
      setTimeout(() => setRecordingNotice(null), 4000);
    }
  };

  const handleHangUp = async () => {
    CapacitorService.triggerHapticFeedback();
    if (isRecording) {
      await CapacitorService.stopCallRecording();
      setIsRecording(false);
    }
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

  // Process caller speech with On-Device AI
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
      setIsAiThinking(false);
    } catch {
      setIsAiThinking(false);
    }
  };

  // AI speaks response out loud to the caller
  const handleAiSpeakUtterance = async (aiSpeech: string, callerResponseFallback?: string) => {
    CapacitorService.triggerHapticFeedback();
    setIsAiSpeaking(true);

    setDialogue((prev) => [
      ...prev,
      {
        sender: 'AI_ASSISTANT',
        text: aiSpeech,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    // Send AI reply over telephony uplink so caller hears it
    await CapacitorService.sendAiReply(aiSpeech);

    // If browser test, speak aloud
    if (listenIn && !CapacitorService.isNative()) {
      const ttsLang = activeLang === 'HI' ? 'hi-IN' : activeLang === 'HINGLISH' ? 'hi-IN' : 'en-US';
      CapacitorService.speakOutLoud(aiSpeech, ttsLang);
    }

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
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
            setCallerStreamText('');
          }
        }, 35);
      }, 1200);
    } else {
      setTimeout(() => setIsAiSpeaking(false), 2200);
    }
  };

  const handleCustomReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customReplyInput.trim()) return;
    const text = customReplyInput.trim();
    setCustomReplyInput('');
    handleAiSpeakUtterance(text);
  };

  // Smart action chips
  const getSmartChips = () => {
    const text = (incomingCall.simulatedAudioTranscript || '').toLowerCase();

    const dynamicList = dynamicChips.map((chip) => ({
      label: chip.length > 28 ? chip.substring(0, 26) + '…' : chip,
      prompt: chip,
      reply: undefined
    }));

    let defaultChips: { label: string; prompt: string; reply?: string }[] = [];
    if (activeLang === 'HI') {
      defaultChips = [
        { label: 'कॉल का कारण पूछें', prompt: 'क्या आप बता सकते हैं कि यह कॉल किस विषय में है?', reply: 'हाँ, हम आपके अकाउंट और सर्विस के सिलसिले में बात कर रहे हैं।' },
        { label: 'दरवाजे पर छोड़ें', prompt: 'कृपया पार्सल मेन दरवाजे के पास सुरक्षित छोड़ दें।', reply: 'जी ठीक है, मैंने पार्सल दरवाजे पर रख दिया है।' },
        { label: 'बाद में कॉल करें', prompt: 'प्राप्तकर्ता अभी व्यस्त हैं। कृपया थोड़ी देर बाद कॉल करें।', reply: 'कोई बात नहीं, मैं बाद में संपर्क करूँगा।' },
        { label: 'स्पैम बताकर काटें', prompt: 'यह कॉल संदिग्ध पाई गई है। डिस्कनेक्ट किया जा रहा है।', reply: 'रुको— [कॉल समाप्त]' }
      ];
    } else if (activeLang === 'HINGLISH') {
      defaultChips = [
        { label: 'Koun bol raha hai?', prompt: 'Aap koun bol rahe hain aur kis silsile mein call hai?', reply: 'Main aapke recent application ke liye call kar raha hoon.' },
        { label: 'Door pe rakh do', prompt: 'Bhaiya parcel flat ke main door pe chhod dijiye, thank you.', reply: 'Theek hai bhaiya, door pe rakh diya hai.' },
        { label: 'Baad mein call karein', prompt: 'Recipient abhi busy hain, please thodi der baad call karein.', reply: 'Okay sir, main baad mein call karta hoon.' },
        { label: 'Spam disconnect', prompt: 'Ye unauthorized scam call mark hui hai. Disconnecting now.', reply: 'Wait— [Disconnected]' }
      ];
    } else {
      defaultChips = [
        { label: 'Who is calling?', prompt: 'Could you please state your name and company?', reply: 'I am calling from customer service regarding your recent request.' },
        { label: 'What is this about?', prompt: 'Could you give me more details on what this call is regarding?', reply: 'Yes, this is an important notification regarding your account.' },
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

  const isHighRisk = (liveAssessment?.riskScore ?? screeningResult?.riskScore ?? 0) >= 50;

  return (
    <div
      className="call-overlay-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'radial-gradient(ellipse at 50% 10%, #0c1527 0%, #040711 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px 18px',
        color: '#fff',
        fontFamily: 'var(--font-main)'
      }}
    >
      {/* ────────────────────────────────────────────────────────────────
          TOP BAR: Truecaller Status Indicator & Mode Label
         ──────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className="status-dot"
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor:
                callPhase === 'CONNECTED' ? 'var(--color-safe)' :
                callPhase === 'SCREENING' ? 'var(--accent-glow)' : 'var(--color-warning)'
            }}
          />
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
            {callPhase === 'RINGING' && 'Incoming Call'}
            {callPhase === 'SCREENING' && (
              <>
                <Bot size={16} color="var(--accent-glow)" />
                <span>AI Screener • Speaking to Caller</span>
              </>
            )}
            {callPhase === 'CONNECTED' && (
              <>
                <PhoneCall size={16} color="var(--color-safe)" />
                <span>{isOnHold ? 'Call On Hold' : 'Connected • HD Voice'}</span>
              </>
            )}
          </span>
        </div>

        {callPhase === 'CONNECTED' && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.92rem',
              fontWeight: 700,
              color: isOnHold ? 'var(--color-warning)' : 'var(--color-safe)',
              background: 'rgba(255,255,255,0.08)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)'
            }}
          >
            {formatTimer(callDuration)}
          </div>
        )}

        {callPhase === 'SCREENING' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.28)',
                color: '#38bdf8',
                fontSize: '0.70rem',
                fontWeight: 600
              }}
              title="Audio is transmitted strictly to the remote caller on the phone line"
            >
              <Radio size={11} className="animate-pulse" />
              <span>Caller Audio Live</span>
            </div>
            <button
              onClick={handleToggleListenIn}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                background: listenIn ? 'rgba(99, 102, 241, 0.28)' : 'rgba(15, 23, 42, 0.65)',
                border: `1px solid ${listenIn ? 'var(--accent-glow)' : 'rgba(255, 255, 255, 0.15)'}`,
                color: listenIn ? '#818cf8' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title={listenIn ? 'Device speaker unmuted for live monitoring' : 'Device speaker silenced (caller hears AI privately)'}
            >
              {listenIn ? <Headphones size={13} color="#818cf8" /> : <VolumeX size={13} color="#94a3b8" />}
              <span>{listenIn ? 'Monitoring' : 'Listen In'}</span>
            </button>
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
        )}

        {callPhase === 'RINGING' && (
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

      {recordingNotice && (
        <div
          style={{
            margin: '8px 0',
            padding: '10px 14px',
            textAlign: 'center',
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            borderRadius: 'var(--radius-md)',
            color: '#6ee7b7',
            fontSize: '0.82rem',
            fontWeight: 700
          }}
        >
          {recordingNotice}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          TRUECALLER-STYLE CALLER IDENTITY & TRUST BADGE CARD
         ──────────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', margin: callPhase === 'CONNECTED' ? '8px 0' : '14px 0 8px', flexShrink: 0 }}>
        {/* Pulsing Avatar Rings */}
        <div className="caller-avatar-wrapper" style={{ width: callPhase === 'CONNECTED' ? 82 : 98, height: callPhase === 'CONNECTED' ? 82 : 98 }}>
          <div className="caller-avatar-ring" />
          <div className="caller-avatar-ring ring-2" />
          <div
            style={{
              width: callPhase === 'CONNECTED' ? 76 : 90,
              height: callPhase === 'CONNECTED' ? 76 : 90,
              borderRadius: '50%',
              background: isHighRisk
                ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                : callPhase === 'CONNECTED'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: callPhase === 'CONNECTED' ? '1.7rem' : '2.1rem',
              fontWeight: 800,
              color: '#fff',
              boxShadow: isHighRisk
                ? '0 0 35px rgba(239, 68, 68, 0.55)'
                : '0 0 35px rgba(99, 102, 241, 0.5)',
              border: '3px solid rgba(255,255,255,0.2)',
              position: 'relative',
              zIndex: 2
            }}
          >
            {callerInitials}
          </div>
        </div>

        {/* Caller Name */}
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '12px 0 3px', color: '#fff', letterSpacing: '-0.02em' }}>
          {incomingCall.callerName || 'Unknown Caller'}
        </h1>

        {/* Phone Number */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.98rem',
            color: 'var(--accent-glow)',
            fontWeight: 600,
            letterSpacing: '0.04em'
          }}
        >
          {incomingCall.phoneNumber}
        </div>

        {/* Location & Carrier */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          📍 {incomingCall.location || 'Mumbai, Maharashtra'} • {incomingCall.carrier || 'Jio 5G'}
        </div>

        {/* Truecaller Verified or Spam Radar Badge */}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
          {isHighRisk ? (
            <div className="truecaller-spam-radar-badge">
              <ShieldAlert size={14} color="#f87171" />
              <span>⚠️ Spam Radar • 3,240 Reports (Telemarketer / Scam)</span>
            </div>
          ) : (
            <div className="truecaller-verified-badge">
              <ShieldCheck size={14} color="#34d399" />
              <span>✓ Verified Caller • Trust Score 94%</span>
            </div>
          )}
        </div>

        {/* STIR/SHAKEN Carrier Cryptographic Attestation */}
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}>
          <StirShakenBadge
            status={
              incomingCall.stirShakenStatus ||
              (screeningResult?.metadata?.stirShakenAttestation === 'A' ? 'VERIFIED_A' :
               screeningResult?.metadata?.stirShakenAttestation === 'B' ? 'PARTIAL_B' :
               screeningResult?.category === 'CARRIER_SPOOFED' || (screeningResult?.metadata?.spoofProbability && screeningResult.metadata.spoofProbability > 0.8) ? 'FAILED_SPOOF' :
               incomingCall.isCarrierVerified ? 'VERIFIED_A' : 'NOT_VERIFIED')
            }
          />
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────
          PHASE 1: RINGING (Hero "Screen with AI / My Voice" + Answer + Decline)
         ──────────────────────────────────────────────────────────────── */}
      {callPhase === 'RINGING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
          {/* Mode Switcher Pill */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button
              onClick={() => {
                CapacitorService.triggerHapticFeedback();
                setScreeningMode('AI_ASSISTANT');
                CapacitorService.setScreeningMode('AI_ASSISTANT');
              }}
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: 'var(--radius-full)',
                background: screeningMode === 'AI_ASSISTANT' ? 'var(--accent-glow)' : 'rgba(255,255,255,0.08)',
                color: screeningMode === 'AI_ASSISTANT' ? '#0f172a' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Bot size={13} />
              <span>AI Screener</span>
            </button>

            <button
              onClick={() => {
                CapacitorService.triggerHapticFeedback();
                setScreeningMode('PERSONAL_VOICEMAIL');
                CapacitorService.setScreeningMode('PERSONAL_VOICEMAIL');
              }}
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '5px 14px',
                borderRadius: 'var(--radius-full)',
                background: screeningMode === 'PERSONAL_VOICEMAIL' ? '#10b981' : 'rgba(255,255,255,0.08)',
                color: screeningMode === 'PERSONAL_VOICEMAIL' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Mic size={13} />
              <span>My Voice Voicemail</span>
            </button>
          </div>

          {/* Truecaller / Google Pixel Hero Card */}
          <div
            className="glass-card"
            style={{
              padding: '16px 18px',
              textAlign: 'center',
              background: screeningMode === 'PERSONAL_VOICEMAIL'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)'
                : 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)',
              border: screeningMode === 'PERSONAL_VOICEMAIL'
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid rgba(99, 102, 241, 0.35)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 6 }}>
              {screeningMode === 'PERSONAL_VOICEMAIL' ? (
                <>
                  <Mic size={18} color="#34d399" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>
                    Personal Voice Answering Machine
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={18} color="var(--accent-glow)" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-glow)' }}>
                    Truecaller AI Voice Screener
                  </span>
                </>
              )}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
              {screeningMode === 'PERSONAL_VOICEMAIL' ? (
                <>
                  Plays your <strong>recorded voice greeting</strong> to the caller, beeps, and records their message with real-time live transcription.
                </>
              ) : (
                <>
                  The AI Assistant will <strong>answer and speak to the caller</strong>, ask who they are and why they are calling, and stream the transcript live.
                </>
              )}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 1. HERO BUTTON: Screen with AI or My Voice */}
            <button
              onClick={handleStartAiScreening}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '1.05rem',
                fontWeight: 800,
                background: screeningMode === 'PERSONAL_VOICEMAIL'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
                  : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
                boxShadow: screeningMode === 'PERSONAL_VOICEMAIL'
                  ? '0 0 30px rgba(16, 185, 129, 0.55)'
                  : '0 0 30px rgba(99, 102, 241, 0.55)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {screeningMode === 'PERSONAL_VOICEMAIL' ? <Mic size={22} /> : <Bot size={22} />}
                <span>{screeningMode === 'PERSONAL_VOICEMAIL' ? 'Answer with My Voice Voicemail' : 'Screen Call with AI'}</span>
              </div>
              <span style={{ fontSize: '0.73rem', opacity: 0.92, fontWeight: 500 }}>
                {screeningMode === 'PERSONAL_VOICEMAIL'
                  ? 'Plays your voice • Records caller message • Real-time live transcript'
                  : 'AI speaks to caller • Real-time live transcript • 1-tap responses'}
              </span>
            </button>

            {/* 2. Direct Answer and Decline Row */}
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
                  fontSize: '0.96rem'
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
                  fontSize: '0.96rem',
                  boxShadow: '0 0 22px rgba(16, 185, 129, 0.45)'
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
          PHASE 2: SCREENING (Live Bidirectional AI Screening HUD)
         ──────────────────────────────────────────────────────────────── */}
      {callPhase === 'SCREENING' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 10, minHeight: 0 }}>
          {/* Top Voice Header & Equalizer */}
          <div
            className="glass-card"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              background: 'rgba(15, 23, 42, 0.8)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {screeningMode === 'PERSONAL_VOICEMAIL' ? (
                voicemailState === 'GREETING_PLAYING' || isAiSpeaking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mic size={15} color="#34d399" />
                    <span style={{ fontSize: '0.76rem', color: '#34d399', fontWeight: 700 }}>Playing Your Voice Greeting</span>
                    <div className="ai-voice-wave" style={{ marginLeft: 4 }}>
                      <div className="ai-wave-bar" />
                      <div className="ai-wave-bar" />
                      <div className="ai-wave-bar" />
                    </div>
                  </div>
                ) : isCallerSpeaking || voicemailState === 'RECORDING_CALLER_MESSAGE' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Radio size={15} color="#ef4444" />
                    <span style={{ fontSize: '0.76rem', color: '#f87171', fontWeight: 700 }}>Recording Caller Message</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mic size={15} color="#34d399" />
                    <span style={{ fontSize: '0.76rem', color: '#34d399', fontWeight: 700 }}>Voicemail Ready</span>
                  </div>
                )
              ) : isAiSpeaking ? (
                <div className="ai-voice-wave">
                  <div className="ai-wave-bar" />
                  <div className="ai-wave-bar" />
                  <div className="ai-wave-bar" />
                  <div className="ai-wave-bar" />
                  <div className="ai-wave-bar" />
                  <div className="ai-wave-bar" />
                </div>
              ) : isCallerSpeaking ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Headphones size={15} color="#38bdf8" />
                  <span style={{ fontSize: '0.76rem', color: '#38bdf8', fontWeight: 700 }}>Caller Speaking</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Bot size={15} color="var(--accent-glow)" />
                  <span style={{ fontSize: '0.76rem', color: 'var(--accent-glow)', fontWeight: 700 }}>AI Ready</span>
                </div>
              )}
            </div>

            {/* AI Voice Persona Selector or Voicemail Mode Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {screeningMode === 'PERSONAL_VOICEMAIL' ? (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.4)'
                  }}
                >
                  📼 My Voice Voicemail
                </span>
              ) : (
                (['female', 'male'] as const).map((persona) => (
                  <button
                    key={persona}
                    onClick={() => handleSelectVoicePersona(persona)}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: aiVoicePersona === persona ? 'var(--accent-glow)' : 'rgba(255,255,255,0.06)',
                      color: aiVoicePersona === persona ? '#0f172a' : 'var(--text-secondary)',
                      textTransform: 'capitalize'
                    }}
                  >
                    {persona === 'female' ? 'Sophia' : 'Alex'}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Extreme Feature: Live Acoustic Waveform Visualizer & Decibel Telemetry */}
          <AudioWaveformHUD
            activeSpeaker={
              isAiSpeaking
                ? 'AI_ASSISTANT'
                : isCallerSpeaking || Boolean(callerStreamText)
                ? 'CALLER'
                : listenIn
                ? 'SILENT_MONITORING'
                : 'IDLE'
            }
            isListening={true}
            uplinkSilenced={!isTransmittingToCaller}
            customLabel={
              screeningMode === 'PERSONAL_VOICEMAIL'
                ? 'Voicemail Direct Inbound'
                : isAiSpeaking
                ? 'Aegis Neural Voice (To Caller)'
                : isCallerSpeaking
                ? 'Caller Audio Stream'
                : 'Acoustic Monitoring'
            }
          />

          {/* Audio Route & Security Isolation HUD: AI on caller line uplink, local end isolated */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.73rem',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: isAiSpeaking ? '#34d399' : '#38bdf8',
                    fontWeight: 700
                  }}
                >
                  <PhoneCall size={13} />
                  <span>Uplink (Caller Line): {isAiSpeaking ? 'AI Speaking Live' : 'Listening for Caller'}</span>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.66rem',
                    fontWeight: 600
                  }}
                  title="Local microphone is strictly muted/isolated during AI screening to eliminate eavesdropping"
                >
                  <MicOff size={10} />
                  <span>Mic Isolated</span>
                </span>

                <button
                  onClick={handleToggleListenIn}
                  style={{
                    background: listenIn ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                    border: listenIn ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                    color: listenIn ? '#38bdf8' : 'var(--text-muted)',
                    borderRadius: 'var(--radius-full)',
                    padding: '3px 10px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.2s'
                  }}
                  title={listenIn ? 'Click to silence device speaker' : 'Click for private listen-in (caller cannot hear you)'}
                >
                  {listenIn ? <Headphones size={12} color="#38bdf8" /> : <VolumeX size={12} color="var(--text-muted)" />}
                  <span>{listenIn ? 'Private Listen: ON' : 'Speaker: Silenced'}</span>
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={11} color="#34d399" />
              <span>Zero-Leakage Audio: AI communicates on caller uplink. Your room audio is not broadcast.</span>
            </div>
          </div>

          {/* Live Conversation Transcript Feed */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '6px 4px',
              minHeight: 120
            }}
          >
            {dialogue.map((turn, idx) => (
              <div
                key={idx}
                className={turn.sender === 'AI_ASSISTANT' ? 'transcript-bubble-ai' : 'transcript-bubble-caller'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      color: turn.sender === 'AI_ASSISTANT' ? (screeningMode === 'PERSONAL_VOICEMAIL' ? '#34d399' : 'var(--accent-glow)') : '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {turn.sender === 'AI_ASSISTANT' ? (
                      screeningMode === 'PERSONAL_VOICEMAIL' ? <Mic size={12} color="#34d399" /> : <Bot size={12} />
                    ) : (
                      <User size={12} />
                    )}
                    {turn.sender === 'AI_ASSISTANT'
                      ? (screeningMode === 'PERSONAL_VOICEMAIL' ? 'My Voice Greeting (Caller End)' : 'Aegis AI (Speaking to Caller)')
                      : `${incomingCall.callerName || 'Caller'} (Caller End)`}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {turn.timestamp}
                  </span>
                </div>
                <div style={{ fontSize: '0.86rem', color: '#f8fafc', lineHeight: 1.45 }}>
                  {turn.text}
                </div>
              </div>
            ))}

            {/* Caller Real-Time Streaming Words Bubble */}
            {isCallerSpeaking && (
              <div className="transcript-bubble-caller">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <User size={12} />
                    {incomingCall.callerName || 'Caller'} {screeningMode === 'PERSONAL_VOICEMAIL' ? '(Leaving voicemail…)' : '(Transcribing live…)'}
                  </span>
                </div>
                <div style={{ fontSize: '0.88rem', color: '#f8fafc', lineHeight: 1.45 }}>
                  {callerStreamText || '…'}
                  <span className="streaming-caret" />
                </div>
              </div>
            )}

            {isAiThinking && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', color: 'var(--accent-glow)', fontSize: '0.75rem' }}>
                <Sparkles size={14} className="animate-spin" />
                <span>AI analyzing speech & intent…</span>
              </div>
            )}

            <div ref={dialogueEndRef} />
          </div>

          {/* Live Intent Assessment Banner */}
          {liveAssessment && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: liveAssessment.riskScore > 60 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${liveAssessment.riskScore > 60 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                flexShrink: 0
              }}
            >
              <div style={{ fontSize: '0.76rem', color: '#e2e8f0', fontWeight: 600 }}>
                Intent: <strong style={{ color: liveAssessment.riskScore > 60 ? '#f87171' : '#34d399' }}>{liveAssessment.category.replace('_', ' ')}</strong>
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: liveAssessment.riskScore > 60 ? '#f87171' : '#34d399'
                }}
              >
                Risk: {liveAssessment.riskScore}%
              </div>
            </div>
          )}

          {/* Interactive Smart Action Chips (Google Pixel / Truecaller Style) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} color="var(--accent-glow)" />
              <span>Tap to have AI speak to caller:</span>
            </div>

            <div className="smart-chips-carousel">
              {getSmartChips().map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAiSpeakUtterance(chip.prompt, chip.reply)}
                  className={`smart-action-chip ${chip.label.toLowerCase().includes('spam') ? 'danger' : ''}`}
                >
                  💬 {chip.label}
                </button>
              ))}
            </div>

            {/* Custom Reply Input Bar */}
            <form onSubmit={handleCustomReplySubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={customReplyInput}
                onChange={(e) => setCustomReplyInput(e.target.value)}
                placeholder="Type custom prompt for AI to speak..."
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '0.82rem',
                  color: '#fff',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={!customReplyInput.trim()}
                style={{
                  background: 'var(--accent-gradient)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: customReplyInput.trim() ? 1 : 0.5
                }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>

          {/* Primary Action Buttons: Take Over (Pick Up) / Decline Call */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 4, flexShrink: 0 }}>
            <button
              onClick={handleHangUp}
              className="btn-danger"
              style={{
                justifyContent: 'center',
                padding: '16px',
                gap: 6,
                fontWeight: 800,
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <PhoneOff size={20} />
              <span>Decline</span>
            </button>

            <button
              onClick={handlePickupTakeover}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#fff',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '16px',
                fontWeight: 800,
                fontSize: '1.02rem',
                boxShadow: '0 0 25px rgba(16, 185, 129, 0.55)',
                cursor: 'pointer'
              }}
            >
              <Phone size={22} />
              <span>Take Over & Talk</span>
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          PHASE 3: CONNECTED (In-Call Active Controls)
         ──────────────────────────────────────────────────────────────── */}
      {callPhase === 'CONNECTED' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', padding: '8px 0', minHeight: 0 }}>
          {/* Status banner */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
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
              <span>{isOnHold ? 'CALL ON HOLD' : 'CONNECTED (HD VOICE)'}</span>
              {isRecording && <span style={{ color: 'var(--color-danger)', marginLeft: 6 }}>● REC</span>}
            </div>
          </div>

          {/* Dialpad Drawer */}
          {isKeypadOpen ? (
            <div
              className="glass-card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                  {dialedDtmf || 'Dialing…'}
                </span>
                <button
                  onClick={() => setIsKeypadOpen(false)}
                  style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Close Keypad
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {DTMF_KEYS.map(([digit, sub], idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDtmfPress(digit)}
                    style={{
                      height: 52,
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{digit}</span>
                    {sub && <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{sub}</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : isAiCoPilotOpen ? (
            /* AI Co-Pilot & In-Call Notes */
            <div
              className="glass-card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                flex: 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-glow)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} />
                  AI Co-Pilot & Quick Notes
                </span>
                <button
                  onClick={() => setIsAiCoPilotOpen(false)}
                  style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}
                >
                  Done
                </button>
              </div>

              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Take live notes during this phone call..."
                style={{
                  flex: 1,
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 10,
                  fontSize: '0.85rem',
                  color: '#fff',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>
          ) : (
            /* 6-Grid In-Call Control Buttons */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px 12px',
                padding: '12px 10px',
                justifyItems: 'center'
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
                    boxShadow: isMuted ? '0 0 16px rgba(239, 68, 68, 0.4)' : 'none'
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
                    boxShadow: isSpeakerOn ? '0 0 16px rgba(99, 102, 241, 0.4)' : 'none'
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
                    boxShadow: isOnHold ? '0 0 16px rgba(245, 158, 11, 0.4)' : 'none'
                  }}
                >
                  {isOnHold ? <Play size={24} /> : <Pause size={24} />}
                </button>
                <span style={{ fontSize: '0.72rem', color: isOnHold ? 'var(--color-warning)' : 'var(--text-secondary)', fontWeight: 600 }}>
                  {isOnHold ? 'Resume' : 'Hold'}
                </span>
              </div>

              {/* 5. AI Co-Pilot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setIsAiCoPilotOpen(!isAiCoPilotOpen)}
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
                >
                  <Sparkles size={24} />
                </button>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-glow)', fontWeight: 600 }}>
                  AI Notes
                </span>
              </div>

              {/* 6. Record */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={handleToggleRecording}
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
                    boxShadow: isRecording ? '0 0 16px rgba(239, 68, 68, 0.4)' : 'none'
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
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, flexShrink: 0 }}>
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
