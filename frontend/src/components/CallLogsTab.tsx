import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Trash2, ShieldPlus, ShieldX, Clock, Phone, AlertCircle,
  Radio, Play, Pause, Download, Volume2, FileAudio, CheckCircle2, Mail, Send
} from 'lucide-react';
import { ScreeningResult, ScreeningVerdict, RecordedCallItem } from '../types';
import { RiskBadge } from './RiskBadge';
import { VoicemailAudioPlayer } from './VoicemailAudioPlayer';
import { CapacitorService } from '../services/capacitorService';
import { ApiService } from '../services/api';

interface CallLogsTabProps {
  logs: ScreeningResult[];
  onDeleteLog: (id: string) => void;
  onClearAll: () => void;
  onSelectLog: (log: ScreeningResult) => void;
  onAddRule: (pattern: string, action: ScreeningVerdict, description: string) => void;
}

export const CallLogsTab: React.FC<CallLogsTabProps> = ({
  logs,
  onDeleteLog,
  onClearAll,
  onSelectLog,
  onAddRule
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'LOGS' | 'RECORDINGS'>('LOGS');
  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('ALL');

  // Recordings state
  const [recordings, setRecordings] = useState<RecordedCallItem[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  const loadRecordings = async () => {
    try {
      const res = await CapacitorService.getRecordedCalls();
      if (res.success && res.recordings) {
        setRecordings(res.recordings);
      }
    } catch (e) {
      console.warn('Error loading recordings:', e);
    }
  };

  useEffect(() => {
    loadRecordings();
  }, []);

  const handleDeleteRecording = async (filePath: string) => {
    CapacitorService.triggerHapticFeedback();
    const res = await CapacitorService.deleteRecordedCall(filePath);
    if (res.success) {
      setRecordings((prev) => prev.filter((r) => r.filePath !== filePath));
      setAudioNotice('Recording deleted');
      setTimeout(() => setAudioNotice(null), 2500);
    }
  };

  const handleTogglePlay = (item: RecordedCallItem) => {
    CapacitorService.triggerHapticFeedback();
    if (playingId === item.id) {
      setPlayingId(null);
    } else {
      setPlayingId(item.id);
      setAudioNotice(`Playing recording: ${item.fileName}`);
      setTimeout(() => {
        setPlayingId(null);
        setAudioNotice(null);
      }, (item.durationSeconds || 10) * 1000);
    }
  };

  const [emailingId, setEmailingId] = useState<string | null>(null);

  const handleEmailCallLog = async (log: ScreeningResult) => {
    CapacitorService.triggerHapticFeedback();
    setEmailingId(log.id);
    const res = await ApiService.forwardRecordingEmail({
      phoneNumber: log.phoneNumber,
      callerName: log.callerName,
      timestamp: log.timestamp,
      verdict: log.verdict,
      riskScore: log.riskScore,
      category: log.category,
      rationale: log.rationale,
      transcript: (log.metadata as any)?.transcript || (log.metadata as any)?.detectedKeywords?.join(', ')
    });
    setEmailingId(null);
    if (res.success) {
      setAudioNotice(`Screening report for ${log.phoneNumber} forwarded to your email!`);
    } else {
      setAudioNotice(res.error || 'Failed to email screening report.');
    }
    setTimeout(() => setAudioNotice(null), 3500);
  };

  const handleEmailRecording = async (rec: RecordedCallItem) => {
    CapacitorService.triggerHapticFeedback();
    setEmailingId(rec.id);
    const res = await ApiService.forwardRecordingEmail({
      phoneNumber: rec.phoneNumber,
      callerName: `Call Recording with ${rec.phoneNumber}`,
      timestamp: rec.timestamp,
      durationSeconds: rec.durationSeconds,
      verdict: 'ALLOW',
      riskScore: 0,
      category: 'Saved Recording',
      rationale: 'Exported call audio recording from AegisCall storage archive.',
      recordingFileName: rec.fileName
    });
    setEmailingId(null);
    if (res.success) {
      setAudioNotice(`Recording for ${rec.phoneNumber} forwarded to your email!`);
    } else {
      setAudioNotice(res.error || 'Failed to email call recording.');
    }
    setTimeout(() => setAudioNotice(null), 3500);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      log.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.callerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.rationale.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesVerdict = verdictFilter === 'ALL' || log.verdict === verdictFilter;
    const matchesRiskLevel = riskLevelFilter === 'ALL' || log.riskLevel === riskLevelFilter;

    return matchesSearch && matchesVerdict && matchesRiskLevel;
  });

  const filteredRecordings = recordings.filter((r) => {
    return (
      searchTerm.trim() === '' ||
      r.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDurationSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Segmented Switcher: Call Events vs Saved Recordings */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: 4,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <button
          onClick={() => {
            CapacitorService.triggerHapticFeedback();
            setActiveSubTab('LOGS');
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 700,
            background: activeSubTab === 'LOGS' ? 'var(--accent-gradient)' : 'transparent',
            color: activeSubTab === 'LOGS' ? '#fff' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.2s'
          }}
        >
          <Phone size={14} />
          <span>Screened Calls ({logs.length})</span>
        </button>

        <button
          onClick={() => {
            CapacitorService.triggerHapticFeedback();
            setActiveSubTab('RECORDINGS');
            loadRecordings();
          }}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 700,
            background: activeSubTab === 'RECORDINGS' ? 'var(--accent-gradient)' : 'transparent',
            color: activeSubTab === 'RECORDINGS' ? '#fff' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.2s'
          }}
        >
          <Radio size={14} color={recordings.length > 0 ? '#f87171' : undefined} />
          <span>Call Recordings ({recordings.length})</span>
        </button>
      </div>

      {audioNotice && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid var(--accent-glow)',
            fontSize: '0.78rem',
            color: '#e2e8f0',
            textAlign: 'center',
            fontWeight: 600
          }}
        >
          {audioNotice}
        </div>
      )}

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          color="var(--text-muted)"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          placeholder={activeSubTab === 'LOGS' ? 'Search by phone, name, or keywords...' : 'Search recordings by phone or file...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px 10px 38px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem'
          }}
        />
      </div>

      {/* ────────────────────────────────────────────────────────────────
          VIEW 1: SCREENED CALL EVENTS
         ──────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'LOGS' && (
        <>
          {/* Filter Pills: Verdict */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {['ALL', 'REJECT', 'SILENCE', 'ALLOW'].map((v) => (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: verdictFilter === v ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: verdictFilter === v ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: verdictFilter === v ? 'var(--accent-glow)' : 'var(--border-subtle)'
                }}
              >
                {v === 'ALL' ? 'All Calls' : v === 'REJECT' ? 'Blocked' : v === 'SILENCE' ? 'Silenced' : 'Allowed'}
              </button>
            ))}
          </div>

          {/* Filter Pills: Risk Level */}
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginRight: 4 }}>
              RISK:
            </span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'CRITICAL_SPAM', label: 'Critical' },
              { id: 'SUSPICIOUS', label: 'Suspicious' },
              { id: 'LOW', label: 'Low' },
              { id: 'SAFE', label: 'Safe' },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRiskLevelFilter(r.id)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  background: riskLevelFilter === r.id ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                  color: riskLevelFilter === r.id ? 'var(--accent-glow)' : 'var(--text-muted)',
                  border: '1px solid',
                  borderColor: riskLevelFilter === r.id ? 'var(--accent-glow)' : 'rgba(255, 255, 255, 0.08)'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {filteredLogs.length} Screened Events
            </span>
            {logs.length > 0 && (
              <button
                onClick={onClearAll}
                style={{ fontSize: '0.75rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Trash2 size={13} /> Clear History
              </button>
            )}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
              <ShieldPlus size={36} color="var(--color-safe)" style={{ margin: '0 auto 10px', opacity: 0.85 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>No Screened Calls Recorded</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                When a call arrives, AegisCall evaluates the number and logs the AI verdict and action here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="glass-card responsive-call-card"
                  style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div onClick={() => onSelectLog(log)} style={{ cursor: 'pointer', flex: 1 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>
                        {log.callerName}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-glow)', marginTop: 2 }}>
                        {log.phoneNumber}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <RiskBadge level={log.riskLevel} verdict={log.verdict} score={log.riskScore} />
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Threat / Biometric Badges */}
                  {(log.metadata?.deepfakeMetrics?.syntheticArtifactsDetected || log.rationale?.toLowerCase().includes('digital arrest') || log.metadata?.detectedKeywords?.includes('digital arrest')) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0' }}>
                      {log.metadata?.deepfakeMetrics?.syntheticArtifactsDetected && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.16)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          🤖 Deepfake Voice Clone
                        </span>
                      )}
                      {(log.rationale?.toLowerCase().includes('digital arrest') || log.metadata?.detectedKeywords?.includes('digital arrest')) && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(220, 38, 38, 0.22)', color: '#fca5a5', border: '1px solid rgba(220, 38, 38, 0.5)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          🚨 Digital Arrest Scam
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    onClick={() => onSelectLog(log)}
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      cursor: 'pointer'
                    }}
                  >
                    {log.rationale}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          CapacitorService.triggerHapticFeedback();
                          CapacitorService.makeCall(log.phoneNumber);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: 'var(--color-safe)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="Call Number"
                      >
                        <Phone size={11} /> Call
                      </button>

                      {log.verdict !== 'REJECT' && (
                        <button
                          onClick={() => {
                            CapacitorService.triggerHapticFeedback();
                            onAddRule(log.phoneNumber, 'REJECT', `Block ${log.callerName || log.phoneNumber}`);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: 'var(--color-danger)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Block this number"
                        >
                          <ShieldX size={11} /> Block
                        </button>
                      )}

                      {log.verdict !== 'ALLOW' && (
                        <button
                          onClick={() => {
                            CapacitorService.triggerHapticFeedback();
                            onAddRule(log.phoneNumber, 'ALLOW', `Allow ${log.callerName || log.phoneNumber}`);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: 'var(--accent-glow)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Whitelist this number"
                        >
                          <ShieldPlus size={11} /> Whitelist
                        </button>
                      )}

                      <button
                        onClick={() => handleEmailCallLog(log)}
                        disabled={emailingId === log.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#38bdf8',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="Forward screening report & transcript to your email"
                      >
                        <Mail size={11} className={emailingId === log.id ? 'spin' : ''} />
                        <span>{emailingId === log.id ? 'Sending...' : 'Email'}</span>
                      </button>
                    </div>

                    <button
                      onClick={() => onDeleteLog(log.id)}
                      style={{ color: 'var(--text-muted)', padding: 4 }}
                      title="Delete log"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ────────────────────────────────────────────────────────────────
          VIEW 2: SAVED CALL RECORDINGS PLAYER & BROWSER
         ──────────────────────────────────────────────────────────────── */}
      {activeSubTab === 'RECORDINGS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {filteredRecordings.length} Audio Recordings
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-safe)', fontWeight: 600 }}>
              📁 Saved to Android Recordings / Music
            </span>
          </div>

          {filteredRecordings.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
              <FileAudio size={36} color="var(--accent-glow)" style={{ margin: '0 auto 10px', opacity: 0.85 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>No Call Recordings Found</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                During any active phone call, tap <strong>Record</strong> to capture high-definition AAC audio. Recordings automatically save to your phone's public library.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredRecordings.map((rec) => {
                const isPlaying = playingId === rec.id;
                return (
                  <div
                    key={rec.id}
                    className="glass-card"
                    style={{
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      border: isPlaying ? '1px solid var(--accent-glow)' : '1px solid var(--border-subtle)',
                      boxShadow: isPlaying ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Play/Pause Button */}
                        <button
                          onClick={() => handleTogglePlay(rec)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: isPlaying ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: isPlaying ? '0 0 14px rgba(99, 102, 241, 0.5)' : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                        </button>

                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>
                            {rec.phoneNumber}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(rec.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'rgba(255, 255, 255, 0.08)',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--accent-glow)'
                          }}
                        >
                          <Clock size={11} />
                          <span>{formatDurationSec(rec.durationSeconds || 0)}</span>
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 3 }}>
                          {formatFileSize(rec.fileSizeBytes || 0)}
                        </div>
                      </div>
                    </div>

                    {/* Extreme Feature: In-line Voicemail & Recording Audio Player with Speed Controls */}
                    {isPlaying && (
                      <div style={{ marginTop: 8 }}>
                        <VoicemailAudioPlayer
                          durationSeconds={rec.durationSeconds || 24}
                          callerName={rec.phoneNumber}
                          transcription="AegisCall encrypted local call recording archive."
                        />
                      </div>
                    )}

                    {/* File Path & Email/Delete Action */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          maxWidth: '65%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={rec.filePath}
                      >
                        📁 {rec.fileName}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleEmailRecording(rec)}
                          disabled={emailingId === rec.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            color: '#38bdf8',
                            fontSize: '0.70rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Forward audio recording to email"
                        >
                          <Mail size={11} className={emailingId === rec.id ? 'spin' : ''} />
                          <span>{emailingId === rec.id ? 'Sending...' : 'Email Audio'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRecording(rec.filePath)}
                          style={{ color: 'var(--color-danger)', padding: 4 }}
                          title="Delete recording"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
