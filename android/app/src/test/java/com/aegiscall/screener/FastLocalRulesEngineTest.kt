package com.aegiscall.screener

import com.aegiscall.screener.models.ScreeningData
import com.aegiscall.screener.telecom.FastLocalRulesEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FastLocalRulesEngineTest {

    @Test
    fun testGenerateFallbackReturnsSafeDefaults() {
        val fallback: ScreeningData = FastLocalRulesEngine.generateFallback("+14155550199", "Timeout simulation")
        assertEquals("ALLOW", fallback.verdict)
        assertEquals("FAST_LOCAL_FALLBACK", fallback.engine)
        assertTrue(fallback.riskScore <= 30)
    }

    @Test
    fun testBuildAndroidCallResponseHandlesDataSafely() {
        val rejectData = ScreeningData(
            id = "test-reject",
            phoneNumber = "+19005550199",
            callerName = "Toll Scam",
            verdict = "REJECT",
            riskScore = 99,
            riskLevel = "CRITICAL_SPAM",
            category = "ROBOCALL",
            confidence = 1.0,
            rationale = "Toll prefix detected",
            engine = "FAST_LOCAL_FALLBACK",
            latencyMs = 1L,
            timestamp = "12345",
            suggestedActions = com.aegiscall.screener.models.CallResponseActions(disallowCall = true, silenceCall = false, rejectCall = true)
        )

        // Verifies no uncaught exceptions are thrown when mapping screening responses
        try {
            FastLocalRulesEngine.buildAndroidCallResponse(rejectData)
        } catch (e: Throwable) {
            org.junit.Assert.fail("buildAndroidCallResponse should not throw uncaught exceptions: ${e.message}")
        }
    }
}
