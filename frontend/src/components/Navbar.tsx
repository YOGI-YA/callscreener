import React from 'react';
import { LayoutDashboard, Phone, History, Shield, Settings } from 'lucide-react';

export type TabId = 'dashboard' | 'dialer' | 'logs' | 'rules' | 'settings';

interface NavbarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, unreadCount = 0 }) => {
  const tabs = [
    { id: 'dashboard' as TabId, label: 'Overview', icon: LayoutDashboard },
    { id: 'dialer' as TabId, label: 'Phone', icon: Phone },
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
                <span className="nav-badge">
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
