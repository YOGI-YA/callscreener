import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import { CallModal } from '../components/CallModal';
import { CapacitorService } from '../services/capacitorService';
import { IncomingCallPayload, ScreeningResult } from '../types';

describe('Mobile Viewport & In-Call Screening Overlay Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
    vi.spyOn(CapacitorService, 'triggerHapticFeedback').mockResolvedValue();
    vi.spyOn(CapacitorService, 'getScreeningMode').mockResolvedValue({ mode: 'AI_ASSISTANT' });
    vi.spyOn(CapacitorService, 'screenCallWithAi').mockResolvedValue({ success: true });
    vi.spyOn(CapacitorService, 'answerCall').mockResolvedValue({ success: true });
    vi.spyOn(CapacitorService, 'pickupCall').mockResolvedValue({ success: true });
  });

  const sampleCall: IncomingCallPayload = {
    phoneNumber: '+1-555-888-9999',
    callerName: 'National Bank Fraud Alert',
    callPresentationMode: 'ALLOWED',
    simulatedAudioTranscript: 'Hello, your security OTP is 849201. Please confirm it immediately.'
  };

  it('renders incoming call overlay with sticky action buttons and valid mobile layout', () => {
    render(
      <IncomingCallOverlay
        incomingCall={sampleCall}
        screeningResult={null}
        isProcessing={false}
        onDismiss={vi.fn()}
        onOverrideAction={vi.fn()}
      />
    );

    expect(screen.getByText('Incoming Call')).toBeInTheDocument();
    expect(screen.getByText('National Bank Fraud Alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Screen Call with AI/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Answer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decline/i })).toBeInTheDocument();
  });

  it('detects caller stated OTP in real time and renders copyable OTP pill', async () => {
    render(
      <IncomingCallOverlay
        incomingCall={{
          ...sampleCall,
          simulatedAudioTranscript: 'Your one-time passcode is 492019.'
        }}
        screeningResult={null}
        isProcessing={false}
        onDismiss={vi.fn()}
        onOverrideAction={vi.fn()}
      />
    );

    // Tap Screen Call with AI to start screening
    const screenBtn = screen.getByRole('button', { name: /Screen Call with AI/i });
    fireEvent.click(screenBtn);

    // AI Screener mode active
    expect(await screen.findByText(/AI Screener • Speaking to Caller/i)).toBeInTheDocument();

    // Fast-forward or wait for speech recognition simulation
    await waitFor(
      () => {
        expect(screen.getByText(/Caller Stated OTP:/i)).toBeInTheDocument();
      },
      { timeout: 4500 }
    );

    expect(screen.getByText('492019')).toBeInTheDocument();
    const copyBtn = screen.getByRole('button', { name: /Copy OTP/i });
    expect(copyBtn).toBeInTheDocument();

    // Verify copy button click
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    fireEvent.click(copyBtn);
    expect(writeTextSpy).toHaveBeenCalledWith('492019');
  });

  it('renders CallModal with masked OTP and toggleable reveal and copy controls', () => {
    const sampleLog: ScreeningResult = {
      id: 'log-otp-1',
      phoneNumber: '+1-555-123-4567',
      callerName: 'Chase Verification',
      riskScore: 78,
      riskLevel: 'CRITICAL_SPAM',
      verdict: 'REJECT',
      category: 'PHISHING_SCAM',
      confidence: 0.92,
      latencyMs: 140,
      rationale: 'Caller requested confirmation of OTP 773821 to cancel transaction.',
      timestamp: new Date().toISOString(),
      engine: 'FAST_LOCAL_FALLBACK',
      suggestedActions: {
        disallowCall: true,
        silenceCall: false,
        rejectCall: true,
        skipCallLog: false,
        skipNotification: false
      }
    };

    render(
      <CallModal
        log={sampleLog}
        onClose={vi.fn()}
        onAddRule={vi.fn()}
      />
    );

    expect(screen.getByText(/Detected Call Verification \/ OTP/i)).toBeInTheDocument();
    // Masked by default
    expect(screen.getByText(/•••• 21/)).toBeInTheDocument();

    // Reveal OTP
    const revealBtn = screen.getByRole('button', { name: /Reveal OTP/i });
    fireEvent.click(revealBtn);

    expect(screen.getByText('773821')).toBeInTheDocument();

    // Copy OTP
    const copySpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const copyBtn = screen.getByRole('button', { name: /Copy OTP/i });
    fireEvent.click(copyBtn);
    expect(copySpy).toHaveBeenCalledWith('773821');
  });
});
