import React, { useState } from 'react';
import { Settings, ShieldCheck, Server, Smartphone, ExternalLink, HelpCircle, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { CapacitorService } from '../services/capacitorService';
import { ApiService } from '../services/api';

interface SettingsTabProps {
  roleGranted: boolean;
  onRefreshRole: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ roleGranted, onRefreshRole }) => {
  const [apiUrl, setApiUrl] = useState(ApiService.getBaseUrl());
  const [testResult, setTestResult] = useState<{ status: string; latencyMs: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isRequestingRole, setIsRequestingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);

  const handleSaveApiUrl = () => {
    ApiService.setBaseUrl(apiUrl);
    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const res = await ApiService.checkHealth();
    setTestResult(res);
    setIsTesting(false);
  };

  const handleRequestRole = async () => {
    setIsRequestingRole(true);
    const result = await CapacitorService.requestScreeningRole();
    setRoleMessage(result.message);
    setIsRequestingRole(false);
    onRefreshRole();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Settings Header */}
      <div className="glass-card" style={{ border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Settings size={18} color="var(--accent-glow)" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Settings & Integration</h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Configure Android native permissions, cloud backend endpoints, and screening parameters.
        </p>
      </div>

      {/* Android RoleManager Card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} color="var(--accent-glow)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Android Telecom Role</span>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: roleGranted ? 'var(--color-safe)' : 'var(--color-warning)',
              background: roleGranted ? 'var(--color-safe-bg)' : 'var(--color-warning-bg)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)'
            }}
          >
            {roleGranted ? 'Granted' : 'Not Granted'}
          </span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          On Android 10+ (API 29+), Android requires users to explicitly grant the <code>ROLE_CALL_SCREENING</code> default app role before the OS routes incoming telecom calls to <code>CallScreeningService</code>.
        </p>

        {roleMessage && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-glow)', background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
            {roleMessage}
          </div>
        )}

        <button
          onClick={handleRequestRole}
          disabled={isRequestingRole}
          className="btn-primary"
          style={{ width: '100%', padding: '10px' }}
        >
          <ShieldCheck size={16} />
          <span>{roleGranted ? 'Re-verify Screening Role' : 'Request Screening Role (RoleManager)'}</span>
        </button>
      </div>

      {/* Backend API Configuration */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server size={18} color="var(--accent-glow)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Backend Server Endpoint</span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          For physical Android devices on Wi-Fi, enter your computer's local LAN IP (e.g. <code>http://192.168.1.50:4000</code>) or cloud API URL.
        </p>

        <div>
          <input
            type="text"
            placeholder="http://localhost:4000 or http://192.168.x.x:4000"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSaveApiUrl} className="btn-secondary" style={{ flex: 1, padding: '10px' }}>
            Save & Connect
          </button>
          <button onClick={handleTestConnection} disabled={isTesting} className="btn-secondary" style={{ padding: '10px 14px' }}>
            <RefreshCw size={14} className={isTesting ? 'spin' : ''} /> Test
          </button>
        </div>

        {testResult && (
          <div
            style={{
              fontSize: '0.75rem',
              padding: 8,
              borderRadius: 'var(--radius-sm)',
              background: testResult.status === 'online' ? 'var(--color-safe-bg)' : 'var(--color-danger-bg)',
              color: testResult.status === 'online' ? 'var(--color-safe)' : 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>Status: {testResult.status.toUpperCase()}</span>
            <span>Latency: {testResult.latencyMs}ms</span>
          </div>
        )}
      </div>

      {/* Physical Device Requirement Warning */}
      <div
        className="glass-card"
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid var(--color-warning-border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle size={20} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-warning)' }}>
              Physical Device Testing Notice
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>
              Android <code>CallScreeningService</code> requires actual cellular or SIM telephony events and user-granted default screener permissions. Browser simulation tests logic and LLM screening accurately, but real hardware telecom interception must be validated on a physical Android phone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
