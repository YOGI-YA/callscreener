import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import { SettingsTab } from '../components/SettingsTab';
import { CallLogsTab } from '../components/CallLogsTab';
import { CallModal } from '../components/CallModal';
import { ScreeningResult } from '../types';

describe('Responsive Layout Modes, Emergency Safe-Words & Fraud Reporting UI', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders layout mode toggle button in App header and allows switching', async () => {
    render(<App />);

    const toggleBtn = await screen.findByRole('button', { name: /toggle layout mode/i });
    expect(toggleBtn).toBeInTheDocument();

    // Click toggle to switch mode
    fireEvent.click(toggleBtn);
  });

  it('renders Emergency Safe-Word configuration card in SettingsTab', async () => {
    render(<SettingsTab roleGranted={true} onRefreshRole={vi.fn()} />);

    expect(screen.getByText(/Family Emergency Safe-Word \(SOS Voice Override\)/i)).toBeInTheDocument();
    expect(screen.getByText(/"falcon blue"/i)).toBeInTheDocument();
    expect(screen.getByText(/"code red"/i)).toBeInTheDocument();

    // Add a custom safe-word
    const input = screen.getByPlaceholderText(/Enter secret safe-word/i);
    fireEvent.change(input, { target: { value: 'code shadow 77' } });
    const addBtn = screen.getByTestId('add-safeword-btn');
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText(/Safe-word "code shadow 77" added!/i)).toBeInTheDocument();
    });
  });

  it('renders Security Alert Webhook Dispatcher card in SettingsTab', async () => {
    render(<SettingsTab roleGranted={true} onRefreshRole={vi.fn()} />);

    expect(screen.getByText(/Security Alert Webhook Dispatcher/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-time HMAC-signed notification pipeline/i)).toBeInTheDocument();
  });

  it('renders Export Report (CSV) button in CallLogsTab and triggers export', () => {
    const mockLogs: ScreeningResult[] = [
      {
        id: 'scr-1',
        phoneNumber: '+18005550199',
        callerName: 'Scam Bank Impersonator',
        verdict: 'REJECT',
        riskScore: 99,
        riskLevel: 'CRITICAL_SPAM',
        category: 'PHISHING_SCAM',
        confidence: 0.99,
        rationale: 'Digital arrest bank scam detected.',
        engine: 'LLM_AI',
        latencyMs: 120,
        timestamp: '2026-10-24T18:00:00.000Z',
        suggestedActions: {
          disallowCall: true,
          silenceCall: false,
          rejectCall: true,
          skipCallLog: false,
          skipNotification: true
        },
        metadata: {
          acousticBotTelemetry: {
            isRobocallBot: true,
            roboticCadenceScore: 90,
            spectralFlatnessScore: 85,
            soundboardConfidence: 0.95,
            audioFingerprintHash: 'ROBO-VOX-99887766'
          }
        }
      }
    ];

    render(
      <CallLogsTab
        logs={mockLogs}
        onDeleteLog={vi.fn()}
        onClearAll={vi.fn()}
        onSelectLog={vi.fn()}
        onAddRule={vi.fn()}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Export Report \(CSV\)/i });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);
    expect(screen.getByText(/National Fraud Complaint Report \(CSV\) downloaded!/i)).toBeInTheDocument();
  });

  it('renders AcousticBotBadge in CallModal when robocall bot telemetry is present', () => {
    const logWithBot: ScreeningResult = {
      id: 'scr-bot-1',
      phoneNumber: '+18884443322',
      callerName: 'Auto Robocall Bot',
      verdict: 'REJECT',
      riskScore: 95,
      riskLevel: 'CRITICAL_SPAM',
      category: 'ROBOCALL',
      confidence: 0.98,
      rationale: 'Pre-recorded soundboard robocall detected.',
      engine: 'LLM_AI',
      latencyMs: 80,
      timestamp: '2026-10-24T18:00:00.000Z',
      suggestedActions: {
        disallowCall: true,
        silenceCall: false,
        rejectCall: true,
        skipCallLog: false,
        skipNotification: true
      },
      metadata: {
        acousticBotTelemetry: {
          isRobocallBot: true,
          roboticCadenceScore: 88,
          spectralFlatnessScore: 80,
          soundboardConfidence: 0.92,
          audioFingerprintHash: 'ROBO-VOX-CADENCE-88'
        }
      }
    };

    render(
      <CallModal
        log={logWithBot}
        onClose={vi.fn()}
        onAddRule={vi.fn()}
      />
    );

    expect(screen.getByText(/🤖 Robocall Bot/i)).toBeInTheDocument();
    expect(screen.getByText(/88% synth/i)).toBeInTheDocument();
  });
});
