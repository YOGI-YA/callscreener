package com.aegiscall.screener

import com.aegiscall.screener.telecom.CustomGreetingManager
import com.aegiscall.screener.telecom.FastLocalRulesEngine
import com.aegiscall.screener.telecom.TelecomAudioRouter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TelecomAudioRouterTest {

    @Test
    fun testAudioRouterInitialStateSilencedOnOurEnd() {
        // Device owner side should default to silenced unless listen in is explicitly engaged
        assertFalse("Listen In should be inactive by default so our end stays quiet", TelecomAudioRouter.isListenIn())
    }

    @Test
    fun testCustomGreetingModeSwitching() {
        CustomGreetingManager.activeScreeningMode = "AI_ASSISTANT"
        assertEquals("AI_ASSISTANT", CustomGreetingManager.activeScreeningMode)

        CustomGreetingManager.activeScreeningMode = "PERSONAL_VOICEMAIL"
        assertEquals("PERSONAL_VOICEMAIL", CustomGreetingManager.activeScreeningMode)

        CustomGreetingManager.activeScreeningMode = "AI_ASSISTANT"
    }

    @Test
    fun testFastRulesEngineEmergencyWhitelistSafety() {
        // High-risk numbers should never mistakenly flag emergency numbers
        val fallback = FastLocalRulesEngine.generateFallback("911", "Emergency bypass check")
        assertEquals("ALLOW", fallback.verdict)
        assertNotNull(fallback.id)
    }

    @Test
    fun testFastRulesEngineTollPrefixDetection() {
        val fallback = FastLocalRulesEngine.generateFallback("+19005550199", "Toll prefix heuristic")
        assertNotNull(fallback)
        assertEquals("+19005550199", fallback.phoneNumber)
    }
}
