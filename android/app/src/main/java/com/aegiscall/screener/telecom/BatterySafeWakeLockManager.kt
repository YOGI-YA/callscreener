package com.aegiscall.screener.telecom

import android.content.Context
import android.os.PowerManager
import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * BatterySafeWakeLockManager
 * Prevents Android OS deep-sleep during active AI call screening while strictly
 * preventing partial wake-lock leaks and battery exhaustion via watchdog auto-release.
 */
class BatterySafeWakeLockManager(context: Context) {
    private val tag = "AegisWakeLock"
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
    private var wakeLock: PowerManager.WakeLock? = null
    private val isHeld = AtomicBoolean(false)

    private val scheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
    private var watchdogFuture: ScheduledFuture<*>? = null

    // Maximum time a call screening session can hold a wake-lock (3 minutes)
    private val maxScreeningDurationMs = 180_000L

    init {
        wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "AegisCall::ScreeningSessionWakeLock"
        )?.apply {
            setReferenceCounted(false)
        }
    }

    /**
     * Acquires wake lock with an automatic watchdog timer to guarantee battery safety
     */
    @Synchronized
    fun acquireWakeLock(callId: String, timeoutMs: Long = maxScreeningDurationMs) {
        try {
            if (wakeLock == null) {
                Log.w(tag, "PowerManager wakeLock unavailable on this device")
                return
            }

            // Cancel any pending watchdog
            watchdogFuture?.cancel(false)

            wakeLock?.acquire(timeoutMs)
            isHeld.set(true)
            Log.i(tag, "Acquired battery-safe wake-lock for call: $callId with timeout: ${timeoutMs}ms")

            // Schedule strict watchdog callback
            watchdogFuture = scheduler.schedule({
                if (isHeld.get()) {
                    Log.w(tag, "Watchdog timer fired for call: $callId! Force-releasing wake-lock.")
                    releaseWakeLock(callId, "WATCHDOG_TIMEOUT")
                }
            }, timeoutMs, TimeUnit.MILLISECONDS)

        } catch (e: Exception) {
            Log.e(tag, "Failed to acquire wake-lock for call: $callId", e)
        }
    }

    /**
     * Releases wake lock cleanly upon call completion, acceptance, or hangup
     */
    @Synchronized
    fun releaseWakeLock(callId: String, reason: String = "CALL_TERMINATED") {
        try {
            watchdogFuture?.cancel(false)
            watchdogFuture = null

            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.i(tag, "Released wake-lock for call: $callId. Reason: $reason")
            }
            isHeld.set(false)
        } catch (e: Exception) {
            Log.e(tag, "Error releasing wake-lock for call: $callId", e)
        }
    }

    fun isWakeLockHeld(): Boolean = isHeld.get()
}
