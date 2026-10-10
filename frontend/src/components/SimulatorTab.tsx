import React, { useState } from 'react';
import { Radio, PhoneCall, Sparkles, AlertCircle, ShieldAlert, CheckCircle, Flame, UserCheck, ShieldX } from 'lucide-react';
import { IncomingCallPayload } from '../types';

interface SimulatorTabProps {
  onSimulateCall: (payload: IncomingCallPayload) => void;
  isLoading: boolean;
}

export const SimulatorTab: React.FC<SimulatorTabProps> = ({ onSimulateCall, isLoading }) => {
  const [phoneNumber, setPhoneNumber] = useState('+1 (202) 555-0144');
  const [callerName, setCallerName] = useState('IRS Criminal Investigation');
  const [location, setLocation] = useState('Washington, DC');
  const [carrier, setCarrier] = useState('VoIP Enterprise');
  const [transcript, setTranscript] = useState('This is Officer Davis from the IRS. You have an arrest warrant for tax fraud. Pay via gift cards to settle immediately.');
  const [inAddressBook, setInAddressBook] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);

  const presets = [
    {
      id: 'irs-scam',
      title: 'IRS Arrest Warrant Scam',
      badge: 'Critical Phishing',
      icon: ShieldX,
      color: 'var(--color-danger)',
      data: {
        phoneNumber: '+1 (202) 555-0144',
        callerName: 'IRS Criminal Investigation Unit',
        location: 'Washington, DC',
        carrier: 'VoIP Telecom',
        simulatedAudioTranscript: 'This is Officer Davis from the IRS. You have an arrest warrant for tax fraud. Pay via gift cards to settle immediately.',
        callerIntent: 'Government impersonation scam',
        contactExistsInAddressBook: false,
        callPresentationMode: 'ALLOWED' as const
      }
    },
    {
      id: 'auto-warranty',
      title: 'Auto Warranty Robocall',
      badge: 'Spam Bot',
      icon: Flame,
      color: 'var(--color-danger)',
      data: {
        phoneNumber: '+1 (888) 555-0199',
        callerName: 'Vehicle Protection Center',
        location: 'Toll-Free USA',
        carrier: 'Cloud Telecom',
        simulatedAudioTranscript: 'We have been trying to reach you regarding your car warranty expired notice. Press 1 now to speak to a specialist.',
        callerIntent: 'Robocall lead generator',
        contactExistsInAddressBook: false,
        callPresentationMode: 'ALLOWED' as const
      }
    },
    {
      id: 'amazon-delivery',
      title: 'Amazon Delivery Courier',
      badge: 'Safe Courier',
      icon: CheckCircle,
      color: 'var(--color-safe)',
      data: {
        phoneNumber: '+1 (415) 555-8392',
        callerName: 'Amazon Logistics Driver',
        location: 'San Francisco, CA',
        carrier: 'T-Mobile',
        simulatedAudioTranscript: 'Hi, this is your Amazon driver at the front gate with your package delivery. Could you buzz me in?',
        callerIntent: 'Delivery gate access',
        contactExistsInAddressBook: false,
        callPresentationMode: 'ALLOWED' as const
      }
    },
    {
      id: 'doctor-clinic',
      title: 'Doctor Appointment Reminder',
      badge: 'Safe Medical',
      icon: UserCheck,
      color: 'var(--color-safe)',
      data: {
        phoneNumber: '+1 (650) 555-3000',
        callerName: 'Stanford Health Care',
        location: 'Palo Alto, CA',
        carrier: 'AT&T',
        simulatedAudioTranscript: 'Hello, calling from Stanford Health to confirm your scheduled cardiology consultation tomorrow at 10 AM.',
        callerIntent: 'Medical appointment',
        contactExistsInAddressBook: true,
        callPresentationMode: 'ALLOWED' as const
      }
    },
    {
      id: 'toll-fraud',
      title: 'Premium 1-900 Toll Scam',
      badge: 'Local Fast Rule Block',
      icon: ShieldAlert,
      color: 'var(--color-danger)',
      data: {
        phoneNumber: '+1 (900) 555-0188',
        callerName: 'Live Chat Network',
        location: 'Toll Premium Line',
        carrier: 'Unknown',
        simulatedAudioTranscript: 'You have won a free vacation cruise. Stay on the line to claim your prize voucher.',
        callerIntent: 'Toll charge fraud',
        contactExistsInAddressBook: false,
        callPresentationMode: 'ALLOWED' as const
      }
    }
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    setPhoneNumber(preset.data.phoneNumber);
    setCallerName(preset.data.callerName);
    setLocation(preset.data.location);
    setCarrier(preset.data.carrier);
    setTranscript(preset.data.simulatedAudioTranscript);
    setInAddressBook(Boolean(preset.data.contactExistsInAddressBook));
    setIsRestricted(preset.data.callPresentationMode === ('RESTRICTED' as any));
  };

  const handleTriggerCustom = () => {
    onSimulateCall({
      phoneNumber,
      callerName,
      location,
      carrier,
      simulatedAudioTranscript: transcript,
      callerIntent: 'Custom simulation test',
      contactExistsInAddressBook: inAddressBook,
      callPresentationMode: isRestricted ? 'RESTRICTED' : 'ALLOWED'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Info */}
      <div className="glass-card" style={{ border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Radio size={18} color="var(--accent-glow)" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Call Screening Simulator</h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Test Android Telecom screening events and AI LLM evaluation in real-time. Pick a preset scam or construct custom caller payloads.
        </p>
      </div>

      {/* Canned Presets */}
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          One-Click Test Presets
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {presets.map((preset) => {
            const Icon = preset.icon;
            return (
              <div
                key={preset.id}
                className="glass-card"
                onClick={() => handleApplyPreset(preset)}
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Icon size={18} color={preset.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{preset.title}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {preset.data.phoneNumber}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSimulateCall(preset.data);
                  }}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  <PhoneCall size={12} /> Test
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Call Builder */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} color="var(--accent-glow)" />
          <span>Custom Caller Payload</span>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Phone Number
          </label>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Caller Name (CNAM)
            </label>
            <input
              type="text"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Location / City
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Opening Voice Speech Transcript (AI Analyzed)
          </label>
          <textarea
            rows={3}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              resize: 'none'
            }}
          />
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={inAddressBook}
              onChange={(e) => setInAddressBook(e.target.checked)}
            />
            <span>In Contacts Book</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isRestricted}
              onChange={(e) => setIsRestricted(e.target.checked)}
            />
            <span>Restricted / Withheld</span>
          </label>
        </div>

        <button
          onClick={handleTriggerCustom}
          disabled={isLoading}
          className="btn-primary"
          style={{ width: '100%', marginTop: 8, padding: '14px 20px' }}
        >
          <PhoneCall size={18} />
          <span>{isLoading ? 'Screening Call...' : 'Trigger Simulated Call'}</span>
        </button>
      </div>
    </div>
  );
};
