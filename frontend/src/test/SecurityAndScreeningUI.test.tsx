import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StirShakenBadge } from '../components/RiskBadge';
import { CallModal } from '../components/CallModal';
import { IncomingCallOverlay } from '../components/IncomingCallOverlay';
import { ScreeningResult, IncomingCallPayload } from '../types';

describe('Security and Call Screening Frontend Component Tests', () => {

  describe('StirShakenBadge Component', () => {
    it('renders Level A verified badge with full attestation', () => {
      render(<StirShakenBadge status="VERIFIED_A" />);
      expect(screen.getByText(/STIR\/SHAKEN Verified \(A\)/i)).toBeInTheDocument();
    });

    it('renders Level B partial attestation badge', () => {
      render(<StirShakenBadge status="PARTIAL_B" />);
      expect(screen.getByText(/STIR\/SHAKEN Partial \(B\)/i)).toBeInTheDocument();
    });

    it('renders carrier spoof alert for failed attestation', () => {
      render(<StirShakenBadge status="FAILED_SPOOF" />);
      expect(screen.getByText(/Carrier Spoofed \(FAILED\)/i)).toBeInTheDocument();
    });

    it('renders unverified badge when status is NOT_VERIFIED', () => {
      render(<StirShakenBadge status="NOT_VERIFIED" />);
      expect(screen.getByText(/Carrier Unverified/i)).toBeInTheDocument();
    });

    it('supports compact badge display mode', () => {
      render(<StirShakenBadge status="VERIFIED_A" compact />);
      expect(screen.getByText('Verified A')).toBeInTheDocument();
    });
  });

  describe('CallModal PII Redaction & Threat Radar', () => {
    const mockLog: ScreeningResult = {
      id: 'log-pii-1',
      phoneNumber: '+14155552671',
      callerName: 'Verification Team with Card 4111 2222 3333 4444',
      verdict: 'ALLOW',
      riskScore: 35,
      riskLevel: 'LOW',
      category: 'VERIFIED_CONTACT',
      confidence: 0.92,
      rationale: 'Caller provided one-time pin OTP is 492812 for verification.',
      engine: 'LLM_AI',
      latencyMs: 140,
      timestamp: new Date().toISOString(),
      stirShakenStatus: 'VERIFIED_A',
      metadata: {
        spoofProbability: 0.15,
        detectedKeywords: ['urgent', 'verification'],
        stirShakenAttestation: 'A'
      },
      dialogueTurns: [
        {
          sender: 'CALLER',
          text: 'My social security number is 123-45-6789 and my card is 4111-2222-3333-4444',
          timestamp: '10:00 AM'
        },
        {
          sender: 'AI_ASSISTANT',
          text: 'Thank you, your details have been screened securely.',
          timestamp: '10:01 AM'
        }
      ],
      suggestedActions: {
        disallowCall: false,
        silenceCall: false,
        rejectCall: false,
        skipCallLog: false,
        skipNotification: false
      }
    };

    it('masks credit cards, SSN, and OTPs by default when modal opens', () => {
      render(<CallModal log={mockLog} onClose={vi.fn()} onAddRule={vi.fn()} />);

      // Verify PII is masked in caller name and rationale
      expect(screen.getAllByText(/4111 \*\*\*\* \*\*\*\* 4444/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\[REDACTED_OTP\]/).length).toBeGreaterThan(0);

      // Verify conversation dialogue turn has SSN redacted
      expect(screen.getByText(/\[REDACTED_SSN\]/)).toBeInTheDocument();
      expect(screen.getByText(/Zero-Trust PII Redaction Active/i)).toBeInTheDocument();
    });

    it('toggles to reveal raw unmasked data and re-masks on click', () => {
      render(<CallModal log={mockLog} onClose={vi.fn()} onAddRule={vi.fn()} />);

      const toggleBtn = screen.getByRole('button', { name: /Reveal Raw/i });
      fireEvent.click(toggleBtn);

      // Raw unmasked text is now visible
      expect(screen.getAllByText(/OTP is 492812/).length).toBeGreaterThan(0);
      expect(screen.getByText(/123-45-6789/)).toBeInTheDocument();
      expect(screen.getByText(/Raw Transcript View/i)).toBeInTheDocument();

      // Click again to re-mask
      const maskBtn = screen.getByRole('button', { name: /Mask PII/i });
      fireEvent.click(maskBtn);

      expect(screen.getAllByText(/\[REDACTED_OTP\]/).length).toBeGreaterThan(0);
      expect(screen.getByText(/\[REDACTED_SSN\]/)).toBeInTheDocument();
    });

    it('renders Live Threat Breakdown & Radar with detected triggers', () => {
      render(<CallModal log={mockLog} onClose={vi.fn()} onAddRule={vi.fn()} />);

      expect(screen.getByText(/Live Threat Breakdown & Radar/i)).toBeInTheDocument();
      expect(screen.getByText(/Spoof Probability: 15%/i)).toBeInTheDocument();
      expect(screen.getByText(/⚠️ urgent/i)).toBeInTheDocument();
      expect(screen.getByText(/⚠️ verification/i)).toBeInTheDocument();
    });
  });

  describe('IncomingCallOverlay Audio Isolation & Quick Replies', () => {
    const mockCall: IncomingCallPayload = {
      phoneNumber: '+919876543210',
      callerName: 'Express Courier Delivery',
      location: 'Bengaluru, Karnataka',
      carrier: 'Airtel 5G',
      simulatedAudioTranscript: 'Hello I am outside with your parcel',
      initialPhase: 'SCREENING',
      stirShakenStatus: 'VERIFIED_A'
    };

    it('renders caller-end audio indicator and mic isolation badge', () => {
      render(
        <IncomingCallOverlay
          incomingCall={mockCall}
          screeningResult={null}
          isProcessing={false}
          onDismiss={vi.fn()}
          onOverrideAction={vi.fn()}
        />
      );

      expect(screen.getByText(/Uplink \(Caller Line\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Mic Isolated/i)).toBeInTheDocument();
      expect(screen.getByText(/Zero-Leakage Audio/i)).toBeInTheDocument();
    });

    it('toggles private listen-in monitoring state on click', () => {
      render(
        <IncomingCallOverlay
          incomingCall={mockCall}
          screeningResult={null}
          isProcessing={false}
          onDismiss={vi.fn()}
          onOverrideAction={vi.fn()}
        />
      );

      const listenBtn = screen.getByRole('button', { name: /Speaker: Silenced/i });
      expect(listenBtn).toBeInTheDocument();

      fireEvent.click(listenBtn);
      expect(screen.getByText(/Private Listen: ON/i)).toBeInTheDocument();
    });

    it('displays smart action chips for user to prompt AI', () => {
      render(
        <IncomingCallOverlay
          incomingCall={mockCall}
          screeningResult={null}
          isProcessing={false}
          onDismiss={vi.fn()}
          onOverrideAction={vi.fn()}
        />
      );

      expect(screen.getByText(/Tap to have AI speak to caller/i)).toBeInTheDocument();
      expect(screen.getByText(/Who is calling\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Leave at front door/i)).toBeInTheDocument();
    });
  });
});
