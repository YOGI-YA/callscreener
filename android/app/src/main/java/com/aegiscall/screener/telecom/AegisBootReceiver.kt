package com.aegiscall.screener.telecom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * AegisBootReceiver
 * Ensures AegisCall AI call screening survives device restarts, OS updates,
 * and background memory prunes. Re-primes offline deterministic rules and
 * re-initializes telecom screening hooks immediately upon boot.
 */
class AegisBootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AegisBootReceiver"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return

        val action = intent.action
        Log.i(TAG, "Device system broadcast received: $action")

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                Log.i(TAG, "Reboot/Update detected: Initializing AegisCall longevity safeguards")
                try {
                    // 1. Prime offline deterministic fast rules
                    FastLocalRulesEngine.initialize(context.applicationContext)
                    Log.i(TAG, "Deterministic fast screening rules primed successfully")

                    // 2. Initialize encrypted secure preferences
                    val secureHelper = SecurePreferencesHelper(context.applicationContext)
                    val isEncrypted = secureHelper.getSecureString("keystore_ready_check", "READY")
                    Log.i(TAG, "Master Key Keystore verified post-boot: $isEncrypted")

                    // 3. Re-arm longevity watchdog scheduler
                    WatchdogScheduler.scheduleWatchdog(context.applicationContext)
                    Log.i(TAG, "Longevity watchdog alarm scheduled")

                } catch (e: Exception) {
                    Log.e(TAG, "Error initializing components post-boot: ${e.message}", e)
                }
            }
        }
    }
}
