package com.aegiscall.screener.telecom

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log

/**
 * LongevityWatchdogReceiver
 * Periodic heartbeat receiver that executes even when the app has been backgrounded
 * for days or when the device is in Android Doze mode. Verifies that the Telecom screening
 * engine is armed and re-schedules the next watchdog check.
 */
class LongevityWatchdogReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "LongevityWatchdog"
        const val ACTION_WATCHDOG_HEARTBEAT = "com.aegiscall.screener.ACTION_WATCHDOG_HEARTBEAT"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null) return
        Log.i(TAG, "Heartbeat watchdog pulse executed: checking screening readiness")

        try {
            // Verify and keep rules cache active
            FastLocalRulesEngine.initialize(context.applicationContext)

            // Re-schedule next watchdog pulse for long-term survival
            WatchdogScheduler.scheduleWatchdog(context.applicationContext)
            Log.i(TAG, "Watchdog verification complete; next cycle armed")
        } catch (e: Exception) {
            Log.e(TAG, "Watchdog execution failure: ${e.message}", e)
        }
    }
}

/**
 * WatchdogScheduler
 * Schedules non-draining background alarms to keep the CallScreeningService primed
 * across multiple days without excessive battery usage.
 */
object WatchdogScheduler {
    private const val TAG = "WatchdogScheduler"
    private const val WATCHDOG_INTERVAL_MS = 6 * 60 * 60 * 1000L // Every 6 hours
    private const val REQUEST_CODE = 4421

    fun scheduleWatchdog(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, LongevityWatchdogReceiver::class.java).apply {
            action = LongevityWatchdogReceiver.ACTION_WATCHDOG_HEARTBEAT
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags)
        val triggerAt = SystemClock.elapsedRealtime() + WATCHDOG_INTERVAL_MS

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
            } else {
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent)
            }
            Log.i(TAG, "Watchdog scheduled for +${WATCHDOG_INTERVAL_MS / 3600000} hours")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to schedule alarm: ${e.message}")
        }
    }
}
