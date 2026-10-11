package com.aegiscall.screener.telecom

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.aegiscall.screener.R
import com.aegiscall.screener.models.ScreeningData
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object CallHistoryStorage {

    private const val PREFS_NAME = "aegis_screened_calls_storage"
    private const val KEY_CALL_LOGS = "screened_call_records"
    private const val CHANNEL_ID = "aegis_call_screening_channel"
    private const val MAX_LOGS = 100

    private val gson = Gson()

    @Synchronized
    fun saveCall(context: Context, call: ScreeningData) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existingCalls = getCalls(context).toMutableList()

        // Insert newest at the beginning
        existingCalls.add(0, call)

        // Trim to max logs
        val trimmed = if (existingCalls.size > MAX_LOGS) existingCalls.subList(0, MAX_LOGS) else existingCalls

        val json = gson.toJson(trimmed)
        prefs.edit().putString(KEY_CALL_LOGS, json).apply()

        // Post system notification to phone
        postNotification(context, call)
    }

    @Synchronized
    fun getCalls(context: Context): List<ScreeningData> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_CALL_LOGS, null) ?: return emptyList()

        return try {
            val type = object : TypeToken<List<ScreeningData>>() {}.type
            gson.fromJson<List<ScreeningData>>(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun clearCalls(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_CALL_LOGS).apply()
    }

    fun cancelScreeningNotification(context: Context) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            notificationManager.cancel(CallNotificationManager.NOTIFICATION_ID_SCREENING)
        } catch (e: Exception) {
            // ignore non-fatal
        }
    }

    private fun postNotification(context: Context, call: ScreeningData) {
        // Do not post notification if rule or engine flagged to skip notification (e.g. auto-reject or user dismissed)
        if (call.suggestedActions.skipNotification) return

        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

            // Ensure notification channel exists on Android 8.0+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Call Screening Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Alerts for real screened phone calls"
                    enableVibration(true)
                }
                notificationManager.createNotificationChannel(channel)
            }

            val iconEmoji = when (call.verdict) {
                "REJECT" -> "⛔ BLOCKED"
                "SILENCE" -> "🔕 SILENCED"
                else -> "✅ ALLOWED"
            }

            val title = "AegisCall: $iconEmoji (${call.phoneNumber})"
            val message = if (!call.callerName.isNullOrBlank() && call.callerName != "Unknown Caller") {
                "${call.callerName} • ${call.rationale}"
            } else {
                call.rationale
            }

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)

            notificationManager.notify(CallNotificationManager.NOTIFICATION_ID_SCREENING, builder.build())
        } catch (e: Exception) {
            // Notifications may be blocked by system or lack permission; non-fatal
        }
    }
}
