import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { App } from '../App';

describe('AegisCall AI Frontend Application', () => {
  it('renders application header and branding', async () => {
    render(<App />);
    expect(screen.getByText('AegisCall AI')).toBeInTheDocument();
    expect(screen.getByText(/Active Call Defense/i)).toBeInTheDocument();
  });

  it('navigates between navigation tabs', async () => {
    render(<App />);
    
    // Switch to Screener Simulator Tab
    const screenerTabBtn = screen.getByRole('button', { name: /Screener/i });
    fireEvent.click(screenerTabBtn);
    expect(screen.getByText(/Call Screening Simulator/i)).toBeInTheDocument();
    expect(screen.getByText(/IRS Arrest Warrant Scam/i)).toBeInTheDocument();

    // Switch to History Tab
    const historyTabBtn = screen.getByRole('button', { name: /History/i });
    fireEvent.click(historyTabBtn);
    expect(screen.getByPlaceholderText(/Search by phone/i)).toBeInTheDocument();

    // Switch to Rules Tab
    const rulesTabBtn = screen.getByRole('button', { name: /Rules/i });
    fireEvent.click(rulesTabBtn);
    expect(screen.getByText(/Fast Screening Rules/i)).toBeInTheDocument();

    // Switch to Settings Tab
    const settingsTabBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsTabBtn);
    expect(screen.getByText(/Android Telecom Role/i)).toBeInTheDocument();
  });
});
