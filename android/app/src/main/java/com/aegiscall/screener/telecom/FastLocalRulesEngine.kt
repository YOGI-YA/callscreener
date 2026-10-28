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
    private const val RULES_PREFS = "aegis_screener_rules_prefs"
    private const val RULES_KEY = "custom_rules_json"

    // High-performance in-memory LRU cache for 0ms sub-millisecond lookups
    private val memoryCache = android.util.LruCache<String, ScreeningData>(128)

    /**
     * Initializes and pre-warms regex patterns and caches for boot resilience
     */
    fun initialize(context: Context) {
        try {
            // Touch regexes to pre-warm JIT
            emergencyRegex.matches("911")
            tollFraudRegex.matches("+19001234567")
            satelliteFraudRegex.matches("+8811234567")
            spoofedZerosRegex.matches("0000000000")
        } catch (_: Exception) {}
    }

    /**
     * Executes instant local regex & heuristic evaluation (<2ms)
     */
    fun evaluate(context: Context, rawPhoneNumber: String?): ScreeningData? {
        if (rawPhoneNumber.isNullOrBlank()) {
            return generateFallback(rawPhoneNumber ?: "Unknown", "Empty caller ID")
        }

        val clean = rawPhoneNumber.replace(Regex("[\\s\\-\\(\\)\\.]"), "")

        // Check memory cache first
        val cached = memoryCache.get(clean)
        if (cached != null) {
            return cached.copy(
                id = "cache-${UUID.randomUUID()}",
                timestamp = System.currentTimeMillis().toString(),
                latencyMs = 0L
            )
        }

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
            val res = ScreeningData(
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
            memoryCache.put(clean, res)
            return res
        }

        // 3. User Custom Rules (Blacklist / Whitelist saved in app)
        val customRuleMatch = evaluateCustomRules(context, rawPhoneNumber, clean)
        if (customRuleMatch != null) {
            memoryCache.put(clean, customRuleMatch)
            return customRuleMatch
        }

        return null
    }

    private fun evaluateCustomRules(context: Context, rawPhoneNumber: String, clean: String): ScreeningData? {
        try {
            val prefs = context.getSharedPreferences(RULES_PREFS, Context.MODE_PRIVATE)
            val json = prefs.getString(RULES_KEY, null) ?: return null
            val array = org.json.JSONArray(json)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val enabled = obj.optBoolean("enabled", true)
                if (!enabled) continue

                val patternStr = obj.optString("pattern", "")
                val action = obj.optString("action", "REJECT").uppercase()
                val desc = obj.optString("description", "User custom rule")
                if (patternStr.isBlank()) continue

                val isMatch = try {
                    val regex = Regex(patternStr, RegexOption.IGNORE_CASE)
                    regex.containsMatchIn(rawPhoneNumber) || regex.containsMatchIn(clean)
                } catch (e: Exception) {
                    rawPhoneNumber.contains(patternStr) || clean.contains(patternStr)
                }

                if (isMatch) {
                    val isReject = action == "REJECT"
                    val isSilence = action == "SILENCE"
                    return ScreeningData(
                        id = "user-rule-${UUID.randomUUID()}",
                        phoneNumber = rawPhoneNumber,
                        callerName = if (isReject) "Blocked Contact / Number" else "Whitelisted Contact",
                        verdict = action,
                        riskScore = if (isReject) 95 else if (isSilence) 50 else 0,
                        riskLevel = if (isReject) "CRITICAL_SPAM" else if (isSilence) "MEDIUM" else "SAFE",
                        category = if (isReject) "BLACKLIST" else "WHITELIST",
                        confidence = 1.0,
                        rationale = "Matched user rule: $desc",
                        engine = "USER_RULE_ENGINE",
                        latencyMs = 1L,
                        timestamp = System.currentTimeMillis().toString(),
                        suggestedActions = CallResponseActions(
                            disallowCall = isReject,
                            silenceCall = isSilence,
                            rejectCall = isReject,
                            skipNotification = isReject
                        )
                    )
                }
            }
        } catch (e: Exception) {
            // ignore JSON error
        }
        return null
    }

    fun syncRulesFromJson(context: Context, rulesJson: String) {
        try {
            val prefs = context.getSharedPreferences(RULES_PREFS, Context.MODE_PRIVATE)
            prefs.edit().putString(RULES_KEY, rulesJson).apply()
            memoryCache.evictAll()
        } catch (e: Exception) {
            // ignore
        }
    }

    fun clearCache() {
        memoryCache.evictAll()
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
    fun buildAndroidCallResponse(screeningData: ScreeningData): CallResponse? {
        return try {
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

            builder.build()
        } catch (e: Throwable) {
            null
        }
    }
}
