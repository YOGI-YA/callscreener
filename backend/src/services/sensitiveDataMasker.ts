/**
 * SensitiveDataMasker Service
 * ────────────────────────────
 * Enterprise PII & Sensitive Financial Data redaction engine.
 * Ensures zero credential or financial leakage in transcripts, logs, and storage.
 */

const CREDIT_CARD_REGEX = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11}|(?:\d{4}[\s\-]){3}\d{4})\b/g;
const SSN_REGEX = /\b\d{3}[\-\s]?\d{2}[\-\s]?\d{4}\b/g;
const OTP_REGEX = /\b(otp|code|pin|passcode|token|verification)\s*(is|:)?\s*(\d{4,8})\b/gi;
const CVV_REGEX = /\b(cvv|cvc|security code)\s*(is|:)?\s*(\d{3,4})\b/gi;
const BANK_ACCOUNT_REGEX = /\b(account|routing)\s*(number|no|#)?\s*(is|:)?\s*(\d{8,17})\b/gi;

export function maskSensitiveText(text: string | null | undefined): string {
  if (!text || text.trim() === '') return text || '';

  let masked = text;

  // Mask Credit Cards
  masked = masked.replace(CREDIT_CARD_REGEX, (match) => {
    const clean = match.replace(/[\s\-]/g, '');
    if (clean.length >= 13) {
      return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
    }
    return '[REDACTED_CARD]';
  });

  // Mask SSN
  masked = masked.replace(SSN_REGEX, '[REDACTED_SSN]');

  // Mask OTP / PIN
  masked = masked.replace(OTP_REGEX, (_match, p1, p2) => {
    return `${p1} ${p2 || ''} [REDACTED_OTP]`;
  });

  // Mask CVV
  masked = masked.replace(CVV_REGEX, (_match, p1, p2) => {
    return `${p1} ${p2 || ''} [REDACTED_CVV]`;
  });

  // Mask Bank Accounts
  masked = masked.replace(BANK_ACCOUNT_REGEX, (_match, p1, p2, p3) => {
    return `${p1} ${p2 || ''} ${p3 || ''} [REDACTED_ACCOUNT]`;
  });

  return masked;
}
