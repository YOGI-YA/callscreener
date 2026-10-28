package com.aegiscall.screener

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import com.aegiscall.screener.plugins.CallScreeningPlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Register custom native CallScreening bridge plugin
        registerPlugin(CallScreeningPlugin::class.java)
        super.onCreate(savedInstanceState)
        configureWindowForInCall()
        com.aegiscall.screener.telecom.FastLocalRulesEngine.initialize(this)
        com.aegiscall.screener.telecom.WatchdogScheduler.scheduleWatchdog(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        configureWindowForInCall()
        CallScreeningPlugin.notifyCallRestored()
    }

    private fun configureWindowForInCall() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}

