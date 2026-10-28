import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsTab } from '../components/SettingsTab';
import { CapacitorService } from '../services/capacitorService';

describe('24/7 Longevity & Battery Exemption UI Tests', () => {
  it('renders the 24/7 Longevity & Standby Protection card in SettingsTab', async () => {
    vi.spyOn(CapacitorService, 'checkBatteryOptimizationStatus').mockResolvedValue({
      isIgnoringBatteryOptimizations: false,
      isLongTermProtected: false
    });

    render(<SettingsTab roleGranted={true} onRefreshRole={vi.fn()} />);

    expect(await screen.findByText(/24\/7 Longevity & Standby Protection/i)).toBeInTheDocument();
    expect(screen.getByText(/Exemption Recommended/i)).toBeInTheDocument();
    expect(screen.getByText(/Continuous Multi-Day Screening:/i)).toBeInTheDocument();
  });

  it('triggers battery optimization exemption dialog when button is clicked', async () => {
    vi.spyOn(CapacitorService, 'checkBatteryOptimizationStatus').mockResolvedValue({
      isIgnoringBatteryOptimizations: false,
      isLongTermProtected: false
    });

    const requestSpy = vi.spyOn(CapacitorService, 'requestIgnoreBatteryOptimizations').mockResolvedValue({
      success: true,
      message: 'Battery optimization exemption dialog launched'
    });

    render(<SettingsTab roleGranted={true} onRefreshRole={vi.fn()} />);

    const button = await screen.findByRole('button', { name: /Grant 24\/7 Background Exemption/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalled();
    });
  });
});
