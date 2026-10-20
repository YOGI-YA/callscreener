import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, ShieldCheck, Download, Sparkles } from 'lucide-react';

export interface VoicemailAudioPlayerProps {
  durationSeconds?: number;
  callerName?: string;
  transcription?: string;
  piiMasked?: boolean;
  onTogglePiiMask?: () => void;
  audioUrl?: string;
}

export const VoicemailAudioPlayer: React.FC<VoicemailAudioPlayerProps> = ({
  durationSeconds = 24,
  callerName = 'Caller Voicemail',
  transcription,
  piiMasked = true,
  onTogglePiiMask,
  audioUrl
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [wavePeaks] = useState<number[]>(() =>
    Array.from({ length: 32 }, (_, i) => {
      const bell = Math.sin((i / 32) * Math.PI) * 0.8 + 0.2;
      return Math.round((bell * (0.4 + Math.random() * 0.6)) * 100);
    })
  );

  const scrubberRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.1 * playbackSpeed;
          if (next >= durationSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, durationSeconds, playbackSpeed]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSkip = (seconds: number) => {
    setCurrentTime((prev) => Math.max(0, Math.min(durationSeconds, prev + seconds)));
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTime(ratio * durationSeconds);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = Math.min(100, (currentTime / (durationSeconds || 1)) * 100);

  return (
    <div className="voicemail-player-card" data-testid="voicemail-audio-player">
      {/* Header with caller & speed */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} color="var(--accent-glow)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {callerName} • Voicemail Recording
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[1, 1.25, 1.5, 2].map((speed) => (
            <button
              key={speed}
              className={`voicemail-speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
              onClick={() => setPlaybackSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Waveform Scrub Preview */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          height: 38,
          cursor: 'pointer',
          padding: '4px 0'
        }}
        onClick={handleScrubberClick}
        title="Click waveform to scrub audio"
      >
        {wavePeaks.map((peak, idx) => {
          const barPercent = (idx / wavePeaks.length) * 100;
          const isPlayed = barPercent <= progressPercent;
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                height: `${Math.max(6, (peak / 100) * 36)}px`,
                borderRadius: 99,
                background: isPlayed
                  ? 'linear-gradient(180deg, var(--accent-cyan) 0%, var(--accent-primary) 100%)'
                  : 'rgba(255, 255, 255, 0.12)',
                transition: 'background 0.15s ease'
              }}
            />
          );
        })}
      </div>

      {/* Scrubber Bar */}
      <div
        ref={scrubberRef}
        className="voicemail-scrubber-track"
        onClick={handleScrubberClick}
        role="slider"
        aria-valuenow={currentTime}
        aria-valuemin={0}
        aria-valuemax={durationSeconds}
      >
        <div className="voicemail-scrubber-fill" style={{ width: `${progressPercent}%` }}>
          <div className="voicemail-scrubber-thumb" />
        </div>
      </div>

      {/* Timestamps */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(durationSeconds)}</span>
      </div>

      {/* Primary Controls Row */}
      <div className="voicemail-controls-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => handleSkip(-5)}
            style={{ color: 'var(--text-secondary)', padding: 6 }}
            title="Rewind 5s"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={handlePlayPause}
            className="voicemail-play-btn"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>

          <button
            onClick={() => handleSkip(5)}
            style={{ color: 'var(--text-secondary)', padding: 6 }}
            title="Forward 5s"
          >
            <RotateCw size={16} />
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            style={{ color: isMuted ? '#ef4444' : 'var(--text-secondary)', padding: 6 }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {/* PII Masking Status & Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onTogglePiiMask && (
            <button
              onClick={onTogglePiiMask}
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: piiMasked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: piiMasked ? '#34d399' : '#f87171',
                border: '1px solid ' + (piiMasked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)')
              }}
            >
              <ShieldCheck size={11} style={{ display: 'inline', marginRight: 3 }} />
              {piiMasked ? 'PII Redacted' : 'PII Unmasked'}
            </button>
          )}

          {audioUrl && (
            <a
              href={audioUrl}
              download="voicemail.wav"
              style={{ color: 'var(--text-secondary)', padding: 6 }}
              title="Download recording"
            >
              <Download size={15} />
            </a>
          )}
        </div>
      </div>

      {/* Transcription Preview if available */}
      {transcription && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.74rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.4
          }}
        >
          <strong style={{ color: 'var(--accent-glow)' }}>Transcript: </strong>
          {transcription}
        </div>
      )}
    </div>
  );
};
