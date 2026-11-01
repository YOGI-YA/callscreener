import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';

const FaultyComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Simulated telephony UI failure');
  }
  return <div>Healthy Screen Content</div>;
};

describe('ErrorBoundary Component', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <FaultyComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Healthy Screen Content')).toBeInTheDocument();
  });

  it('renders defensive fallback view when a child component crashes', () => {
    // Suppress console.error output during deliberate crash test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackTitle="Call Screen Crash Guard">
        <FaultyComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Call Screen Crash Guard')).toBeInTheDocument();
    expect(screen.getByText(/Simulated telephony UI failure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recover View/i })).toBeInTheDocument();

    spy.mockRestore();
  });

  it('calls onReset callback when recover button is clicked', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = vi.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <FaultyComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const btn = screen.getByRole('button', { name: /Recover View/i });
    fireEvent.click(btn);

    expect(onReset).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
