import React, { useState, useEffect } from 'react';
import { Shield, Radio, Activity, RefreshCw, Bot, Terminal, Maximize2, Smartphone } from 'lucide-react';
import { TabId, Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { DialerTab } from './components/DialerTab';
import { CallLogsTab } from './components/CallLogsTab';
import { RulesTab } from './components/RulesTab';
import { SettingsTab } from './components/SettingsTab';
import { IncomingCallOverlay } from './components/IncomingCallOverlay';
import { CallModal } from './components/CallModal';
import { CallSimulatorSandbox } from './components/CallSimulatorSandbox';
import { ApiService } from './services/api';
import { CapacitorService } from './services/capacitorService';
import { AutoSetupWizard } from './components/AutoSetupWizard';
import { IncomingCallPayload, ScreeningResult, CallScreeningStats, ScreeningRule, ScreeningVerdict, SimulationScenario } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [stats, setStats] = useState<CallScreeningStats | null>(null);
  const [logs, setLogs] = useState<ScreeningResult[]>([]);
  const [rules, setRules] = useState<ScreeningRule[]>([]);
  const [isWideLayout, setIsWideLayout] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth >= 960);
  const [backendStatus, setBackendStatus] = useState<{ status: string; latencyMs: number }>({
    status: 'checking',
    latencyMs: 0
  });
  const [roleGranted, setRoleGranted] = useState<boolean>(false);
  const [showAutoSetup, setShowAutoSetup] = useState<boolean>(false);
  const [showSandbox, setShowSandbox] = useState<boolean>(false);

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

    // Check if there is an existing ongoing/ringing call right now on native device
    const syncActiveCall = async () => {
      try {
        const cur = await CapacitorService.getCurrentCall();
        if (cur.hasActiveCall && cur.phoneNumber) {
          setIncomingCall((prev) => {
            if (prev && prev.phoneNumber === cur.phoneNumber) return prev;
            return {
              phoneNumber: cur.phoneNumber!,
              callerName: cur.callerName || 'Incoming Caller',
              callPresentationMode: 'ALLOWED',
              initialPhase: cur.isScreeningActive ? 'SCREENING' : cur.callState === 'ACTIVE' ? 'CONNECTED' : 'RINGING'
            };
          });
        }
      } catch (e) {
        console.warn('Error syncing active call:', e);
      }
    };
    syncActiveCall();

    // Listen for real incoming calls screened by Android Telecom in real time
    const removeListener = CapacitorService.addCallScreenedListener((realCall) => {
      console.log('Real incoming call screened on phone:', realCall);
      setLogs((prev) => [realCall, ...prev]);
      ApiService.getStats().then(setStats).catch(() => {});
      setActiveResult(realCall);
    });

    // Listen for real live phone calls handled by Android InCallService (Dialer UI)
    const removeIncomingListener = CapacitorService.addIncomingCallListener((incoming) => {
      console.log('Live phone call ringing:', incoming);
      setIncomingCall({
        phoneNumber: incoming.phoneNumber,
        callerName: incoming.callerName || 'Incoming Caller',
        callPresentationMode: 'ALLOWED',
        initialPhase: 'RINGING'
      });

      // Analyze caller with on-device AI
      ApiService.screenCall({
        phoneNumber: incoming.phoneNumber,
        callerName: incoming.callerName,
        callPresentationMode: 'ALLOWED'
      }).then((result) => {
        setActiveResult(result);
        setLogs((prev) => [result, ...prev]);
        ApiService.getStats().then(setStats).catch(() => {});
      }).catch(console.error);
    });

    // Listen for call brought back to front from lockscreen or notification
    const removeRestoredListener = CapacitorService.addCallRestoredListener((restored) => {
      console.log('Live phone call restored:', restored);
      setIncomingCall({
        phoneNumber: restored.phoneNumber,
        callerName: restored.callerName || 'Incoming Caller',
        callPresentationMode: 'ALLOWED',
        initialPhase: restored.isScreeningActive ? 'SCREENING' : restored.callState === 'ACTIVE' ? 'CONNECTED' : 'RINGING'
      });
    });

    // When call ends natively, clear incoming call overlay
    const removeEndedListener = CapacitorService.addCallEndedListener(() => {
      console.log('Live phone call ended');
      setIncomingCall(null);
      setActiveResult(null);
    });

    window.addEventListener('focus', syncActiveCall);
    document.addEventListener('visibilitychange', syncActiveCall);

    const interval = setInterval(() => {
      ApiService.checkHealth().then(setBackendStatus).catch(() => {});
      CapacitorService.checkRoleStatus().then((res) => setRoleGranted(res.roleGranted)).catch(() => {});
      syncActiveCall();
    }, 4000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncActiveCall);
      document.removeEventListener('visibilitychange', syncActiveCall);
      if (removeListener) removeListener();
      if (removeIncomingListener) removeIncomingListener();
      if (removeRestoredListener) removeRestoredListener();
      if (removeEndedListener) removeEndedListener();
    };
  }, []);

  // Trigger incoming call simulation from Dialer tab (Contacts / Recents)
  const handleDialerAiScreen = async (phoneNumber: string, callerName: string) => {
    const payload: IncomingCallPayload = {
      phoneNumber,
      callerName: callerName || 'Unknown Caller',
      callPresentationMode: 'ALLOWED',
      simulatedAudioTranscript: `Hi, I am calling from ${callerName || phoneNumber}. Please let me speak to the recipient.`
    };
    setIncomingCall(payload);
    setActiveResult(null);
    setIsScreening(true);

    try {
      const result = await ApiService.screenCall(payload);
      setActiveResult(result);
      setLogs((prev) => [result, ...prev]);
      ApiService.getStats().then(setStats).catch(() => {});
    } catch (error: any) {
      console.error('AI screening failed:', error);
    } finally {
      setIsScreening(false);
    }
  };

  // Trigger outgoing call screen from Dialer tab
  const handleOutgoingCall = (phoneNumber: string, callerName: string) => {
    const payload: IncomingCallPayload = {
      phoneNumber,
      callerName: callerName || phoneNumber,
      callPresentationMode: 'ALLOWED',
      isOutgoing: true
    };
    setIncomingCall(payload);
    setActiveResult(null);
  };

  // Trigger rich Truecaller demo scenarios
  const handleSimulateScenario = async (scenario: 'bank_fraud' | 'delivery' | 'telemarketer') => {
    let payload: IncomingCallPayload;
    if (scenario === 'bank_fraud') {
      payload = {
        phoneNumber: '+1 (800) 432-1000',
        callerName: 'Chase Fraud Prevention',
        callPresentationMode: 'ALLOWED',
        location: 'New York, NY',
        carrier: 'AT&T Business',
        simulatedAudioTranscript: 'Hello, this is officer Miller from the fraud detection team. We detected an unauthorized charge of 890 dollars on your debit card. Please confirm your OTP and card numbers immediately to cancel it.'
      };
    } else if (scenario === 'delivery') {
      payload = {
        phoneNumber: '+91 98201 44321',
        callerName: 'Amazon Prime Courier',
        callPresentationMode: 'ALLOWED',
        location: 'Mumbai, MH',
        carrier: 'Airtel 5G',
        simulatedAudioTranscript: 'Hello bhaiya, main Amazon delivery se bol raha hoon. Aapka parcel leke main building ke main gate pe khada hoon. Parcel security ke paas chhod dun ya door pe aaoon?'
      };
    } else {
      payload = {
        phoneNumber: '+91 88001 99223',
        callerName: 'Premier Platinum Bank',
        callPresentationMode: 'ALLOWED',
        location: 'Delhi, DL',
        carrier: 'Jio 5G',
        simulatedAudioTranscript: 'Good afternoon sir! You have been pre-approved for an exclusive lifetime-free credit card with 10 lakh limit. Can you please spare two minutes to complete your KYC?'
      };
    }

    setIncomingCall(payload);
    setActiveResult(null);
    setIsScreening(true);

    try {
      const result = await ApiService.screenCall(payload);
      setActiveResult(result);
      setLogs((prev) => [result, ...prev]);
      ApiService.getStats().then(setStats).catch(() => {});
    } catch (e) {
      console.error('Error simulating call:', e);
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

  const handleLaunchSandboxScenario = (scenario: SimulationScenario) => {
    const payload: IncomingCallPayload = {
      phoneNumber: scenario.phoneNumber,
      callerName: scenario.callerName,
      callPresentationMode: 'ALLOWED',
      simulatedAudioTranscript: scenario.simulatedAudioTranscript,
      stirShakenStatus: scenario.stirShakenStatus,
      initialPhase: 'SCREENING'
    };
    setIncomingCall(payload);
    setShowSandbox(false);
    setIsScreening(true);
    ApiService.screenCall(payload).then((res) => {
      setActiveResult(res);
      setLogs((prev) => [res, ...prev]);
      ApiService.getStats().then(setStats).catch(() => {});
    }).catch(console.error);
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
      <div className={`mobile-device-frame ${isWideLayout ? 'wide-layout' : ''}`}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setIsWideLayout(!isWideLayout)}
              title={isWideLayout ? "Switch to Phone Frame Preview" : "Switch to Expanded Dashboard"}
              aria-label="Toggle Layout Mode"
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 'var(--radius-full)',
                background: isWideLayout ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                color: isWideLayout ? 'var(--accent-glow)' : 'var(--text-secondary)',
                border: '1px solid ' + (isWideLayout ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)'),
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {isWideLayout ? <Smartphone size={13} /> : <Maximize2 size={13} />}
              <span className="hide-on-mobile">{isWideLayout ? 'Compact' : 'Expand'}</span>
            </button>

            <button
              onClick={() => setShowSandbox(!showSandbox)}
              title="Adversarial AI Call Sandbox"
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 9px',
                borderRadius: 'var(--radius-full)',
                background: showSandbox ? 'var(--accent-glow)' : 'rgba(255,255,255,0.06)',
                color: showSandbox ? '#0a0f1d' : 'var(--accent-glow)',
                border: '1px solid ' + (showSandbox ? 'var(--accent-glow)' : 'rgba(99,102,241,0.3)'),
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Terminal size={12} />
              <span>Sandbox</span>
            </button>

            <button
              onClick={refreshAllData}
              title="Refresh Status"
              style={{ color: 'var(--text-secondary)', padding: 6 }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {/* Scrollable Main Views */}
        <main className="app-content">
          {showSandbox && (
            <CallSimulatorSandbox onLaunchLiveCall={handleLaunchSandboxScenario} />
          )}

          {activeTab === 'dashboard' && (
            <DashboardTab
              stats={stats}
              recentLogs={logs}
              backendStatus={backendStatus}
              roleGranted={roleGranted}
              onLaunchSimulator={() => setActiveTab('dialer')}
              onSelectLog={(log) => setSelectedLog(log)}
              onNavigateToTab={(tab) => setActiveTab(tab as TabId)}
              onSimulateScenario={handleSimulateScenario}
            />
          )}

          {activeTab === 'dialer' && (
            <DialerTab
              onIncomingCallPayload={handleDialerAiScreen}
              onOutgoingCall={handleOutgoingCall}
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
