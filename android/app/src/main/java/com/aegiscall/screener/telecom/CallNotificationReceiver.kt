package com.aegiscall.screener.telecom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telecom.CallAudioState
import android.util.Log

class CallNotificationReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "CallNotificationReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.i(TAG, "Received notification action: $action")

        when (action) {
            CallNotificationManager.ACTION_DECLINE_CALL,
            CallNotificationManager.ACTION_HANG_UP -> {
                Log.i(TAG, "Hanging up call from notification action")
                AegisInCallService.rejectCall()
                CallNotificationManager.cancelCallNotifications(context)
            }
            CallNotificationManager.ACTION_ANSWER_CALL -> {
                Log.i(TAG, "Answering call from notification action")
                AegisInCallService.answerCall()
                AegisInCallService.pickupCall()
                AegisInCallService.activeCall?.let { call ->
                    val phone = call.details.handle?.schemeSpecificPart ?: "Unknown"
                    val name = call.details.callerDisplayName
                    CallNotificationManager.showOngoingCallNotification(context, phone, name)
                }
            }
            CallNotificationManager.ACTION_SCREEN_CALL -> {
                Log.i(TAG, "Starting AI screening from notification action")
                AegisInCallService.startAiScreening()
            }
            CallNotificationManager.ACTION_TOGGLE_MUTE -> {
                val service = AegisInCallService.serviceInstance
                val currentMute = service?.callAudioState?.isMuted ?: false
                val newMute = !currentMute
                AegisInCallService.setMuted(newMute)
                AegisInCallService.activeCall?.let { call ->
                    val phone = call.details.handle?.schemeSpecificPart ?: "Unknown"
                    val name = call.details.callerDisplayName
                    CallNotificationManager.showOngoingCallNotification(
                        context,
                        phone,
                        name,
                        isMuted = newMute,
                        isSpeaker = service?.callAudioState?.route == CallAudioState.ROUTE_SPEAKER
                    )
                }
            }
            CallNotificationManager.ACTION_TOGGLE_SPEAKER -> {
                val service = AegisInCallService.serviceInstance
                val isSpeaker = service?.callAudioState?.route == CallAudioState.ROUTE_SPEAKER
                val newSpeaker = !isSpeaker
                AegisInCallService.setSpeakerphone(newSpeaker)
                AegisInCallService.activeCall?.let { call ->
                    val phone = call.details.handle?.schemeSpecificPart ?: "Unknown"
                    val name = call.details.callerDisplayName
                    CallNotificationManager.showOngoingCallNotification(
                        context,
                        phone,
                        name,
                        isMuted = service?.callAudioState?.isMuted ?: false,
                        isSpeaker = newSpeaker
                    )
                }
            }
        }
    }
}
