import React, { useState } from 'react';
import { Shield, Plus, Trash2, CheckCircle2, ShieldBan, ShieldAlert, Sparkles } from 'lucide-react';
import { ScreeningRule, ScreeningVerdict } from '../types';

interface RulesTabProps {
  rules: ScreeningRule[];
  onAddRule: (rule: Omit<ScreeningRule, 'id' | 'createdAt'>) => void;
  onDeleteRule: (id: string) => void;
}

export const RulesTab: React.FC<RulesTabProps> = ({ rules, onAddRule, onDeleteRule }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [pattern, setPattern] = useState('');
  const [description, setDescription] = useState('');
  const [action, setAction] = useState<ScreeningVerdict>('REJECT');
  const [ruleType, setRuleType] = useState<ScreeningRule['type']>('BLACKLIST');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim() || !description.trim()) return;

    onAddRule({
      type: ruleType,
      pattern: pattern.trim(),
      description: description.trim(),
      action,
      enabled: true
    });

    setPattern('');
    setDescription('');
    setShowAddModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header Info */}
      <div className="glass-card" style={{ border: '1px solid var(--border-glow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color="var(--accent-glow)" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Fast Screening Rules</h2>
          </div>
          <button
            onClick={() => setShowAddModal(!showAddModal)}
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
          >
            <Plus size={14} /> New Rule
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          Deterministic local rules execute directly on device in &lt;2ms before LLM queries, saving battery and ensuring zero-latency response deadlines.
        </p>
      </div>

      {/* Add Rule Form Modal / Collapsible */}
      {showAddModal && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-glow)' }}>
            Create Custom Rule
          </h3>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Rule Type
            </label>
            <select
              value={ruleType}
              onChange={(e) => {
                const t = e.target.value as ScreeningRule['type'];
                setRuleType(t);
                if (t === 'WHITELIST') setAction('ALLOW');
                else setAction('REJECT');
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem'
              }}
            >
              <option value="BLACKLIST">Blacklist (Exact Phone Number)</option>
              <option value="PREFIX_BLOCK">Prefix Block (Area / Country Code)</option>
              <option value="WHITELIST">Whitelist (Trusted VIP / Contact)</option>
              <option value="KEYWORD_BLOCK">Keyword Block</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Match Pattern / Number (Regex Supported)
            </label>
            <input
              type="text"
              placeholder="e.g. ^(\+?1900.*) or +1-555-0199"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              Rule Description
            </label>
            <input
              type="text"
              placeholder="e.g. Known scammer bot / Family VIP"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px' }}>
              Save Rule
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="btn-secondary"
              style={{ padding: '10px 14px' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Rules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map((rule) => {
          const isAllow = rule.action === 'ALLOW';
          return (
            <div
              key={rule.id}
              className="glass-card"
              style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '80%' }}>
                <div style={{ marginTop: 2 }}>
                  {isAllow ? (
                    <CheckCircle2 size={18} color="var(--color-safe)" />
                  ) : (
                    <ShieldBan size={18} color="var(--color-danger)" />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    {rule.description}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-glow)', marginTop: 2 }}>
                    {rule.pattern}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Type: {rule.type} • Action: {rule.action}
                  </div>
                </div>
              </div>

              {rule.id.startsWith('custom-rule-') ? (
                <button
                  onClick={() => onDeleteRule(rule.id)}
                  style={{ color: 'var(--text-muted)', padding: '6px' }}
                  title="Remove rule"
                >
                  <Trash2 size={16} />
                </button>
              ) : (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  System Core
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
