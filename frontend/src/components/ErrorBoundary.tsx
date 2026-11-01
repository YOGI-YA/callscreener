import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AegisCall ErrorBoundary] Caught UI rendering failure:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="p-6 rounded-2xl border border-red-500/30 bg-red-950/20 backdrop-blur-md text-slate-200 flex flex-col items-center justify-center text-center space-y-4 my-4"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            margin: '16px 0',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}
          >
            <ShieldAlert size={28} />
          </div>

          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
              {this.props.fallbackTitle || 'Component Rendering Guard Engaged'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto' }}>
              An unexpected error occurred in this view. Active call screening and security policies continue running uninterrupted in the background.
            </p>
          </div>

          {this.state.error && (
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#fca5a5',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                padding: '8px 12px',
                borderRadius: '8px',
                maxWidth: '90%',
                overflowX: 'auto'
              }}
            >
              {this.state.error.message}
            </div>
          )}

          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            <RefreshCw size={14} />
            <span>Recover View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
