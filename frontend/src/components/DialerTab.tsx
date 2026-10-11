import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Search, User, Clock, ChevronRight, Delete, Mic, Sparkles
} from 'lucide-react';
import { CapacitorService } from '../services/capacitorService';

interface Contact {
  id: string;
  name: string;
  number: string;
}

interface DeviceCall {
  number: string;
  name: string;
  type: string;
  date: number;
  duration: number;
}

type DialerSection = 'recent' | 'contacts' | 'keypad';

interface DialerTabProps {
  onIncomingCallPayload?: (phone: string, name: string) => void;
  onOutgoingCall?: (phone: string, name: string) => void;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 604800000) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getDay()];
  }
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function getInitials(name: string): string {
  if (!name) return '#';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
];

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const DialerTab: React.FC<DialerTabProps> = ({ onIncomingCallPayload, onOutgoingCall }) => {
  const [section, setSection] = useState<DialerSection>('recent');
  const [dialNumber, setDialNumber] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callLog, setCallLog] = useState<DeviceCall[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [c, cl] = await Promise.all([
      CapacitorService.getContacts(),
      CapacitorService.getDeviceCallLog(200),
    ]);
    setContacts(c);
    setCallLog(cl);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDial = (digit: string) => {
    CapacitorService.triggerHapticFeedback();
    CapacitorService.playDtmfTone(digit);
    setDialNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setDialNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = async (number: string, name?: string) => {
    const target = number || dialNumber;
    if (!target) return;
    CapacitorService.triggerHapticFeedback();
    await CapacitorService.makeCall(target);
    if (onOutgoingCall) {
      onOutgoingCall(target, name || 'Outgoing Call');
    }
  };

  const handleAiScreen = (number: string, name: string) => {
    if (onIncomingCallPayload) onIncomingCallPayload(number, name);
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.number.includes(searchQuery)
  );

  const filteredCallLog = callLog.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.number.includes(searchQuery)
  );

  const KEYS = [
    ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
    ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
    ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
    ['*', ''], ['0', '+'], ['#', ''],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Section Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          background: 'rgba(15, 23, 42, 0.8)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        {[
          { id: 'recent' as DialerSection, label: 'Recents', icon: Clock },
          { id: 'contacts' as DialerSection, label: 'Contacts', icon: User },
          { id: 'keypad' as DialerSection, label: 'Keypad', icon: Phone },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            style={{
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: section === id ? 'var(--accent-glow)' : 'var(--text-muted)',
              borderBottom: section === id ? '2px solid var(--accent-glow)' : '2px solid transparent',
              fontSize: '0.7rem',
              fontWeight: section === id ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Search bar (for recents + contacts) */}
      {section !== 'keypad' && (
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={section === 'contacts' ? 'Search contacts…' : 'Search call history…'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px 8px 32px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ========== RECENTS ========== */}
        {section === 'recent' && (
          <div>
            {isLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading call history…
              </div>
            ) : filteredCallLog.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No call history</div>
                <div style={{ fontSize: '0.75rem', marginTop: 4 }}>Your calls will appear here</div>
              </div>
            ) : (
              filteredCallLog.map((call, idx) => {
                const CallIcon =
                  call.type === 'INCOMING' ? PhoneIncoming :
                  call.type === 'OUTGOING' ? PhoneOutgoing :
                  call.type === 'MISSED' || call.type === 'REJECTED' ? PhoneMissed :
                  Phone;
                const callColor =
                  call.type === 'MISSED' || call.type === 'REJECTED' ? 'var(--color-danger)' :
                  call.type === 'INCOMING' ? 'var(--color-safe)' : 'var(--accent-glow)';
                const displayName = call.name || call.number;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      gap: 12,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: call.name ? avatarColor(call.name) : 'rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {call.name ? getInitials(call.name) : <User size={18} />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: callColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <CallIcon size={12} color={callColor} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {call.type.charAt(0) + call.type.slice(1).toLowerCase()} • {formatDate(call.date)}
                          {call.duration > 0 && ` • ${formatDuration(call.duration)}`}
                        </span>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleAiScreen(call.number, call.name)}
                        style={{
                          padding: '6px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Screen Call with AI"
                      >
                        <Sparkles size={14} color="var(--accent-glow)" />
                      </button>
                      <button
                        onClick={() => handleCall(call.number, call.name)}
                        style={{
                          padding: '6px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Phone size={14} color="var(--color-safe)" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========== CONTACTS ========== */}
        {section === 'contacts' && (
          <div>
            {isLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading contacts…
              </div>
            ) : filteredContacts.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                <User size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No contacts found</div>
                <div style={{ fontSize: '0.75rem', marginTop: 4 }}>Grant contacts permission in Settings to sync</div>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: avatarColor(contact.name),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(contact.name)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {contact.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {contact.number}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleAiScreen(contact.number, contact.name)}
                      style={{
                        padding: '6px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Screen Call with AI"
                    >
                      <Sparkles size={14} color="var(--accent-glow)" />
                    </button>
                    <button
                      onClick={() => handleCall(contact.number, contact.name)}
                      style={{
                        padding: '6px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Phone size={14} color="var(--color-safe)" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ========== KEYPAD ========== */}
        {section === 'keypad' && (
          <div style={{ padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            {/* Display */}
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 54,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: dialNumber.length > 12 ? '1.2rem' : '1.5rem',
                  fontWeight: 600,
                  color: dialNumber ? '#fff' : 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  flex: 1,
                }}
              >
                {dialNumber || 'Enter number…'}
              </span>
              {dialNumber && (
                <button
                  onMouseDown={handleBackspace}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                >
                  <Delete size={20} />
                </button>
              )}
            </div>

            {/* Keypad Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
              }}
            >
              {KEYS.map(([digit, letters]) => (
                <button
                  key={digit}
                  onMouseDown={() => handleDial(digit)}
                  style={{
                    padding: '14px 0',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    transition: 'background 0.1s, transform 0.1s',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: '1.35rem', fontWeight: 600, lineHeight: 1 }}>{digit}</span>
                  {letters && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{letters}</span>}
                </button>
              ))}
            </div>

            {/* Call Button Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
              <div />
              <button
                onClick={() => handleCall(dialNumber)}
                disabled={!dialNumber}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: dialNumber ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: dialNumber ? '0 0 24px rgba(16, 185, 129, 0.5)' : 'none',
                  cursor: dialNumber ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                <Phone size={28} color="#fff" />
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                {dialNumber && (
                  <button
                    onClick={() => handleAiScreen(dialNumber, '')}
                    style={{
                      padding: '10px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Screen Call with AI"
                  >
                    <Sparkles size={20} color="var(--accent-glow)" />
                  </button>
                )}
              </div>
            </div>

            {/* AI hint */}
            {dialNumber && (
              <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Tap <Sparkles size={11} style={{ display: 'inline' }} /> to screen incoming call with AI
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
