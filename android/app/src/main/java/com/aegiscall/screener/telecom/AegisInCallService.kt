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
        var activeCall: Call? = null

        @Volatile
        var isScreeningActive: Boolean = false

        lateinit var appContext: Context

        fun answerCall() {
            activeCall?.answer(VideoProfile.STATE_AUDIO_ONLY)
        }

        fun rejectCall() {
            isScreeningActive = false
            AiVoiceScreeningEngine.stop()
            activeCall?.disconnect()
        }

        fun startAiScreening(language: String = "auto") {
            isScreeningActive = true
            // Answer the call programmatically to screen it
            activeCall?.answer(VideoProfile.STATE_AUDIO_ONLY)

            // Start AI voice conversation (TTS + STT)
            AiVoiceScreeningEngine.startScreeningConversation(appContext, language)
        }

        fun sendQuickReply(replyText: String) {
            if (isScreeningActive) {
                AiVoiceScreeningEngine.speakAiResponse(appContext, replyText)
            }
        }

        fun pickupCall() {
            isScreeningActive = false
            AiVoiceScreeningEngine.stop()
            CallScreeningPlugin.broadcastCallPickedUp()
        }
    }

    override fun onCreate() {
        super.onCreate()
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

        // Wake screen & bring MainActivity to front for answering/screening
        bringAppToFront()

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                super.onStateChanged(call, state)
                Log.i(TAG, "Call State Changed: $state")

                when (state) {
                    Call.STATE_RINGING -> {
                        CallScreeningPlugin.broadcastIncomingCall(phoneNumber, callerName)
                        bringAppToFront()
                    }
                    Call.STATE_ACTIVE -> {
                        CallScreeningPlugin.broadcastCallState("ACTIVE")
                    }
                    Call.STATE_DISCONNECTED -> {
                        isScreeningActive = false
                        AiVoiceScreeningEngine.stop()
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
        AiVoiceScreeningEngine.stop()
        CallScreeningPlugin.broadcastCallEnded()
        if (activeCall == call) {
            activeCall = null
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
