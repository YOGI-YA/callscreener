import React, { useState } from 'react';
import { Search, Filter, Trash2, ShieldPlus, ShieldX, Clock, Phone, AlertCircle } from 'lucide-react';
import { ScreeningResult, ScreeningVerdict } from '../types';
import { RiskBadge } from './RiskBadge';

interface CallLogsTabProps {
  logs: ScreeningResult[];
  onDeleteLog: (id: string) => void;
  onClearAll: () => void;
  onSelectLog: (log: ScreeningResult) => void;
  onAddRule: (pattern: string, action: ScreeningVerdict, description: string) => void;
}

export const CallLogsTab: React.FC<CallLogsTabProps> = ({
  logs,
  onDeleteLog,
  onClearAll,
  onSelectLog,
  onAddRule
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      log.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.callerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.rationale.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesVerdict = verdictFilter === 'ALL' || log.verdict === verdictFilter;

    return matchesSearch && matchesVerdict;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search and Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search by phone, name, or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {['ALL', 'REJECT', 'SILENCE', 'ALLOW'].map((v) => (
            <button
              key={v}
              onClick={() => setVerdictFilter(v)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: verdictFilter === v ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                color: verdictFilter === v ? '#fff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: verdictFilter === v ? 'var(--accent-glow)' : 'var(--border-subtle)'
              }}
            >
              {v === 'ALL' ? 'All Calls' : v === 'REJECT' ? 'Blocked' : v === 'SILENCE' ? 'Silenced' : 'Allowed'}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          {filteredLogs.length} Screened Events
        </span>
        {logs.length > 0 && (
          <button
            onClick={onClearAll}
            style={{ fontSize: '0.75rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Trash2 size={13} /> Clear History
          </button>
        )}
      </div>

      {filteredLogs.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <p style={{ fontSize: '0.85rem' }}>No matching call screening records found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="glass-card"
              style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div onClick={() => onSelectLog(log)} style={{ cursor: 'pointer', flex: 1 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>
                    {log.callerName}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-glow)', marginTop: 2 }}>
                    {log.phoneNumber}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <RiskBadge level={log.riskLevel} verdict={log.verdict} score={log.riskScore} />
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Rationale Snippet */}
              <div
                onClick={() => onSelectLog(log)}
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  background: 'rgba(0,0,0,0.2)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer'
                }}
              >
                {log.rationale}
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>{log.latencyMs}ms</span>
                  <span>•</span>
                  <span>{log.category.replace('_', ' ')}</span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onAddRule(`^${log.phoneNumber.replace(/[\+\(\)\s\-]/g, '\\$&')}$`, 'ALLOW', `Whitelist ${log.callerName}`)}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                    title="Always allow this number"
                  >
                    <ShieldPlus size={12} color="var(--color-safe)" /> Whitelist
                  </button>

                  <button
                    onClick={() => onAddRule(`^${log.phoneNumber.replace(/[\+\(\)\s\-]/g, '\\$&')}$`, 'REJECT', `Blacklist ${log.callerName}`)}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                    title="Always block this number"
                  >
                    <ShieldX size={12} color="var(--color-danger)" /> Blacklist
                  </button>

                  <button
                    onClick={() => onDeleteLog(log.id)}
                    style={{ color: 'var(--text-muted)', padding: '4px 6px' }}
                    title="Delete log entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
