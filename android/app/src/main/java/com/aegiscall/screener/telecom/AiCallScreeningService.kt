package com.aegiscall.screener.telecom

import android.content.Context
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import com.aegiscall.screener.models.IncomingCallRequest
import com.aegiscall.screener.models.ScreeningData
import com.aegiscall.screener.models.ScreeningResponse
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class AiCallScreeningService : CallScreeningService() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val gson = Gson()

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(1500, TimeUnit.MILLISECONDS)
        .readTimeout(2000, TimeUnit.MILLISECONDS)
        .writeTimeout(1500, TimeUnit.MILLISECONDS)
        .build()

    companion object {
        private const val TAG = "AiCallScreeningService"
        private const val DEFAULT_BACKEND_URL = "http://10.0.2.2:4000/api/screen-call"
        private const val PREFS_NAME = "aegis_call_screener_prefs"
        private const val KEY_API_URL = "backend_api_url"
        private const val NETWORK_DEADLINE_MS = 2500L // Strict response deadline to prevent OS timeout
    }

    override fun onScreenCall(callDetails: Call.Details) {
        val phoneNumber = callDetails.handle?.schemeSpecificPart ?: "Unknown"
        val callerName = callDetails.callerDisplayName
        val presentation = when (callDetails.handlePresentation) {
            1 -> "ALLOWED"
            2 -> "RESTRICTED"
            3 -> "PAYPHONE"
            else -> "UNKNOWN"
        }

        Log.i(TAG, "Incoming Telecom Call received: $phoneNumber ($callerName) [Presentation: $presentation]")

        // 1. Stage 1: Ultra-fast local deterministic check (<1ms)
        val fastRuleResult = FastLocalRulesEngine.evaluate(applicationContext, phoneNumber)
        if (fastRuleResult != null) {
            Log.i(TAG, "Instant local rule match: ${fastRuleResult.verdict} (${fastRuleResult.rationale})")
            val callResponse = FastLocalRulesEngine.buildAndroidCallResponse(fastRuleResult)
            respondToCall(callDetails, callResponse)
            return
        }

        // 2. Stage 2: Asynchronous Cloud LLM Query with Strict Deadline
        serviceScope.launch {
            val screeningResult: ScreeningData = try {
                withTimeoutOrNull(NETWORK_DEADLINE_MS) {
                    queryBackendScreening(phoneNumber, callerName, presentation)
                } ?: FastLocalRulesEngine.generateFallback(phoneNumber, "Android 2.5s Deadline Reached")
            } catch (e: Exception) {
                Log.w(TAG, "Backend network error during screening, executing local fallback", e)
                FastLocalRulesEngine.generateFallback(phoneNumber, "Network Error: ${e.localizedMessage}")
            }

            Log.i(TAG, "Screening verdict determined: ${screeningResult.verdict} [Score: ${screeningResult.riskScore}] by ${screeningResult.engine}")
            val androidResponse = FastLocalRulesEngine.buildAndroidCallResponse(screeningResult)
            respondToCall(callDetails, androidResponse)
        }
    }

    private fun queryBackendScreening(phoneNumber: String, callerName: String?, presentation: String): ScreeningData {
        val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val configuredUrl = prefs.getString(KEY_API_URL, DEFAULT_BACKEND_URL) ?: DEFAULT_BACKEND_URL
        val endpoint = if (configuredUrl.endsWith("/api/screen-call")) configuredUrl else "$configuredUrl/api/screen-call"

        val payload = IncomingCallRequest(
            phoneNumber = phoneNumber,
            callerName = callerName,
            timestamp = System.currentTimeMillis().toString(),
            callPresentationMode = presentation
        )

        val jsonBody = gson.toJson(payload)
        val requestBody = jsonBody.toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url(endpoint)
            .post(requestBody)
            .build()

        val response = httpClient.newCall(request).execute()
        if (!response.isSuccessful) {
            throw IllegalStateException("HTTP Error: ${response.code}")
        }

        val responseString = response.body?.string() ?: throw IllegalStateException("Empty response body")
        val screeningResponse = gson.fromJson(responseString, ScreeningResponse::class.java)

        return screeningResponse.data ?: throw IllegalStateException("No screening data returned")
    }
}
