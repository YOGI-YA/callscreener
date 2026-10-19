package com.aegiscall.screener.telecom

import android.content.Context
import android.content.Intent
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.VideoProfile
import android.util.Log
import com.aegiscall.screener.MainActivity
import com.aegiscall.screener.plugins.CallScreeningPlugin

class AegisInCallService : InCallService() {

    companion object {
        private const val TAG = "AegisInCallService"

        @Volatile
        var serviceInstance: AegisInCallService? = null

        @Volatile
        var activeCall: Call? = null

        @Volatile
        var isScreeningActive: Boolean = false

        lateinit var appContext: Context

        fun answerCall() {
            activeCall?.answer(VideoProfile.STATE_AUDIO_ONLY)
        }

        fun rejectCall() {
            isScreeningActive = false
            CustomGreetingManager.stopPlayback()
            AiVoiceScreeningEngine.stop()
            try {
                TelecomAudioRouter.resetAudio(appContext)
            } catch (e: Exception) {
                // ignore
            }
            if (CallRecorderManager.isRecording) {
                val saved = CallRecorderManager.stopRecording(appContext)
                if (saved != null) CallScreeningPlugin.broadcastRecordingSaved(saved)
            }
            try {
                serviceInstance?.let { CallNotificationManager.cancelCallNotifications(it) }
            } catch (e: Exception) {
                // ignore
            }
            activeCall?.disconnect()
            CallScreeningPlugin.broadcastCallEnded()
        }

        fun autoDisconnectScamCall(reason: String) {
            if (!isScreeningActive) return
            Log.w(TAG, "Auto-disconnecting scam call: $reason")
            val terminationMsg = "This call has been identified as unauthorized or fraudulent and is being disconnected. Goodbye."
            AiVoiceScreeningEngine.speakAiResponse(appContext, terminationMsg)
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                rejectCall()
            }, 2600)
        }

        fun startAiScreening(language: String = "auto", enableBotVoice: Boolean = true) {
            isScreeningActive = true
            // Answer the call programmatically to screen it
            activeCall?.answer(VideoProfile.STATE_AUDIO_ONLY)

            // Configure audio routing: Uplink transmitting to caller, local downlink speaker suppressed
            TelecomAudioRouter.configureScreeningAudioRoute(appContext, serviceInstance)

            // Route between Personal Voice Voicemail vs AI Assistant
            if (CustomGreetingManager.activeScreeningMode == "PERSONAL_VOICEMAIL" && CustomGreetingManager.hasCustomGreeting(appContext)) {
                CallScreeningPlugin.broadcastVoicemailGreetingPlaying()
                CustomGreetingManager.playGreetingToCall(appContext) {
                    if (!isScreeningActive) return@playGreetingToCall
                    try {
                        activeCall?.playDtmfTone('1')
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            try { activeCall?.stopDtmfTone() } catch (e: Exception) {}
                        }, 250)
                    } catch (e: Exception) {
                        // ignore
                    }
                    val phone = activeCall?.details?.handle?.schemeSpecificPart ?: "Unknown"
                    CallRecorderManager.startRecording(appContext, phone)
                    CallScreeningPlugin.broadcastVoicemailRecordingStarted()
                    AiVoiceScreeningEngine.startListeningForCaller()
                }
            } else {
                // Standard AI screening conversation (bot greets caller, STT listens for reply)
                AiVoiceScreeningEngine.startScreeningConversation(appContext, language, enableBotVoice)
            }

            // Show ongoing screening notification
            activeCall?.let { call ->
                val phone = call.details.handle?.schemeSpecificPart ?: "Unknown"
                val name = call.details.callerDisplayName
                serviceInstance?.let { CallNotificationManager.showOngoingCallNotification(it, phone, name) }
            }
        }

        fun toggleListenIn(enable: Boolean) {
            TelecomAudioRouter.setListenIn(appContext, enable, serviceInstance)
            CallScreeningPlugin.broadcastAudioRouteState(
                transmittingToCaller = AiVoiceScreeningEngine.isBotVoiceEnabled,
                localMuted = !enable
            )
        }

        fun sendQuickReply(replyText: String) {
            if (isScreeningActive) {
                try {
                    serviceInstance?.setMuted(false)
                } catch (e: Exception) {
                    // ignore
                }
                AiVoiceScreeningEngine.isBotVoiceEnabled = true
                AiVoiceScreeningEngine.speakAiResponse(appContext, replyText)
            }
        }

        fun pickupCall() {
            isScreeningActive = false
            CustomGreetingManager.stopPlayback()
            AiVoiceScreeningEngine.stop()
            // Restore normal two-way call audio so user and caller talk directly
            TelecomAudioRouter.restoreNormalCallAudio(appContext, serviceInstance)
            CallScreeningPlugin.broadcastCallPickedUp()
            CallScreeningPlugin.broadcastCallAudioState(muted = false, speakerOn = false)

            // Show ongoing connected call notification
            activeCall?.let { call ->
                val phone = call.details.handle?.schemeSpecificPart ?: "Unknown"
                val name = call.details.callerDisplayName
                serviceInstance?.let { CallNotificationManager.showOngoingCallNotification(it, phone, name) }
            }
        }

        fun setMuted(muted: Boolean) {
            try {
                serviceInstance?.setMuted(muted)
                @Suppress("DEPRECATION")
                val isSpeaker = serviceInstance?.callAudioState?.route == CallAudioState.ROUTE_SPEAKER
                CallScreeningPlugin.broadcastCallAudioState(muted = muted, speakerOn = isSpeaker)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to set mute: ${e.message}")
            }
        }

        fun setSpeakerphone(speakerOn: Boolean) {
            try {
                @Suppress("DEPRECATION")
                if (speakerOn) {
                    serviceInstance?.setAudioRoute(CallAudioState.ROUTE_SPEAKER)
                } else {
                    serviceInstance?.setAudioRoute(CallAudioState.ROUTE_EARPIECE)
                }
                @Suppress("DEPRECATION")
                val isMuted = serviceInstance?.callAudioState?.isMuted ?: false
                CallScreeningPlugin.broadcastCallAudioState(muted = isMuted, speakerOn = speakerOn)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to set speaker: ${e.message}")
            }
        }

        fun playDtmfTone(digit: Char) {
            try {
                activeCall?.playDtmfTone(digit)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to play DTMF: ${e.message}")
            }
        }

        fun stopDtmfTone() {
            try {
                activeCall?.stopDtmfTone()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to stop DTMF: ${e.message}")
            }
        }

        fun holdCall(hold: Boolean) {
            try {
                if (hold) {
                    activeCall?.hold()
                } else {
                    activeCall?.unhold()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to hold/unhold call: ${e.message}")
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        serviceInstance = this
        appContext = applicationContext
        AiVoiceScreeningEngine.initialize(applicationContext)
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        activeCall = call
        Log.i(TAG, "New Telecom Call Added: state=${call.state}")

        val phoneNumber = call.details.handle?.schemeSpecificPart ?: "Unknown"
        val callerName = call.details.callerDisplayName ?: "Unknown Caller"

        // Broadcast incoming call to frontend UI
        CallScreeningPlugin.broadcastIncomingCall(phoneNumber, callerName)

        // Show system notification and wake screen
        if (call.state == Call.STATE_RINGING) {
            CallNotificationManager.showIncomingCallNotification(this, phoneNumber, callerName)
        } else if (call.state == Call.STATE_ACTIVE) {
            CallNotificationManager.showOngoingCallNotification(this, phoneNumber, callerName)
        }
        bringAppToFront()

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                super.onStateChanged(call, state)
                Log.i(TAG, "Call State Changed: $state")

                when (state) {
                    Call.STATE_RINGING -> {
                        CallScreeningPlugin.broadcastIncomingCall(phoneNumber, callerName)
                        CallNotificationManager.showIncomingCallNotification(this@AegisInCallService, phoneNumber, callerName)
                        bringAppToFront()
                    }
                    Call.STATE_ACTIVE -> {
                        CallScreeningPlugin.broadcastCallState("ACTIVE")
                        CallNotificationManager.showOngoingCallNotification(
                            this@AegisInCallService,
                            phoneNumber,
                            callerName,
                            isMuted = callAudioState?.isMuted ?: false,
                            isSpeaker = callAudioState?.route == CallAudioState.ROUTE_SPEAKER
                        )
                    }
                    Call.STATE_DISCONNECTED -> {
                        isScreeningActive = false
                        CustomGreetingManager.stopPlayback()
                        AiVoiceScreeningEngine.stop()
                        try {
                            TelecomAudioRouter.resetAudio(this@AegisInCallService)
                        } catch (e: Exception) {
                            // ignore
                        }
                        if (CallRecorderManager.isRecording) {
                            val saved = CallRecorderManager.stopRecording(this@AegisInCallService)
                            if (saved != null) CallScreeningPlugin.broadcastRecordingSaved(saved)
                        }
                        CallNotificationManager.cancelCallNotifications(this@AegisInCallService)
                        CallScreeningPlugin.broadcastCallEnded()
                        activeCall = null
                    }
                }
            }
        })
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        Log.i(TAG, "Call Removed")
        isScreeningActive = false
        CustomGreetingManager.stopPlayback()
        AiVoiceScreeningEngine.stop()
        try {
            TelecomAudioRouter.resetAudio(this)
        } catch (e: Exception) {
            // ignore
        }
        if (CallRecorderManager.isRecording) {
            val saved = CallRecorderManager.stopRecording(this)
            if (saved != null) CallScreeningPlugin.broadcastRecordingSaved(saved)
        }
        CallNotificationManager.cancelCallNotifications(this)
        CallScreeningPlugin.broadcastCallEnded()
        if (activeCall == call) {
            activeCall = null
        }
    }

    @Suppress("DEPRECATION")
    override fun onCallAudioStateChanged(audioState: CallAudioState?) {
        super.onCallAudioStateChanged(audioState)
        audioState?.let {
            CallScreeningPlugin.broadcastCallAudioState(
                muted = it.isMuted,
                speakerOn = it.route == CallAudioState.ROUTE_SPEAKER
            )

            activeCall?.let { call ->
                if (call.state == Call.STATE_ACTIVE) {
                    val phone = call.details.handle?.schemeSpecificPart ?: "Unknown"
                    val name = call.details.callerDisplayName
                    CallNotificationManager.showOngoingCallNotification(
                        this,
                        phone,
                        name,
                        isMuted = it.isMuted,
                        isSpeaker = it.route == CallAudioState.ROUTE_SPEAKER
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (serviceInstance == this) {
            serviceInstance = null
        }
    }

    private fun bringAppToFront() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("IS_INCOMING_CALL", true)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not bring MainActivity to front: ${e.message}")
        }
    }
}
