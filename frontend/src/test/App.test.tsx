import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { App } from '../App';

describe('AegisCall AI Frontend Application', () => {
  it('renders application header and branding', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getAllByText('AegisCall AI')[0]).toBeInTheDocument();
    expect(screen.getByText(/Live AI Call Screener/i)).toBeInTheDocument();
  });

  it('navigates between navigation tabs', async () => {
    await act(async () => {
      render(<App />);
    });

    // Switch to Phone / Dialer Tab – shows the Recents/Contacts/Keypad sub-nav
    const phoneTabBtn = screen.getByRole('button', { name: /^Phone$/i });
    await act(async () => {
      fireEvent.click(phoneTabBtn);
    });
    // Dialer renders a 3-section sub-nav with Recents, Contacts, Keypad
    expect(await screen.findByRole('button', { name: /Recents/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contacts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keypad/i })).toBeInTheDocument();

    // Switch to History Tab
    const historyTabBtn = screen.getByRole('button', { name: /^History$/i });
    await act(async () => {
      fireEvent.click(historyTabBtn);
    });
    expect(await screen.findByPlaceholderText(/Search by phone/i)).toBeInTheDocument();

    // Switch to Rules Tab
    const rulesTabBtn = screen.getByRole('button', { name: /^Rules$/i });
    await act(async () => {
      fireEvent.click(rulesTabBtn);
    });
    expect(await screen.findByText(/Fast Screening Rules/i)).toBeInTheDocument();

    // Switch to Settings Tab
    const settingsTabBtn = screen.getByRole('button', { name: /^Settings$/i });
    await act(async () => {
      fireEvent.click(settingsTabBtn);
    });
    expect(await screen.findByText(/Android Telecom Role/i)).toBeInTheDocument();
  });

  it('interacts with the phone keypad and enters numbers', async () => {
    await act(async () => {
      render(<App />);
    });
    const phoneTabBtn = screen.getByRole('button', { name: /^Phone$/i });
    await act(async () => {
      fireEvent.click(phoneTabBtn);
    });

    const keypadBtn = await screen.findByRole('button', { name: /Keypad/i });
    await act(async () => {
      fireEvent.click(keypadBtn);
    });

    // Keypad display initial state
    expect(await screen.findByText(/Enter number…/i)).toBeInTheDocument();

    // Tap digits 9, 8
    const digit9 = screen.getByText('9');
    await act(async () => {
      fireEvent.mouseDown(digit9);
    });
    const digit8 = screen.getByText('8');
    await act(async () => {
      fireEvent.mouseDown(digit8);
    });

    expect(await screen.findByText('98')).toBeInTheDocument();
  });
});

