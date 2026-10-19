import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import { CapacitorService } from '../services/capacitorService';
import { IncomingCallPayload, ScreeningResult } from '../types';

describe('Caller End Audio Isolation & Local Downlink Silencing', () => {
  const mockCall: IncomingCallPayload = {
    phoneNumber: '+14155552671',
    callerName: 'National Bank Fraud Team',
    callPresentationMode: 'ALLOWED',
    location: 'San Francisco, CA',
    carrier: 'Verizon Wireless',
    simulatedAudioTranscript: 'Hello, this is fraud verification calling about your recent charge.',
    initialPhase: 'SCREENING'
  };

  const mockResult: ScreeningResult = {
    id: 'test-call-1',
    phoneNumber: '+14155552671',
    callerName: 'National Bank Fraud Team',
    verdict: 'ALLOW',
    riskScore: 20,
    riskLevel: 'LOW',
    category: 'VERIFIED_CONTACT',
    confidence: 0.95,
    rationale: 'Verified banking institution caller.',
    engine: 'LLM_AI',
    latencyMs: 120,
    timestamp: new Date().toISOString(),
    suggestedActions: {
      disallowCall: false,
      silenceCall: false,
      rejectCall: false,
      skipCallLog: false,
      skipNotification: false
    }
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults mock audio routing state to local silence and caller-end transmission', async () => {
    const route = await CapacitorService.getAudioRoutingState();
    expect(route.isListenIn).toBe(false);
    expect(route.isSuppressed).toBe(true);
    expect(route.transmittingToCaller).toBe(true);
  });

  it('renders caller-end audio indicator and our-end silenced badge by default in IncomingCallOverlay', async () => {
    render(
      <IncomingCallOverlay
        incomingCall={mockCall}
        screeningResult={mockResult}
        isProcessing={false}
        onDismiss={() => {}}
        onOverrideAction={() => {}}
      />
    );

    // Audio status bar should verify caller end active and our end silenced
    expect(screen.getByText(/Uplink \(Caller Line\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Speaker: Silenced/i)).toBeInTheDocument();
  });

  it('toggles listen-in monitoring cleanly without unmuting user microphone towards caller', async () => {
    const setListenInSpy = vi.spyOn(CapacitorService, 'setListenIn');

    render(
      <IncomingCallOverlay
        incomingCall={mockCall}
        screeningResult={mockResult}
        isProcessing={false}
        onDismiss={() => {}}
        onOverrideAction={() => {}}
      />
    );

    const toggleBtn = screen.getByTitle(/Click for private listen-in/i);
    expect(toggleBtn).toBeInTheDocument();

    // Tap to listen in
    fireEvent.click(toggleBtn);
    expect(setListenInSpy).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(screen.getByText(/Private Listen: ON/i)).toBeInTheDocument();
    });

    // Tap again to re-silence our end
    fireEvent.click(toggleBtn);
    expect(setListenInSpy).toHaveBeenCalledWith(false);

    await waitFor(() => {
      expect(screen.getByText(/Speaker: Silenced/i)).toBeInTheDocument();
    });
  });

  it('displays explicit (Speaking to Caller) badge on AI dialogue responses', async () => {
    render(
      <IncomingCallOverlay
        incomingCall={mockCall}
        screeningResult={mockResult}
        isProcessing={false}
        onDismiss={() => {}}
        onOverrideAction={() => {}}
      />
    );

    // Click a smart action chip to have AI respond to caller
    const chipBtn = await screen.findByRole('button', { name: /Who is calling/i });
    fireEvent.click(chipBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Speaking to Caller/i)[0]).toBeInTheDocument();
    });
  });
});
