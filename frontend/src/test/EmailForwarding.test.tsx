import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { App } from '../App';
import { ApiService } from '../services/api';
import { CapacitorService } from '../services/capacitorService';

describe('Recording Mail Forwarding & Call Audio Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('aegis_screener_api_url', 'http://localhost:4000');
    localStorage.setItem(
      'aegis_local_call_logs',
      JSON.stringify([
        {
          id: 'test-call-log-1',
          phoneNumber: '+18005550199',
          callerName: 'IRS Department Verification',
          verdict: 'REJECT',
          riskScore: 94,
          riskLevel: 'HIGH_RISK',
          category: 'PHISHING_SCAM',
          confidence: 0.95,
          rationale: 'Caller demanded immediate gift card settlement.',
          engine: 'LLM_AI',
          latencyMs: 145,
          timestamp: new Date().toISOString(),
          suggestedActions: {
            disallowCall: true,
            silenceCall: false,
            rejectCall: true,
            skipCallLog: false,
            skipNotification: true,
          },
        },
      ])
    );
  });

  it('navigates to settings and renders recording mail forwarding controls', async () => {
    render(<App />);

    // Switch to Settings tab
    const settingsTabBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsTabBtn);

    // Verify Recording Mail Forwarding section is rendered
    expect(await screen.findByText(/Recording Mail Forwarding/i)).toBeInTheDocument();
    expect(screen.getByText(/Auto-forward HD call audio & transcripts to inbox/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your-name@domain.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Test Email/i })).toBeInTheDocument();
  });

  it('triggers test email delivery from Settings tab', async () => {
    const sendTestEmailSpy = vi.spyOn(ApiService, 'sendTestEmail').mockResolvedValue({
      success: true,
    });

    render(<App />);

    const settingsTabBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsTabBtn);

    const emailInput = await screen.findByPlaceholderText(/your-name@domain.com/i);
    fireEvent.change(emailInput, { target: { value: 'alerts@enterprise.org' } });

    const testBtn = screen.getByRole('button', { name: /Send Test Email/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(sendTestEmailSpy).toHaveBeenCalledWith('alerts@enterprise.org');
    });
  });

  it('displays forward to email action on call history items', async () => {
    render(<App />);

    // Switch to History tab
    const historyTabBtn = screen.getByRole('button', { name: /History/i });
    fireEvent.click(historyTabBtn);

    // Verify History view loaded and the email forward action button is present
    expect(await screen.findByPlaceholderText(/Search by phone/i)).toBeInTheDocument();

    const emailButton = await screen.findByTitle(/Forward screening report & transcript to your email/i);
    expect(emailButton).toBeInTheDocument();
  });

  it('handles bridge call to forwardRecordingEmail gracefully on web fallback', async () => {
    const res = await CapacitorService.forwardRecordingEmail({
      filePath: '/mock/path/Call_+1234567890_20261017.m4a',
      phoneNumber: '+1234567890',
      durationSeconds: 42,
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain('Mock email forward');
  });
});
