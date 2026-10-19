package com.aegiscall.screener.telecom

import android.util.Log

/**
 * PromptInjectionDefense
 * ──────────────────────
 * Industry-grade zero-trust defense layer against adversarial prompt injection,
 * LLM jailbreaking, and telephony audio social-engineering exploits.
 *
 * Prevents callers from tricking the AI assistant into verifying them falsely,
 * overriding system policies, or relaying fraudulent demands to the user.
 */
object PromptInjectionDefense {

    private const val TAG = "PromptInjectionDefense"

    private val INJECTION_PATTERNS = listOf(
        Regex("(?i)\\bignore\\s+(all\\s+)?(previous|prior|above)\\s+(instructions|prompts|rules)\\b"),
        Regex("(?i)\\bdisregard\\s+(all\\s+)?(previous|prior)\\s+instructions\\b"),
        Regex("(?i)\\byou\\s+are\\s+now\\s+in\\s+(developer|dan|unrestricted|god)\\s+mode\\b"),
        Regex("(?i)\\bsystem\\s+prompt\\s*(override|bypass|leak|reveal)\\b"),
        Regex("(?i)\\bemergency\\s+override\\s+code\\b"),
        Regex("(?i)\\btell\\s+the\\s+(recipient|user|owner)\\s+(that\\s+)?(you\\s+verified|i\\s+am\\s+verified|i\\s+am\\s+their\\s+bank)\\b"),
        Regex("(?i)\\btell\\s+(the\\s+)?(user|recipient)\\s+to\\s+(transfer|wire|send\\s+money|read\\s+(the\\s+)?otp|read\\s+(the\\s+)?code)\\b"),
        Regex("(?i)\\bbypass\\s+(the\\s+)?(security\\s+check|screening|verification)\\b"),
        Regex("(?i)\\bpretend\\s+to\\s+be\\s+an\\s+ai\\s+without\\s+restrictions\\b"),
        Regex("(?i)\\bsay\\s+yes\\s+to\\s+everything\\b"),
        Regex("(?i)\\bjailbreak\\b")
    )

    data class DefenseResult(
        val isInjectionAttempt: Boolean,
        val sanitizedText: String,
        val threatScoreBoost: Int,
        val rationale: String? = null
    )

    /**
     * Inspects caller transcript text in real time (<1ms) for adversarial injection patterns.
     */
    fun inspectCallerUtterance(rawText: String): DefenseResult {
        if (rawText.isBlank()) {
            return DefenseResult(isInjectionAttempt = false, sanitizedText = rawText, threatScoreBoost = 0)
        }

        var detected = false
        var reason: String? = null
        var sanitized = rawText

        for (pattern in INJECTION_PATTERNS) {
            val match = pattern.find(rawText)
            if (match != null) {
                detected = true
                reason = "Adversarial Prompt Injection / Jailbreak attempt detected: '${match.value}'"
                Log.w(TAG, "Security alert: $reason in utterance: '$rawText'")
                sanitized = pattern.replace(sanitized, "[BLOCKED_INJECTION_ATTEMPT]")
            }
        }

        return if (detected) {
            DefenseResult(
                isInjectionAttempt = true,
                sanitizedText = sanitized,
                threatScoreBoost = 45, // Boost threat score towards critical rejection
                rationale = reason
            )
        } else {
            DefenseResult(
                isInjectionAttempt = false,
                sanitizedText = rawText,
                threatScoreBoost = 0
            )
        }
    }
}
