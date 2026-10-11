import React, { useState, useEffect } from 'react';
import { Shield, Radio, Activity, RefreshCw } from 'lucide-react';
import { TabId, Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { SimulatorTab } from './components/SimulatorTab';
import { CallLogsTab } from './components/CallLogsTab';
import { RulesTab } from './components/RulesTab';
import { SettingsTab } from './components/SettingsTab';
import { IncomingCallOverlay } from './components/IncomingCallOverlay';
import { CallModal } from './components/CallModal';
import { ApiService } from './services/api';
import { CapacitorService } from './services/capacitorService';
import { AutoSetupWizard } from './components/AutoSetupWizard';
import { IncomingCallPayload, ScreeningResult, CallScreeningStats, ScreeningRule, ScreeningVerdict } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [stats, setStats] = useState<CallScreeningStats | null>(null);
  const [logs, setLogs] = useState<ScreeningResult[]>([]);
  const [rules, setRules] = useState<ScreeningRule[]>([]);
  const [backendStatus, setBackendStatus] = useState<{ status: string; latencyMs: number }>({
    status: 'checking',
    latencyMs: 0
  });
  const [roleGranted, setRoleGranted] = useState<boolean>(false);
  const [showAutoSetup, setShowAutoSetup] = useState<boolean>(false);

  // Live incoming call simulation state
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [activeResult, setActiveResult] = useState<ScreeningResult | null>(null);
  const [isScreening, setIsScreening] = useState<boolean>(false);

  // Inspection modal
  const [selectedLog, setSelectedLog] = useState<ScreeningResult | null>(null);

  // Load data on startup
  const refreshAllData = async () => {
    try {
      const [health, statsData, logsData, rulesData, roleStatus] = await Promise.allSettled([
        ApiService.checkHealth(),
        ApiService.getStats(),
        ApiService.getLogs(),
        ApiService.getRules(),
        CapacitorService.checkRoleStatus()
      ]);

      if (health.status === 'fulfilled') setBackendStatus(health.value);
      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (logsData.status === 'fulfilled') setLogs(logsData.value);
      if (rulesData.status === 'fulfilled') setRules(rulesData.value);
      if (roleStatus.status === 'fulfilled') setRoleGranted(roleStatus.value.roleGranted);
    } catch (e) {
      console.error('Error refreshing app data:', e);
    }
  };

  useEffect(() => {
    if (ApiService.isFirstRun()) {
      setShowAutoSetup(true);
    }
    refreshAllData();

    // Listen for real incoming calls screened by Android Telecom in real time
    const removeListener = CapacitorService.addCallScreenedListener((realCall) => {
      console.log('Real incoming call screened on phone:', realCall);
      setLogs((prev) => [realCall, ...prev]);
      ApiService.getStats().then(setStats).catch(() => {});
      setActiveResult(realCall);
      setIncomingCall({
        phoneNumber: realCall.phoneNumber,
        callerName: realCall.callerName,
        callPresentationMode: 'ALLOWED'
      });
    });

    const interval = setInterval(() => {
      ApiService.checkHealth().then(setBackendStatus).catch(() => {});
      CapacitorService.checkRoleStatus().then((res) => setRoleGranted(res.roleGranted)).catch(() => {});
    }, 5000);

    return () => {
      clearInterval(interval);
      if (removeListener) removeListener();
    };
  }, []);

  // Trigger simulated incoming call
  const handleSimulateCall = async (payload: IncomingCallPayload) => {
    setIncomingCall(payload);
    setActiveResult(null);
    setIsScreening(true);

    try {
      const result = await ApiService.screenCall(payload);
      setActiveResult(result);
      // Update local logs and stats immediately
      setLogs((prev) => [result, ...prev]);
      ApiService.getStats().then(setStats).catch(() => {});
    } catch (error: any) {
      console.error('Screening simulation failed:', error);
    } finally {
      setIsScreening(false);
    }
  };

  // Manual override inside incoming call overlay
  const handleOverrideAction = (verdict: ScreeningVerdict) => {
    if (activeResult) {
      setActiveResult({
        ...activeResult,
        verdict,
        rationale: `Manual user override: Call ${verdict === 'ALLOW' ? 'allowed' : verdict === 'SILENCE' ? 'silenced' : 'blocked'}.`
      });
    }
    setTimeout(() => {
      setIncomingCall(null);
      setActiveResult(null);
    }, 800);
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await ApiService.deleteLog(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      ApiService.getStats().then(setStats).catch(() => {});
    } catch (e) {
      console.error('Failed to delete log:', e);
    }
  };

  const handleClearAllLogs = async () => {
    await ApiService.clearAllLogs();
    setLogs([]);
    setStats({
      totalCallsScreened: 0,
      totalSpamBlocked: 0,
      totalCallsSilenced: 0,
      totalCallsAllowed: 0,
      averageRiskScore: 0,
      averageLatencyMs: 0,
      spamBlockRate: 0
    });
  };

  const handleAddRule = async (ruleData: Omit<ScreeningRule, 'id' | 'createdAt'> | { pattern: string; action: ScreeningVerdict; description: string }) => {
    try {
      const payload: Omit<ScreeningRule, 'id' | 'createdAt'> = 'type' in ruleData ? ruleData : {
        type: ruleData.action === 'ALLOW' ? 'WHITELIST' : 'BLACKLIST',
        pattern: ruleData.pattern,
        description: ruleData.description,
        action: ruleData.action,
        enabled: true
      };

      const created = await ApiService.addRule(payload);
      setRules((prev) => [...prev, created]);
    } catch (e) {
      console.error('Failed to add rule:', e);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await ApiService.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('Failed to delete rule:', e);
    }
  };

  return (
    <div className="app-viewport-container">
      <div className="mobile-device-frame">
        {/* App Header Bar */}
        <header className="app-header">
          <div className="brand-badge">
            <div className="brand-logo-icon">
              <Shield size={20} color="#fff" />
            </div>
            <div>
              <div className="brand-title">AegisCall AI</div>
              <div className="brand-sub">
                <span className="status-dot" style={{ backgroundColor: backendStatus.status === 'online' ? 'var(--color-safe)' : 'var(--color-warning)' }} />
                <span>{backendStatus.status === 'online' ? 'AI Shield Active' : 'Fallback Engine'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={refreshAllData}
            title="Refresh Status"
            style={{ color: 'var(--text-secondary)', padding: 6 }}
          >
            <RefreshCw size={16} />
          </button>
        </header>

        {/* Scrollable Main Views */}
        <main className="app-content">
          {activeTab === 'dashboard' && (
            <DashboardTab
              stats={stats}
              recentLogs={logs}
              backendStatus={backendStatus}
              roleGranted={roleGranted}
              onLaunchSimulator={() => setActiveTab('simulator')}
              onSelectLog={(log) => setSelectedLog(log)}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'simulator' && (
            <SimulatorTab
              onSimulateCall={handleSimulateCall}
              isLoading={isScreening}
            />
          )}

          {activeTab === 'logs' && (
            <CallLogsTab
              logs={logs}
              onDeleteLog={handleDeleteLog}
              onClearAll={handleClearAllLogs}
              onSelectLog={(log) => setSelectedLog(log)}
              onAddRule={(pattern, action, desc) => handleAddRule({ pattern, action, description: desc })}
            />
          )}

          {activeTab === 'rules' && (
            <RulesTab
              rules={rules}
              onAddRule={handleAddRule}
              onDeleteRule={handleDeleteRule}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              roleGranted={roleGranted}
              onRefreshRole={() => CapacitorService.checkRoleStatus().then((s) => setRoleGranted(s.roleGranted))}
            />
          )}
        </main>

        {/* Live Incoming Call Simulation Overlay */}
        {incomingCall && (
          <IncomingCallOverlay
            incomingCall={incomingCall}
            screeningResult={activeResult}
            isProcessing={isScreening}
            onDismiss={() => {
              setIncomingCall(null);
              setActiveResult(null);
            }}
            onOverrideAction={handleOverrideAction}
          />
        )}

        {/* Automatic First-Run Onboarding Setup Wizard */}
        {showAutoSetup && (
          <AutoSetupWizard
            onComplete={() => {
              setShowAutoSetup(false);
              refreshAllData();
            }}
          />
        )}

        {/* Call Log Detail Inspection Modal */}
        {selectedLog && (
          <CallModal
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
            onAddRule={(pattern, action, desc) => handleAddRule({ pattern, action, description: desc })}
          />
        )}

        {/* Bottom Navigation */}
        <Navbar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          unreadCount={logs.filter((l) => l.verdict === 'REJECT').length}
        />
      </div>
    </div>
  );
};
