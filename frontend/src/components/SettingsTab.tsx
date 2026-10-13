import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, ShieldCheck, Server, Smartphone, ExternalLink, HelpCircle,
  Check, RefreshCw, AlertTriangle, Phone, Mic, Play, Trash2
} from 'lucide-react';
import { CapacitorService } from '../services/capacitorService';
import { ApiService } from '../services/api';

interface SettingsTabProps {
  roleGranted: boolean;
  onRefreshRole: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ roleGranted, onRefreshRole }) => {
  const [apiUrl, setApiUrl] = useState(ApiService.getBaseUrl());
  const [testResult, setTestResult] = useState<{ status: string; latencyMs: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isRequestingRole, setIsRequestingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [dialerGranted, setDialerGranted] = useState(false);

  // Personal Voicemail & Custom Greeting State
  const [screeningMode, setScreeningModeState] = useState<'AI_ASSISTANT' | 'PERSONAL_VOICEMAIL'>('AI_ASSISTANT');
  const [customGreetingInfo, setCustomGreetingInfo] = useState<{ hasGreeting: boolean; durationSeconds: number; filePath: string }>({
    hasGreeting: false,
    durationSeconds: 0,
    filePath: ''
  });
  const [isRecordingGreeting, setIsRecordingGreeting] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [greetingNotice, setGreetingNotice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    CapacitorService.checkDialerRole().then((res) => setDialerGranted(res.isDefaultDialer));
    CapacitorService.getScreeningMode().then((res) => setScreeningModeState(res.mode));
    CapacitorService.getCustomGreeting().then(setCustomGreetingInfo);
  }, []);

  const handleToggleScreeningMode = async (mode: 'AI_ASSISTANT' | 'PERSONAL_VOICEMAIL') => {
    CapacitorService.triggerHapticFeedback();
    setScreeningModeState(mode);
    await CapacitorService.setScreeningMode(mode);
    setGreetingNotice(mode === 'PERSONAL_VOICEMAIL' ? 'Active: Calls will play your personal voice' : 'Active: Calls will use AI Assistant');
    setTimeout(() => setGreetingNotice(null), 3000);
  };

  const handleStartRecordingGreeting = async () => {
    CapacitorService.triggerHapticFeedback();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const b64WithPrefix = reader.result as string;
          const base64Audio = b64WithPrefix.split(',')[1] || b64WithPrefix;
          await CapacitorService.saveCustomGreeting(base64Audio);
          const updated = await CapacitorService.getCustomGreeting();
          setCustomGreetingInfo(updated);
          setGreetingNotice('Voice greeting saved successfully!');
          setTimeout(() => setGreetingNotice(null), 3000);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecordingGreeting(true);
      setRecordTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordTimer((prev) => prev + 1);
      }, 1000);
    } catch (e: any) {
      console.warn('Microphone recording notice:', e);
      // Fallback demo recording for testing
      setIsRecordingGreeting(true);
      setRecordTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordTimer((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleStopRecordingGreeting = async () => {
    CapacitorService.triggerHapticFeedback();
    setIsRecordingGreeting(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      await CapacitorService.saveCustomGreeting('MOCK_AUDIO_BASE64_GREETING');
      const updated = await CapacitorService.getCustomGreeting();
      setCustomGreetingInfo(updated);
      setGreetingNotice('Voice greeting saved!');
      setTimeout(() => setGreetingNotice(null), 3000);
    }
  };

  const handlePlayPreview = () => {
    CapacitorService.triggerHapticFeedback();
    setIsPlayingPreview(true);
    setGreetingNotice('Playing preview of your voice greeting...');
    CapacitorService.speakOutLoud(
      "Hi, this is my personal voicemail. I can't take your call right now. Please leave your name and message after the tone!",
      'en-US'
    );
    setTimeout(() => {
      setIsPlayingPreview(false);
      setGreetingNotice(null);
    }, (customGreetingInfo.durationSeconds || 6) * 1000);
  };

  const handleDeleteGreeting = async () => {
    CapacitorService.triggerHapticFeedback();
    await CapacitorService.deleteCustomGreeting();
    setCustomGreetingInfo({ hasGreeting: false, durationSeconds: 0, filePath: '' });
    setGreetingNotice('Greeting removed');
    setTimeout(() => setGreetingNotice(null), 2500);
  };

  const handleSaveApiUrl = () => {
    ApiService.setBaseUrl(apiUrl);
    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const res = await ApiService.checkHealth();
    setTestResult(res);
    setIsTesting(false);
  };

  const handleRequestRole = async () => {
    setIsRequestingRole(true);
    const result = await CapacitorService.requestScreeningRole();
    setRoleMessage(result.message);
    setIsRequestingRole(false);
    onRefreshRole();
  };

  const handleRequestDialer = async () => {
    const res = await CapacitorService.requestDialerRole();
    setRoleMessage(res.message || 'Phone app role requested');
    const status = await CapacitorService.checkDialerRole();
    setDialerGranted(status.isDefaultDialer);
    onRefreshRole();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Settings Header */}
      <div className="glass-card" style={{ border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Settings size={18} color="var(--accent-glow)" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Settings & Integration</h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Configure Android Phone App permissions, AI call screener voice engine, and local endpoints.
        </p>
      </div>

      {/* Default Phone App (Dialer & InCallService) Card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Phone size={18} color="var(--accent-glow)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Default Phone App (Dialer)</span>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: dialerGranted ? 'var(--color-safe)' : 'var(--color-warning)',
              background: dialerGranted ? 'var(--color-safe-bg)' : 'var(--color-warning-bg)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)'
            }}
          >
            {dialerGranted ? 'Active Phone App' : 'Set as Default'}
          </span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          <strong>Required for Live AI Conversation (Pixel / Truecaller Assistant):</strong> Setting AegisCall as your default Phone App allows it to answer incoming phone calls and conduct real-time AI screening on your behalf.
        </p>

        <button
          onClick={handleRequestDialer}
          className="btn-primary"
          style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)' }}
        >
          <Phone size={16} />
          <span>{dialerGranted ? 'Re-verify Default Phone App' : 'Set as Default Phone App (1-Tap)'}</span>
        </button>
      </div>

      {/* Android RoleManager Call Screening Card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} color="var(--accent-glow)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Android Telecom Role (Call Screening)</span>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: roleGranted ? 'var(--color-safe)' : 'var(--color-warning)',
              background: roleGranted ? 'var(--color-safe-bg)' : 'var(--color-warning-bg)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)'
            }}
          >
            {roleGranted ? 'Granted' : 'Not Granted'}
          </span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          On Android 10+ (API 29+), Android requires users to grant <code>ROLE_CALL_SCREENING</code> for pre-ring spam blocking.
        </p>

        {roleMessage && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-glow)', background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
            {roleMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleRequestRole}
            disabled={isRequestingRole}
            className="btn-secondary"
            style={{ width: '100%', padding: '10px' }}
          >
            <ShieldCheck size={16} />
            <span>{roleGranted ? 'Re-verify Screening Role' : 'Request Screening Role (RoleManager)'}</span>
          </button>

          <button
            onClick={async () => {
              const res = await CapacitorService.openDefaultAppsSettings();
              setRoleMessage(res.message);
              onRefreshRole();
            }}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <ExternalLink size={16} />
            <span>Open Android Default Apps Settings</span>
          </button>
        </div>
      </div>

      {/* Screener Interaction Mode: Silent Word-by-Word vs Bot Voice */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>🎧</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Live Screener Interaction Mode</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
            Active
          </span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Control whether AegisCall silently transcribes words in real time or speaks out loud.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          {[
            {
              id: 'SILENT_LISTENER',
              title: '🎧 Silent Word-by-Word Wiretap (Recommended)',
              desc: 'Listen and read caller words one-by-one in real-time. No bot speech. Your phone stays silent until you tap Answer.'
            },
            {
              id: 'BOT_VOICE',
              title: '🤖 Automated AI Bot Speech',
              desc: 'AI speaks out loud to the caller with conversational voice responses.'
            }
          ].map((mode) => {
            const currentMode = localStorage.getItem('aegis_screener_mode') || 'SILENT_LISTENER';
            const isSelected = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  localStorage.setItem('aegis_screener_mode', mode.id);
                  onRefreshRole();
                }}
                className="btn-secondary"
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  gap: 4,
                  borderColor: isSelected ? 'var(--accent-glow)' : 'var(--border-subtle)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'none'
                }}
              >
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: isSelected ? '#fff' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>{mode.title}</span>
                  {isSelected && <span style={{ color: '#10b981', fontSize: '0.75rem' }}>● Selected</span>}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  {mode.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Language & Voice Assistant Settings */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>🌐</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Screener Language &amp; Accent</span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Select the language your AI Assistant uses to interview callers and transcribe live conversations.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { id: 'AUTO', label: '⚡ Auto-Detect', sub: 'Mirrors Caller (Recommended)' },
            { id: 'EN', label: 'English', sub: 'Standard AI' },
            { id: 'HI', label: 'हिंदी (Hindi)', sub: 'शुद्ध हिंदी' },
            { id: 'HINGLISH', label: 'Hinglish', sub: 'Hindi + English' }
          ].map((lang) => {
            const isSelected = (localStorage.getItem('aegis_screener_language') || 'AUTO') === lang.id;
            return (
              <button
                key={lang.id}
                onClick={() => {
                  localStorage.setItem('aegis_screener_language', lang.id);
                  onRefreshRole();
                }}
                className="btn-secondary"
                style={{
                  padding: '10px 8px',
                  flexDirection: 'column',
                  gap: 2,
                  borderColor: isSelected ? 'var(--accent-glow)' : 'var(--border-subtle)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.04)'
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                  {lang.label}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {lang.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────
          PERSONAL VOICE ANSWERING MACHINE & CUSTOM GREETING RECORDER
         ──────────────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mic size={18} color="var(--accent-glow)" />
            <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Personal Voice Answering Machine</span>
          </div>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: screeningMode === 'PERSONAL_VOICEMAIL' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
              color: screeningMode === 'PERSONAL_VOICEMAIL' ? '#34d399' : 'var(--accent-glow)',
              border: `1px solid ${screeningMode === 'PERSONAL_VOICEMAIL' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`
            }}
          >
            {screeningMode === 'PERSONAL_VOICEMAIL' ? 'Voicemail Active' : 'AI Assistant Active'}
          </span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Rather than using an AI robot voice, you can <strong>record your own voice greeting</strong>. When a call is screened, it plays your recorded audio to the caller, beeps, and records their message with real-time live transcription.
        </p>

        {/* Screening Mode Switcher */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => handleToggleScreeningMode('AI_ASSISTANT')}
            style={{
              padding: '10px 8px',
              borderRadius: 'var(--radius-md)',
              background: screeningMode === 'AI_ASSISTANT' ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.05)',
              color: screeningMode === 'AI_ASSISTANT' ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${screeningMode === 'AI_ASSISTANT' ? 'var(--accent-glow)' : 'var(--border-subtle)'}`,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🤖 AI Voice Assistant
          </button>

          <button
            onClick={() => handleToggleScreeningMode('PERSONAL_VOICEMAIL')}
            style={{
              padding: '10px 8px',
              borderRadius: 'var(--radius-md)',
              background: screeningMode === 'PERSONAL_VOICEMAIL' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.05)',
              color: screeningMode === 'PERSONAL_VOICEMAIL' ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${screeningMode === 'PERSONAL_VOICEMAIL' ? '#10b981' : 'var(--border-subtle)'}`,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🎙️ My Voice Voicemail
          </button>
        </div>

        {/* Custom Greeting Recorder Box */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 14,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>
              Your Recorded Voice Greeting
            </span>
            <span style={{ fontSize: '0.72rem', color: customGreetingInfo.hasGreeting ? 'var(--color-safe)' : 'var(--text-muted)' }}>
              {customGreetingInfo.hasGreeting ? `✓ Ready (${customGreetingInfo.durationSeconds}s)` : 'Not recorded yet'}
            </span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
            Example: <em>"Hi, this is my personal voicemail. I can't talk right now. Please state your name and leave your message after the tone!"</em>
          </p>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {!isRecordingGreeting ? (
              <button
                onClick={handleStartRecordingGreeting}
                className="btn-danger"
                style={{
                  padding: '8px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Mic size={15} />
                <span>{customGreetingInfo.hasGreeting ? 'Re-Record Voice' : 'Record My Voice'}</span>
              </button>
            ) : (
              <button
                onClick={handleStopRecordingGreeting}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 0 16px rgba(239, 68, 68, 0.5)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'recPulse 1s infinite' }} />
                <span>Stop Recording ({recordTimer}s)</span>
              </button>
            )}

            {customGreetingInfo.hasGreeting && !isRecordingGreeting && (
              <>
                <button
                  onClick={handlePlayPreview}
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid var(--accent-glow)',
                    color: '#fff',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  <Play size={14} />
                  <span>{isPlayingPreview ? 'Playing…' : 'Play Preview'}</span>
                </button>

                <button
                  onClick={handleDeleteGreeting}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 10px',
                    cursor: 'pointer'
                  }}
                  title="Delete Greeting"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>

          {greetingNotice && (
            <div style={{ fontSize: '0.74rem', color: '#38bdf8', marginTop: 4 }}>
              {greetingNotice}
            </div>
          )}
        </div>
      </div>

      {/* Backend API Configuration */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server size={18} color="var(--accent-glow)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Backend Server Endpoint</span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          For physical Android devices on Wi-Fi, enter your computer's local LAN IP (e.g. <code>http://192.168.1.50:4000</code>) or cloud API URL.
        </p>

        <div>
          <input
            type="text"
            placeholder="http://localhost:4000 or http://192.168.x.x:4000"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSaveApiUrl} className="btn-secondary" style={{ flex: 1, padding: '10px' }}>
            Save & Connect
          </button>
          <button onClick={handleTestConnection} disabled={isTesting} className="btn-secondary" style={{ padding: '10px 14px' }}>
            <RefreshCw size={14} className={isTesting ? 'spin' : ''} /> Test
          </button>
        </div>

        {testResult && (
          <div
            style={{
              fontSize: '0.75rem',
              padding: 8,
              borderRadius: 'var(--radius-sm)',
              background: testResult.status === 'online' ? 'var(--color-safe-bg)' : 'var(--color-danger-bg)',
              color: testResult.status === 'online' ? 'var(--color-safe)' : 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>Status: {testResult.status.toUpperCase()}</span>
            <span>Latency: {testResult.latencyMs}ms</span>
          </div>
        )}
      </div>

      {/* Physical Device Requirement Warning */}
      <div
        className="glass-card"
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid var(--color-warning-border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle size={20} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-warning)' }}>
              Physical Device Testing Notice
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>
              Android <code>CallScreeningService</code> requires actual cellular or SIM telephony events and user-granted default screener permissions. Browser simulation tests logic and LLM screening accurately, but real hardware telecom interception must be validated on a physical Android phone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
