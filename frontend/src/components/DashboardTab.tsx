import React, { useState } from 'react';
import {
  ShieldCheck, ShieldAlert, Zap, Radio, PhoneIncoming, AlertTriangle,
  ArrowRight, ShieldBan, Sparkles, Search, CheckCircle2, AlertOctagon,
  Truck, PhoneCall, Bot
} from 'lucide-react';
import { CallScreeningStats, ScreeningResult } from '../types';
import { RiskBadge } from './RiskBadge';
import { ThreatMatrixAnalytics } from './ThreatMatrixAnalytics';
import { ScamBaiterHoneypotWidget } from './ScamBaiterHoneypotWidget';
import { CapacitorService } from '../services/capacitorService';

interface DashboardTabProps {
  stats: CallScreeningStats | null;
  recentLogs: ScreeningResult[];
  backendStatus: { status: string; latencyMs: number };
  roleGranted: boolean;
  onLaunchSimulator: () => void;
  onSelectLog: (log: ScreeningResult) => void;
  onNavigateToTab: (tab: any) => void;
  onSimulateScenario?: (scenario: 'bank_fraud' | 'delivery' | 'telemarketer') => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  stats,
  recentLogs,
  backendStatus,
  roleGranted,
  onLaunchSimulator,
  onSelectLog,
  onNavigateToTab,
  onSimulateScenario
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const spamRate = stats?.spamBlockRate ?? 0;

  // Filter logs or search result
  const searchedLogs = searchQuery.trim()
    ? recentLogs.filter(
        (l) =>
          l.phoneNumber.includes(searchQuery) ||
          l.callerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recentLogs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ────────────────────────────────────────────────────────────────
          TRUECALLER-STYLE TOP SEARCH BAR
         ──────────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        <Search size={18} color="var(--accent-glow)" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search number, caller name, or spam radar..."
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '0.85rem',
            outline: 'none'
          }}
        />
        {searchQuery && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/^\+?[0-9\s\-()]+$/.test(searchQuery.trim()) && (
              <button
                onClick={() => {
                  CapacitorService.makeCall(searchQuery.trim());
                }}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: 'var(--color-safe)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Call
              </button>
            )}
            <button
              onClick={() => setSearchQuery('')}
              style={{ fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Action Required: Telecom Role Warning Banner */}
      {!roleGranted && (
        <div
          className="glass-card"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={24} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                Default Phone &amp; Caller ID Not Selected
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                Set AegisCall as your default <strong>Phone &amp; Caller ID App</strong> so Android routes phone calls directly to the AI screener.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('settings')}
            className="btn-primary"
            style={{ padding: '10px 14px', fontSize: '0.82rem', fontWeight: 700 }}
          >
            <ShieldCheck size={16} /> Enable Default Phone App Now
          </button>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          TRUECALLER-STYLE SPAM RADAR SHIELD (HERO STATUS)
         ──────────────────────────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          background: 'radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)',
          border: '1px solid var(--border-glow)',
          position: 'relative',
          overflow: 'hidden',
          padding: 20
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="truecaller-verified-badge">
              <CheckCircle2 size={13} /> Live AI Call Screener
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              12.8M Fraud Signatures
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--accent-glow)', fontWeight: 700 }}>
            <Sparkles size={14} /> AI Voice Engine
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: '2.9rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
            {stats?.totalCallsScreened ?? 0}
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
              Calls Screened by AI
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              {stats?.totalSpamBlocked ?? 0} spam blocked • {stats?.totalCallsAllowed ?? 0} connected
            </div>
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{spamRate}%</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>Spam Rate</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-safe)' }}>{stats?.totalCallsAllowed ?? 0}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>Verified Safe</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f87171' }}>{stats?.totalSpamBlocked ?? 0}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>Threats Blocked</div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────
          TRUECALLER AI CALL SCREENER SIMULATION RADAR
         ──────────────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bot size={17} color="var(--accent-glow)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>
              Test Truecaller AI Voice Screener
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1-Tap Demo</span>
        </div>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
          Experience the live AI Assistant speaking directly to callers and providing real-time transcripts:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <button
            onClick={() => onSimulateScenario?.('bank_fraud')}
            style={{
              padding: '10px 6px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.14)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              color: '#fca5a5',
              cursor: 'pointer'
            }}
          >
            <AlertOctagon size={18} color="#ef4444" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>Bank Scam</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>98% Spam</span>
          </button>

          <button
            onClick={() => onSimulateScenario?.('delivery')}
            style={{
              padding: '10px 6px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              color: '#6ee7b7',
              cursor: 'pointer'
            }}
          >
            <Truck size={18} color="#10b981" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>Delivery</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Amazon Safe</span>
          </button>

          <button
            onClick={() => onSimulateScenario?.('telemarketer')}
            style={{
              padding: '10px 6px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              color: '#fcd34d',
              cursor: 'pointer'
            }}
          >
            <PhoneCall size={18} color="#f59e0b" />
            <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>Telemarket</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Credit Card</span>
          </button>
        </div>
      </div>

      {/* Extreme Feature: Threat Matrix Intelligence Radar & Heatmap */}
      <ThreatMatrixAnalytics logs={recentLogs} />

      {/* Extreme Feature: Autonomous AI Defensive Counter-Honeypot (Scam-Baiter) */}
      <ScamBaiterHoneypotWidget phoneNumber={recentLogs.find((l) => l.verdict === 'REJECT')?.phoneNumber} />

      {/* Quick Status Grid: Role & Engine */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div
          className="glass-card"
          onClick={() => onNavigateToTab('settings')}
          style={{ cursor: 'pointer', padding: 14 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ShieldCheck size={18} color={roleGranted ? 'var(--color-safe)' : 'var(--color-warning)'} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Telecom Role</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: roleGranted ? 'var(--color-safe)' : 'var(--color-warning)', fontWeight: 600 }}>
            {roleGranted ? 'Default Screener Active' : 'Enable Permission'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {roleGranted ? 'Android Telecom connected' : 'Tap to configure'}
          </div>
        </div>

        <div className="glass-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Zap size={18} color={backendStatus.status === 'online' ? 'var(--accent-glow)' : 'var(--color-danger)'} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>On-Device AI</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: backendStatus.status === 'online' ? 'var(--accent-glow)' : 'var(--color-danger)', fontWeight: 600 }}>
            {backendStatus.status === 'online' ? `Neural Voice (${backendStatus.latencyMs}ms)` : 'Fast Fallback'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
            High-fidelity TTS &amp; STT
          </div>
        </div>
      </div>

      {/* Recent Screened Activity */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Recent Caller Radar
          </h3>
          <button
            onClick={() => onNavigateToTab('logs')}
            style={{ fontSize: '0.75rem', color: 'var(--accent-glow)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View all <ArrowRight size={14} />
          </button>
        </div>

        {searchedLogs.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
            <ShieldCheck size={36} color="var(--color-safe)" style={{ margin: '0 auto 10px', opacity: 0.85 }} />
            <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>AegisCall Protection Active</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
              Waiting for incoming phone calls. Calls will be screened live with voice AI and logged here with risk radar analytics.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searchedLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="glass-card"
                onClick={() => onSelectLog(log)}
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ maxWidth: '65%' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.callerName}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {log.phoneNumber}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.rationale}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <RiskBadge level={log.riskLevel} verdict={log.verdict} score={log.riskScore} />
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
