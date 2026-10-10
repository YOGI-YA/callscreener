package com.aegiscall.screener.telecom

import android.content.Context
import android.telecom.CallScreeningService.CallResponse
import com.aegiscall.screener.models.CallResponseActions
import com.aegiscall.screener.models.ScreeningData
import java.util.UUID

object FastLocalRulesEngine {

    private val emergencyRegex = Regex("^(911|112|999|988|100|101|102)$")
    private val tollFraudRegex = Regex("^(\\+?1?(900|976))")
    private val satelliteFraudRegex = Regex("^(\\+?881|\\+?882|\\+?883|\\+?247|\\+?290)")
    private val spoofedZerosRegex = Regex("^(\\+?0+|0{7,15}|\\+?1?0000000000)$")

    /**
     * Executes instant local regex & heuristic evaluation (<2ms)
     */
    fun evaluate(context: Context, rawPhoneNumber: String?): ScreeningData? {
        if (rawPhoneNumber.isNullOrBlank()) {
            return generateFallback(rawPhoneNumber ?: "Unknown", "Empty caller ID")
        }

        val clean = rawPhoneNumber.replace(Regex("[\\s\\-\\(\\)\\.]"), "")

        // 1. Emergency Numbers - Must ALWAYS allow
        if (emergencyRegex.matches(clean) || emergencyRegex.matches(rawPhoneNumber)) {
            return ScreeningData(
                id = "local-${UUID.randomUUID()}",
                phoneNumber = rawPhoneNumber,
                callerName = "Emergency Services",
                verdict = "ALLOW",
                riskScore = 0,
                riskLevel = "SAFE",
                category = "VERIFIED_CONTACT",
                confidence = 1.0,
                rationale = "Emergency services bypass triggered.",
                engine = "FAST_LOCAL_FALLBACK",
                latencyMs = 1L,
                timestamp = System.currentTimeMillis().toString(),
                suggestedActions = CallResponseActions(disallowCall = false, silenceCall = false, rejectCall = false)
            )
        }

        // 2. High-Risk Toll / Satellite / Malformed Blocks
        if (tollFraudRegex.containsMatchIn(clean) || satelliteFraudRegex.containsMatchIn(clean) || spoofedZerosRegex.matches(clean)) {
            return ScreeningData(
                id = "local-${UUID.randomUUID()}",
                phoneNumber = rawPhoneNumber,
                callerName = "High Risk Fraud Prefix",
                verdict = "REJECT",
                riskScore = 98,
                riskLevel = "CRITICAL_SPAM",
                category = "ROBOCALL",
                confidence = 0.99,
                rationale = "Matched native high-risk fraud prefix rule.",
                engine = "FAST_LOCAL_FALLBACK",
                latencyMs = 1L,
                timestamp = System.currentTimeMillis().toString(),
                suggestedActions = CallResponseActions(disallowCall = true, silenceCall = false, rejectCall = true, skipNotification = true)
            )
        }

        return null
    }

    /**
     * Safe fallback when backend network call times out or fails
     */
    fun generateFallback(phoneNumber: String, reason: String): ScreeningData {
        return ScreeningData(
            id = "fallback-${UUID.randomUUID()}",
            phoneNumber = phoneNumber,
            callerName = "Unknown Caller",
            verdict = "ALLOW",
            riskScore = 25,
            riskLevel = "LOW",
            category = "UNKNOWN",
            confidence = 0.5,
            rationale = "Native fallback applied ($reason). Call allowed through safely.",
            engine = "FAST_LOCAL_FALLBACK",
            latencyMs = 1L,
            timestamp = System.currentTimeMillis().toString(),
            suggestedActions = CallResponseActions(disallowCall = false, silenceCall = false, rejectCall = false)
        )
    }

    /**
     * Converts ScreeningData into Android OS CallResponse
     */
    fun buildAndroidCallResponse(screeningData: ScreeningData): CallResponse {
        val builder = CallResponse.Builder()

        when (screeningData.verdict) {
            "REJECT" -> {
                builder.setDisallowCall(true)
                builder.setRejectCall(true)
                builder.setSkipNotification(true)
                builder.setSkipCallLog(false)
            }
            "SILENCE" -> {
                builder.setDisallowCall(false)
                builder.setSilenceCall(true)
                builder.setSkipNotification(false)
                builder.setSkipCallLog(false)
            }
            "ALLOW" -> {
                builder.setDisallowCall(false)
                builder.setSilenceCall(false)
            }
            else -> {
                builder.setDisallowCall(false)
            }
        }

        return builder.build()
    }
}
