import React from 'react';
import { ShieldCheck, ShieldAlert, Zap, Radio, PhoneIncoming, AlertTriangle, ArrowRight, ShieldBan, Sparkles } from 'lucide-react';
import { CallScreeningStats, ScreeningResult } from '../types';
import { RiskBadge } from './RiskBadge';

interface DashboardTabProps {
  stats: CallScreeningStats | null;
  recentLogs: ScreeningResult[];
  backendStatus: { status: string; latencyMs: number };
  roleGranted: boolean;
  onLaunchSimulator: () => void;
  onSelectLog: (log: ScreeningResult) => void;
  onNavigateToTab: (tab: any) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  stats,
  recentLogs,
  backendStatus,
  roleGranted,
  onLaunchSimulator,
  onSelectLog,
  onNavigateToTab
}) => {
  const spamRate = stats?.spamBlockRate ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero Stats Card */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 70, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid var(--border-glow)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Call Defense
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--accent-glow)' }}>
            <Sparkles size={14} /> AI Real-Time
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: '2.8rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
            {spamRate}%
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-safe)' }}>
              Spam Block Rate
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {stats?.totalSpamBlocked ?? 0} threats intercepted
            </div>
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{stats?.totalCallsScreened ?? 0}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>Screened</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-safe)' }}>{stats?.totalCallsAllowed ?? 0}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>Allowed</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 8px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-warning)' }}>{stats?.totalCallsSilenced ?? 0}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>Silenced</div>
          </div>
        </div>
      </div>

      {/* Quick Status & Action Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Android Telecom Role Status */}
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
            {roleGranted ? 'Active Screener' : 'Permission Required'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {roleGranted ? 'Android Telecom connected' : 'Tap to enable RoleManager'}
          </div>
        </div>

        {/* Backend & Latency */}
        <div className="glass-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Zap size={18} color={backendStatus.status === 'online' ? 'var(--accent-glow)' : 'var(--color-danger)'} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>AI Engine</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: backendStatus.status === 'online' ? 'var(--accent-glow)' : 'var(--color-danger)', fontWeight: 600 }}>
            {backendStatus.status === 'online' ? `Online (${backendStatus.latencyMs}ms)` : 'Offline Fallback'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Fast local safety rules active
          </div>
        </div>
      </div>

      {/* Primary Simulator CTA */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
          border: '1px solid var(--border-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16
        }}
      >
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: 2 }}>
            Interactive Call Simulator
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Test IRS scams, doctor calls, or robocall bots
          </div>
        </div>
        <button onClick={onLaunchSimulator} className="btn-primary" style={{ padding: '10px 14px' }}>
          <Radio size={16} /> Test Now
        </button>
      </div>

      {/* Recent Screened Activity */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Recent Activity
          </h3>
          <button
            onClick={() => onNavigateToTab('logs')}
            style={{ fontSize: '0.75rem', color: 'var(--accent-glow)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View all <ArrowRight size={14} />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
            <PhoneIncoming size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <p style={{ fontSize: '0.85rem' }}>No calls screened yet.</p>
            <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Use the Simulator to test live call screening.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentLogs.slice(0, 4).map((log) => (
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
