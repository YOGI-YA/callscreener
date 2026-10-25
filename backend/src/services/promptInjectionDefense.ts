/**
 * PromptInjectionDefense Service
 * ──────────────────────────────
 * Industry-grade zero-trust defense layer against adversarial prompt injection,
 * LLM jailbreaking, high-entropy cipher smuggling, and telephony audio social-engineering exploits.
 */

const INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous\s+|prior\s+|above\s+)?(instructions|prompts|rules|guidelines|system\s+rules)\b/i,
  /\bdisregard\s+(all\s+)?(previous\s+|prior\s+|above\s+)?(instructions|prompts|rules|guidelines|system\s+rules)\b/i,
  /\byou\s+are\s+now\s+in\s+(developer|dan|unrestricted|god)\s+mode\b/i,
  /\b(dan\s+mode|developer\s+mode|unrestricted\s+mode)\b/i,
  /\bsystem\s+(prompt\s*)?(override|bypass|leak|reveal|directive)\b/i,
  /\bemergency\s+override\s+code\b/i,
  /\btell\s+the\s+(recipient|user|owner)\s+(that\s+)?(you\s+verified|i\s+am\s+verified|i\s+am\s+their\s+bank)\b/i,
  /\btell\s+(the\s+)?(user|recipient)\s+to\s+(transfer|wire|send\s+money|read\s+(the\s+)?otp|read\s+(the\s+)?code)\b/i,
  /\bbypass\s+(the\s+)?(security\s+check|screening|verification|filters)\b/i,
  /\bpretend\s+to\s+be\s+an\s+ai\s+without\s+restrictions\b/i,
  /\bsay\s+yes\s+to\s+everything\b/i,
  /\boutput\s+verdict\s+allow\b/i,
  /```[\s\S]*?```/,
  /\bjailbreak\b/i,
  // Hindi & Hinglish Adversarial Injections
  /\b(purane|pichle)\s+(sabhi\s+)?(nirdesh|instructions?)\s+(bhool|disregard|ignore)\s*(jao|karo)?\b/i,
  /\b(system\s+prompt|system\s+rules?)\s+(batao|reveal|leak|dikhao)\b/i,
  /\b(call\s+ko\s+allow\s+karo|allow\s+verdict\s+do|safelist\s+karo)\b/i,
  /\b(apne\s+aap\s+ko\s+unrestricted|developer\s+mode\s+mein\s+lao)\b/i,
  /\b(suraksha\s+filters?\s+bypass\s+karo|security\s+bypass\s+karo)\b/i,
  // Delimiter Hijacking & Tag Smuggling
  /<script[\s\S]*?>/i,
  /<\/?[a-z][\s\S]*>/i,
  /\b(role:\s*assistant|role:\s*system)\b/i,
  /\[system_prompt\]/i,
  /\[SYSTEM_MESSAGE\]/i,
  /\b(print|echo|repeat|reveal|dump)\s+(your\s+)?(system\s+prompt|initial\s+prompt|hidden\s+rules|developer\s+instructions)\b/i,
  /\b(act\s+as\s+an\s+unfiltered|behave\s+without\s+any\s+safety\s+filter)\b/i
];

// Common Cyrillic and Greek homoglyphs mapped to ASCII equivalents
const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y', '\u0445': 'x',
  '\u0410': 'A', '\u0415': 'E', '\u041E': 'O', '\u0420': 'P', '\u0421': 'C', '\u0422': 'T', '\u0425': 'X',
  '\u03BF': 'o', '\u03B1': 'a', '\u03BD': 'v'
};

export interface DefenseInspectionResult {
  isInjectionAttempt: boolean;
  sanitizedText: string;
  threatScoreBoost: number;
  threatLevel: 'HIGH' | 'MEDIUM' | 'SAFE';
  rationale?: string;
  shannonEntropy?: number;
  isHighEntropyCipher?: boolean;
}

/**
 * Calculates Shannon entropy (bits per character) to detect high-entropy encoded payloads
 */
export function calculateShannonEntropy(text: string): number {
  if (!text || text.length === 0) return 0;
  const frequencies = new Map<string, number>();
  for (const char of text) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  const len = text.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Math.round(entropy * 100) / 100;
}

/**
 * Normalizes unicode homoglyphs to plain latin characters
 */
export function normalizeHomoglyphs(text: string): string {
  let normalized = text;
  for (const [homoglyph, replacement] of Object.entries(HOMOGLYPH_MAP)) {
    if (normalized.includes(homoglyph)) {
      normalized = normalized.split(homoglyph).join(replacement);
    }
  }
  return normalized;
}

export function inspectCallerUtterance(rawText: string): DefenseInspectionResult {
  if (!rawText || rawText.trim() === '') {
    return {
      isInjectionAttempt: false,
      sanitizedText: rawText || '',
      threatScoreBoost: 0,
      threatLevel: 'SAFE',
    };
  }

  // Strip zero-width characters and invisible unicode homoglyphs used for evasion
  let normalizedText = rawText.replace(/[\u200B-\u200D\uFEFF]/g, '');
  normalizedText = normalizeHomoglyphs(normalizedText);

  let detected = false;
  let reason: string | undefined;
  let sanitized = normalizedText;

  for (const pattern of INJECTION_PATTERNS) {
    const match = pattern.exec(normalizedText);
    if (match) {
      detected = true;
      reason = `Adversarial Prompt Injection / Jailbreak attempt detected: '${match[0]}'`;
      sanitized = sanitized.replace(pattern, '[BLOCKED_INJECTION_ATTEMPT]');
    }
  }

  // Detect base64 obfuscated payload injections
  const base64Matches = normalizedText.match(/\b(?:[A-Za-z0-9+/]{4}){6,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?\b/g);
  if (base64Matches) {
    for (const b64 of base64Matches) {
      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        if (INJECTION_PATTERNS.some((p) => p.test(decoded))) {
          detected = true;
          reason = `Adversarial Base64 obfuscated prompt injection detected`;
          sanitized = sanitized.replace(b64, '[BLOCKED_BASE64_INJECTION]');
          break;
        }
      } catch {
        // Not valid utf8, ignore
      }
    }
  }

  // Shannon entropy check for encrypted/obfuscated cipher strings (>4.8 bits/char in words >30 chars)
  const entropy = calculateShannonEntropy(normalizedText);
  let isHighEntropy = false;
  if (normalizedText.length > 35 && entropy > 4.75 && !detected) {
    isHighEntropy = true;
    detected = true;
    reason = `High-entropy cipher payload detected (${entropy} bits/char)`;
    sanitized = '[BLOCKED_HIGH_ENTROPY_PAYLOAD]';
  }

  return {
    isInjectionAttempt: detected,
    sanitizedText: sanitized,
    threatScoreBoost: detected ? 45 : 0,
    threatLevel: detected ? 'HIGH' : 'SAFE',
    rationale: reason,
    shannonEntropy: entropy,
    isHighEntropyCipher: isHighEntropy
  };
}

/**
 * Canary Token Sentinel: Creates and validates runtime canary markers
 * to detect any inadvertent prompt leakage in outgoing AI responses.
 */
export class CanarySentinel {
  public static generateCanary(): string {
    return `AEGIS_CANARY_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  public static isCanaryLeaked(aiOutput: string, activeCanaries: string[]): boolean {
    if (!aiOutput || activeCanaries.length === 0) return false;
    return activeCanaries.some(canary => aiOutput.includes(canary));
  }
}
