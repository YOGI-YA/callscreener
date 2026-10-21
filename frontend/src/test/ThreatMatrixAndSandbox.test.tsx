import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThreatMatrixAnalytics } from '../components/ThreatMatrixAnalytics';
import { CallSimulatorSandbox, PRELOADED_SCENARIOS } from '../components/CallSimulatorSandbox';

describe('ThreatMatrixAnalytics & CallSimulatorSandbox Component Tests', () => {
  it('renders ThreatMatrixAnalytics with radar, heatmap and KPIs', () => {
    const mockLogs: any[] = [
      { id: '1', phoneNumber: '+18001112222', verdict: 'REJECT', riskScore: 92, category: 'PHISHING_SCAM', stirShakenStatus: 'FAILED_SPOOF' },
      { id: '2', phoneNumber: '+12065551234', verdict: 'ALLOW', riskScore: 10, category: 'DELIVERY_SERVICE', stirShakenStatus: 'VERIFIED_A' }
    ];

    render(<ThreatMatrixAnalytics logs={mockLogs} />);

    expect(screen.getByTestId('threat-matrix-analytics')).toBeInTheDocument();
    expect(screen.getByText('Threat Matrix Intelligence')).toBeInTheDocument();
    expect(screen.getByText(/STIR\/SHAKEN Attestation Verification Radar/i)).toBeInTheDocument();
    expect(screen.getByText(/24-Hour Attack Density Wave/i)).toBeInTheDocument();
    expect(screen.getByText('Mitigation Rate')).toBeInTheDocument();
    expect(screen.getByText('Bank & IRS Impersonation')).toBeInTheDocument();

    // Time window selection
    const btn7D = screen.getByText('7D');
    fireEvent.click(btn7D);
    expect(btn7D).toBeInTheDocument();
  });

  it('renders CallSimulatorSandbox with preloaded adversarial scenarios and triggers launch', () => {
    const onLaunch = vi.fn();
    render(<CallSimulatorSandbox onLaunchLiveCall={onLaunch} />);

    expect(screen.getByTestId('call-simulator-sandbox')).toBeInTheDocument();
    expect(screen.getByText('Adversarial AI Call Sandbox')).toBeInTheDocument();
    expect(screen.getByText('IRS Arrest Warrant Scam')).toBeInTheDocument();
    expect(screen.getByText('Bank Fraud & OTP Extraction')).toBeInTheDocument();

    // Switch scenario
    const bankChip = screen.getByText('Bank Fraud & OTP Extraction');
    fireEvent.click(bankChip);
    expect(screen.getByText(/Chase Fraud Prevention/i)).toBeInTheDocument();

    // Launch in phone HUD
    const launchBtn = screen.getByTitle(/Launch this scenario in full-screen phone call overlay/i);
    fireEvent.click(launchBtn);
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bank Fraud & OTP Extraction'
      })
    );
  });
});
