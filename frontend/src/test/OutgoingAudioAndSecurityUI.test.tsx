import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutgoingAudioMonitor } from '../components/OutgoingAudioMonitor';
import { DtmfKeypadModal } from '../components/DtmfKeypadModal';
import { TamperEvidentAuditBadge } from '../components/TamperEvidentAuditBadge';

describe('Outgoing Audio Telemetry, DTMF Uplink & Tamper-Audit UI Tests', () => {
  describe('OutgoingAudioMonitor', () => {
    it('renders caller-end audio uplink indicators and local mic isolation badge', () => {
      render(
        <OutgoingAudioMonitor
          isCallActive={true}
          isAiSpeaking={true}
          uplinkVolumeDb={-16}
          downlinkVolumeDb={-28}
          comfortNoiseActive={false}
          isUserMicMuted={true}
        />
      );

      expect(screen.getByTestId('outgoing-audio-monitor')).toBeDefined();
      expect(screen.getByTestId('audio-isolation-badge').textContent).toContain('Local Mic Silenced');
      expect(screen.getByTestId('uplink-db-value').textContent).toContain('-16 dBFS');
    });

    it('renders comfort noise indicator when active during AI reasoning gaps', () => {
      render(
        <OutgoingAudioMonitor
          isCallActive={true}
          isAiSpeaking={false}
          comfortNoiseActive={true}
          isUserMicMuted={true}
        />
      );

      const cngBadge = screen.getByTestId('comfort-noise-indicator');
      expect(cngBadge).toBeDefined();
      expect(cngBadge.textContent).toContain('Comfort Noise Active');
    });

    it('triggers microphone unmute toggle callback', () => {
      const toggleFn = vi.fn();
      render(
        <OutgoingAudioMonitor
          isCallActive={true}
          isAiSpeaking={false}
          isUserMicMuted={true}
          onToggleMute={toggleFn}
        />
      );

      const btn = screen.getByTestId('toggle-isolation-button');
      fireEvent.click(btn);
      expect(toggleFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('DtmfKeypadModal', () => {
    it('renders keypad digits and transmits tones upon click', () => {
      const onSendTone = vi.fn();
      const onClose = vi.fn();

      render(
        <DtmfKeypadModal
          isOpen={true}
          onClose={onClose}
          onSendTone={onSendTone}
        />
      );

      expect(screen.getByTestId('dtmf-keypad-modal')).toBeDefined();
      const key1 = screen.getByTestId('dtmf-key-1');
      fireEvent.click(key1);
      expect(onSendTone).toHaveBeenCalledWith('1');

      const keyHash = screen.getByTestId('dtmf-key-#');
      fireEvent.click(keyHash);
      expect(onSendTone).toHaveBeenCalledWith('#');

      expect(screen.getByTestId('dtmf-sequence-display').textContent).toBe('1#');
    });

    it('closes modal on close button click', () => {
      const onClose = vi.fn();
      render(<DtmfKeypadModal isOpen={true} onClose={onClose} onSendTone={() => {}} />);

      const closeBtn = screen.getByTestId('close-dtmf-modal');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('TamperEvidentAuditBadge', () => {
    it('renders cryptographic badge and opens verification modal', () => {
      render(
        <TamperEvidentAuditBadge
          callId="call_123"
          blockIndex={4}
          blockHash="abcdef1234567890abcdef1234567890"
          previousHash="11223344556677889900112233445566"
          isVerified={true}
        />
      );

      const badge = screen.getByTestId('tamper-badge-call_123');
      expect(badge.textContent).toContain('Block #4');
      expect(badge.textContent).toContain('Verified');

      // Click to open modal
      fireEvent.click(badge);
      expect(screen.getByTestId('audit-verification-modal')).toBeDefined();
      expect(screen.getByTestId('audit-current-hash').textContent).toContain('abcdef123456');

      // Click verify button
      const verifyBtn = screen.getByTestId('verify-audit-chain-button');
      fireEvent.click(verifyBtn);
    });
  });
});
