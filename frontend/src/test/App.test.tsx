import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { App } from '../App';

describe('AegisCall AI Frontend Application', () => {
  it('renders application header and branding', async () => {
    render(<App />);
    expect(screen.getAllByText('AegisCall AI')[0]).toBeInTheDocument();
    expect(screen.getByText(/Live AI Call Screener/i)).toBeInTheDocument();
  });

  it('navigates between navigation tabs', async () => {
    render(<App />);

    // Switch to Phone / Dialer Tab – shows the Recents/Contacts/Keypad sub-nav
    const phoneTabBtn = screen.getByRole('button', { name: /^Phone$/i });
    fireEvent.click(phoneTabBtn);
    // Dialer renders a 3-section sub-nav with Recents, Contacts, Keypad
    expect(screen.getByRole('button', { name: /Recents/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contacts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keypad/i })).toBeInTheDocument();

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

  it('interacts with the phone keypad and enters numbers', async () => {
    render(<App />);
    const phoneTabBtn = screen.getByRole('button', { name: /^Phone$/i });
    fireEvent.click(phoneTabBtn);

    const keypadBtn = screen.getByRole('button', { name: /Keypad/i });
    fireEvent.click(keypadBtn);

    // Keypad display initial state
    expect(screen.getByText(/Enter number…/i)).toBeInTheDocument();

    // Tap digits 9, 8
    const digit9 = screen.getByText('9');
    fireEvent.mouseDown(digit9);
    const digit8 = screen.getByText('8');
    fireEvent.mouseDown(digit8);

    expect(screen.getByText('98')).toBeInTheDocument();
  });
});
