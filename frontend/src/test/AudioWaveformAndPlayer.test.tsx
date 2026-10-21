import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioWaveformHUD } from '../components/AudioWaveformHUD';
import { VoicemailAudioPlayer } from '../components/VoicemailAudioPlayer';

describe('AudioWaveformHUD & VoicemailAudioPlayer Component Tests', () => {
  it('renders AudioWaveformHUD with active caller audio and mic muted badge', () => {
    render(
      <AudioWaveformHUD
        activeSpeaker="CALLER"
        isListening={true}
        uplinkSilenced={true}
        customLabel="Caller Inbound Stream"
      />
    );

    expect(screen.getByTestId('audio-waveform-hud')).toBeInTheDocument();
    expect(screen.getByText('Caller Inbound Stream')).toBeInTheDocument();
    expect(screen.getByText('Mic Muted')).toBeInTheDocument();
    expect(screen.getByText(/Acoustic Echo Guard Active/i)).toBeInTheDocument();
  });

  it('renders AudioWaveformHUD for AI Assistant with custom label and frequency tracks', () => {
    render(
      <AudioWaveformHUD
        activeSpeaker="AI_ASSISTANT"
        isListening={true}
        uplinkSilenced={false}
        customLabel="Aegis AI Synthesizer"
      />
    );

    expect(screen.getByText('Aegis AI Synthesizer')).toBeInTheDocument();
    expect(screen.queryByText('Mic Muted')).toBeNull();
  });

  it('renders VoicemailAudioPlayer with caller info, speed controls and scrubber', () => {
    const onToggle = vi.fn();
    render(
      <VoicemailAudioPlayer
        durationSeconds={30}
        callerName="Dr. Robert Smith"
        transcription="Confirming your medical appointment for tomorrow at 10 AM."
        piiMasked={true}
        onTogglePiiMask={onToggle}
      />
    );

    expect(screen.getByTestId('voicemail-audio-player')).toBeInTheDocument();
    expect(screen.getByText(/Dr. Robert Smith • Voicemail Recording/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirming your medical appointment/i)).toBeInTheDocument();
    expect(screen.getByText('PII Redacted')).toBeInTheDocument();

    // Toggle PII mask
    fireEvent.click(screen.getByText('PII Redacted'));
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Speed buttons exist
    const speed2x = screen.getByText('2x');
    expect(speed2x).toBeInTheDocument();
    fireEvent.click(speed2x);
    expect(speed2x.className).toContain('active');
  });

  it('toggles Play and Pause on VoicemailAudioPlayer', () => {
    render(
      <VoicemailAudioPlayer
        durationSeconds={20}
        callerName="Chase Security"
      />
    );

    const playBtn = screen.getByTitle('Play');
    expect(playBtn).toBeInTheDocument();
    fireEvent.click(playBtn);
    expect(screen.getByTitle('Pause')).toBeInTheDocument();
  });
});
