package com.aegiscall.screener.telecom

/**
 * SensitiveDataMasker
 * ───────────────────
 * Enterprise PII & Sensitive Financial Data redaction engine.
 * Ensures zero credential or financial leakage in transcripts, logs, and storage.
 */
object SensitiveDataMasker {

    private val CREDIT_CARD_REGEX = Regex("\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\\d{3})\\d{11}|(?:\\d{4}[\\s\\-]){3}\\d{4})\\b")
    private val SSN_REGEX = Regex("\\b\\d{3}[\\-\\s]?\\d{2}[\\-\\s]?\\d{4}\\b")
    private val OTP_REGEX = Regex("(?i)\\b(otp|code|pin|passcode|token|verification)\\s*(is|:)?\\s*(\\d{4,8})\\b")
    private val CVV_REGEX = Regex("(?i)\\b(cvv|cvc|security code)\\s*(is|:)?\\s*(\\d{3,4})\\b")
    private val BANK_ACCOUNT_REGEX = Regex("(?i)\\b(account|routing)\\s*(number|no|#)?\\s*(is|:)?\\s*(\\d{8,17})\\b")

    /**
     * Sanitizes sensitive information from raw transcript strings.
     */
    fun maskSensitiveText(text: String?): String {
        if (text.isNullOrBlank()) return text ?: ""

        var masked = text

        // Mask Credit Cards
        masked = CREDIT_CARD_REGEX.replace(masked) { match ->
            val clean = match.value.replace(Regex("[\\s\\-]"), "")
            if (clean.length >= 13) {
                "${clean.take(4)} **** **** ${clean.takeLast(4)}"
            } else {
                "[REDACTED_CARD]"
            }
        }

        // Mask SSN
        masked = SSN_REGEX.replace(masked, "[REDACTED_SSN]")

        // Mask OTP / PIN
        masked = OTP_REGEX.replace(masked) { match ->
            val label = match.groupValues[1]
            val separator = match.groupValues[2]
            "$label $separator [REDACTED_OTP]"
        }

        // Mask CVV
        masked = CVV_REGEX.replace(masked) { match ->
            val label = match.groupValues[1]
            val separator = match.groupValues[2]
            "$label $separator [REDACTED_CVV]"
        }

        // Mask Bank Accounts
        masked = BANK_ACCOUNT_REGEX.replace(masked) { match ->
            val label = match.groupValues[1]
            val extra = match.groupValues[2]
            val separator = match.groupValues[3]
            "$label $extra $separator [REDACTED_ACCOUNT]"
        }

        return masked
    }
}
