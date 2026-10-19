/**
 * PromptInjectionDefense Service
 * ──────────────────────────────
 * Industry-grade zero-trust defense layer against adversarial prompt injection,
 * LLM jailbreaking, and telephony audio social-engineering exploits.
 */

const INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)\b/i,
  /\bdisregard\s+(all\s+)?(previous|prior)\s+instructions\b/i,
  /\byou\s+are\s+now\s+in\s+(developer|dan|unrestricted|god)\s+mode\b/i,
  /\bsystem\s+prompt\s*(override|bypass|leak|reveal)\b/i,
  /\bemergency\s+override\s+code\b/i,
  /\btell\s+the\s+(recipient|user|owner)\s+(that\s+)?(you\s+verified|i\s+am\s+verified|i\s+am\s+their\s+bank)\b/i,
  /\btell\s+(the\s+)?(user|recipient)\s+to\s+(transfer|wire|send\s+money|read\s+(the\s+)?otp|read\s+(the\s+)?code)\b/i,
  /\bbypass\s+(the\s+)?(security\s+check|screening|verification)\b/i,
  /\bpretend\s+to\s+be\s+an\s+ai\s+without\s+restrictions\b/i,
  /\bsay\s+yes\s+to\s+everything\b/i,
  /\bjailbreak\b/i,
];

export interface DefenseInspectionResult {
  isInjectionAttempt: boolean;
  sanitizedText: string;
  threatScoreBoost: number;
  rationale?: string;
}

export function inspectCallerUtterance(rawText: string): DefenseInspectionResult {
  if (!rawText || rawText.trim() === '') {
    return {
      isInjectionAttempt: false,
      sanitizedText: rawText || '',
      threatScoreBoost: 0,
    };
  }

  let detected = false;
  let reason: string | undefined;
  let sanitized = rawText;

  for (const pattern of INJECTION_PATTERNS) {
    const match = pattern.exec(rawText);
    if (match) {
      detected = true;
      reason = `Adversarial Prompt Injection / Jailbreak attempt detected: '${match[0]}'`;
      sanitized = sanitized.replace(pattern, '[BLOCKED_INJECTION_ATTEMPT]');
    }
  }

  return {
    isInjectionAttempt: detected,
    sanitizedText: sanitized,
    threatScoreBoost: detected ? 45 : 0,
    rationale: reason,
  };
}
