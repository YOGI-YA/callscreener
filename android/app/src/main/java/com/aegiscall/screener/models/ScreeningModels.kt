package com.aegiscall.screener.models

import com.google.gson.annotations.SerializedName

data class IncomingCallRequest(
    val phoneNumber: String,
    val callerName: String? = null,
    val location: String? = null,
    val carrier: String? = null,
    val timestamp: String? = null,
    val contactExistsInAddressBook: Boolean = false,
    val callPresentationMode: String = "ALLOWED"
)

data class ScreeningResponse(
    val success: Boolean,
    val data: ScreeningData? = null,
    val error: String? = null
)

data class ScreeningData(
    val id: String,
    val phoneNumber: String,
    val callerName: String,
    val verdict: String, // "ALLOW", "SILENCE", "REJECT"
    val riskScore: Int,
    val riskLevel: String,
    val category: String,
    val confidence: Double,
    val rationale: String,
    val engine: String,
    val latencyMs: Long,
    val timestamp: String,
    val suggestedActions: CallResponseActions
)

data class CallResponseActions(
    @SerializedName("disallowCall") val disallowCall: Boolean = false,
    @SerializedName("silenceCall") val silenceCall: Boolean = false,
    @SerializedName("rejectCall") val rejectCall: Boolean = false,
    @SerializedName("skipCallLog") val skipCallLog: Boolean = false,
    @SerializedName("skipNotification") val skipNotification: Boolean = false
)

data class ScreeningRuleItem(
    val id: String,
    val type: String,
    val pattern: String,
    val description: String,
    val action: String,
    val enabled: Boolean
)
