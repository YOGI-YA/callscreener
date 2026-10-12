package com.aegiscall.screener.telecom

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.aegiscall.screener.MainActivity

object CallNotificationManager {
    const val CHANNEL_ID_CALLS = "aegis_telecom_calls"
    const val NOTIFICATION_ID_INCOMING = 10001
    const val NOTIFICATION_ID_ONGOING = 10002
    const val NOTIFICATION_ID_SCREENING = 10003

    const val ACTION_ANSWER_CALL = "com.aegiscall.screener.ACTION_ANSWER_CALL"
    const val ACTION_DECLINE_CALL = "com.aegiscall.screener.ACTION_DECLINE_CALL"
    const val ACTION_HANG_UP = "com.aegiscall.screener.ACTION_HANG_UP"
    const val ACTION_SCREEN_CALL = "com.aegiscall.screener.ACTION_SCREEN_CALL"
    const val ACTION_TOGGLE_MUTE = "com.aegiscall.screener.ACTION_TOGGLE_MUTE"
    const val ACTION_TOGGLE_SPEAKER = "com.aegiscall.screener.ACTION_TOGGLE_SPEAKER"

    fun initNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val channel = NotificationChannel(
                CHANNEL_ID_CALLS,
                "Incoming & Active Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Status and in-call controls for incoming and active phone calls"
                enableVibration(true)
                setShowBadge(true)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showIncomingCallNotification(context: Context, phoneNumber: String, callerName: String?) {
        initNotificationChannel(context)
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        // Tap notification to bring In-Call Overlay UI to front
        val contentIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            putExtra("IS_INCOMING_CALL", true)
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            101,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Decline Intent
        val declineIntent = Intent(context, CallNotificationReceiver::class.java).apply {
            action = ACTION_DECLINE_CALL
        }
        val declinePendingIntent = PendingIntent.getBroadcast(
            context,
            102,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Screen with AI Intent
        val screenIntent = Intent(context, CallNotificationReceiver::class.java).apply {
            action = ACTION_SCREEN_CALL
        }
        val screenPendingIntent = PendingIntent.getBroadcast(
            context,
            103,
            screenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Answer Intent
        val answerIntent = Intent(context, CallNotificationReceiver::class.java).apply {
            action = ACTION_ANSWER_CALL
        }
        val answerPendingIntent = PendingIntent.getBroadcast(
            context,
            104,
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val displayName = if (!callerName.isNullOrBlank() && callerName != "Unknown Caller") callerName else phoneNumber
        val builder = NotificationCompat.Builder(context, CHANNEL_ID_CALLS)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("Incoming Call: $displayName")
            .setContentText("Tap to screen with AI, answer, or decline")
            .setContentIntent(contentPendingIntent)
            .setFullScreenIntent(contentPendingIntent, true) // Required by Android to show in-call UI over lockscreen / active apps
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
            .addAction(android.R.drawable.ic_btn_speak_now, "Screen with AI", screenPendingIntent)
            .addAction(android.R.drawable.stat_sys_phone_call, "Answer", answerPendingIntent)

        notificationManager.notify(NOTIFICATION_ID_INCOMING, builder.build())
    }

    fun showOngoingCallNotification(context: Context, phoneNumber: String, callerName: String?, isMuted: Boolean = false, isSpeaker: Boolean = false) {
        initNotificationChannel(context)
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        // Cancel incoming call notification since it was answered
        notificationManager.cancel(NOTIFICATION_ID_INCOMING)

        val contentIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("IS_INCOMING_CALL", true)
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            201,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Hang Up Intent
        val hangUpIntent = Intent(context, CallNotificationReceiver::class.java).apply {
            action = ACTION_HANG_UP
        }
        val hangUpPendingIntent = PendingIntent.getBroadcast(
            context,
            202,
            hangUpIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Mute / Unmute Intent
        val muteIntent = Intent(context, CallNotificationReceiver::class.java).apply {
            action = ACTION_TOGGLE_MUTE
        }
        val mutePendingIntent = PendingIntent.getBroadcast(
            context,
            203,
            muteIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Speaker / Earpiece Intent
        val speakerIntent = Intent(context, CallNotificationReceiver::class.java).apply {
            action = ACTION_TOGGLE_SPEAKER
        }
        val speakerPendingIntent = PendingIntent.getBroadcast(
            context,
            204,
            speakerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val displayName = if (!callerName.isNullOrBlank() && callerName != "Unknown Caller") callerName else phoneNumber
        val statusText = if (isMuted) "Call in progress (Muted)" else if (isSpeaker) "Call in progress (Speaker)" else "Call in progress"

        val builder = NotificationCompat.Builder(context, CHANNEL_ID_CALLS)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setContentTitle(displayName)
            .setContentText(statusText)
            .setContentIntent(contentPendingIntent)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .addAction(
                if (isMuted) android.R.drawable.ic_lock_silent_mode_off else android.R.drawable.ic_lock_silent_mode,
                if (isMuted) "Unmute" else "Mute",
                mutePendingIntent
            )
            .addAction(
                android.R.drawable.stat_sys_speakerphone,
                if (isSpeaker) "Earpiece" else "Speaker",
                speakerPendingIntent
            )
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Hang Up",
                hangUpPendingIntent
            )

        notificationManager.notify(NOTIFICATION_ID_ONGOING, builder.build())
    }

    fun cancelCallNotifications(context: Context) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            notificationManager.cancel(NOTIFICATION_ID_INCOMING)
            notificationManager.cancel(NOTIFICATION_ID_ONGOING)
            notificationManager.cancel(NOTIFICATION_ID_SCREENING)
        } catch (e: Exception) {
            // ignore non-fatal
        }
    }
}
