import React from 'react';
import { LayoutDashboard, Radio, History, Shield, Settings } from 'lucide-react';

export type TabId = 'dashboard' | 'simulator' | 'logs' | 'rules' | 'settings';

interface NavbarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, unreadCount = 0 }) => {
  const tabs = [
    { id: 'dashboard' as TabId, label: 'Overview', icon: LayoutDashboard },
    { id: 'simulator' as TabId, label: 'Screener', icon: Radio },
    { id: 'logs' as TabId, label: 'History', icon: History, badge: unreadCount },
    { id: 'rules' as TabId, label: 'Rules', icon: Shield },
    { id: 'settings' as TabId, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bottom-nav-bar" aria-label="Bottom Navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`nav-btn-${tab.id}`}
            className={`nav-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <div className="nav-icon-wrap" style={{ position: 'relative' }}>
              <Icon size={20} />
              {tab.badge && tab.badge > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    backgroundColor: 'var(--accent-glow)',
                    color: '#fff',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
