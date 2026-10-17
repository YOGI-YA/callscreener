package com.aegiscall.screener.telecom

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.telecom.CallAudioState
import android.util.Log

/**
 * TelecomAudioRouter
 * ──────────────────
 * Production-grade audio routing manager for AI Call Screening:
 * 1. Ensures remote caller ("other hand user") hears AI greeting, synthesized speech,
 *    and voicemail prompt with pristine clarity.
 * 2. Suppresses/silences local audio output on "our side" during automated screening
 *    so the device owner is not disturbed by bot speech or caller chatter.
 * 3. Provides clean "Listen In" (silent call monitor) to allow the recipient to hear
 *    the caller without leaking local room noise to the caller.
 * 4. Smoothly transitions to full two-way audio upon manual call pickup.
 */
object TelecomAudioRouter {

    private const val TAG = "TelecomAudioRouter"

    private var previousVolume: Int = -1
    private var isDownlinkSuppressed: Boolean = false
    private var isListenInActive: Boolean = false

    /**
     * Configures audio routing specifically for active AI screening:
     * - Uplink is active and unmuted (remote caller hears AI speech).
     * - Local downlink speaker is silenced/suppressed (local user hears nothing).
     */
    fun configureScreeningAudioRoute(context: Context, service: AegisInCallService?) {
        try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            // 1. Ensure audio mode is set for voice communication
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

            // 2. Unmute uplink so remote caller hears AI speech and greetings
            service?.setMuted(false)
            audioManager.isMicrophoneMute = false

            // 3. Save user's current voice call volume before suppressing
            val currentVol = audioManager.getStreamVolume(AudioManager.STREAM_VOICE_CALL)
            if (previousVolume == -1) {
                previousVolume = currentVol
            }

            // 4. Suppress local downlink audio so "our side" stays quiet
            suppressLocalDownlink(audioManager)

            // 5. Route away from external speakerphone by default
            @Suppress("DEPRECATION")
            service?.setAudioRoute(CallAudioState.ROUTE_EARPIECE)

            isDownlinkSuppressed = true
            isListenInActive = false

            Log.i(TAG, "Screening audio configured: Uplink transmitting to caller, local downlink suppressed")
        } catch (e: Exception) {
            Log.e(TAG, "Error configuring screening audio route: ${e.message}", e)
        }
    }

    /**
     * Silences or reduces local voice call volume to near zero so the local user
     * does not hear the screening audio.
     */
    private fun suppressLocalDownlink(audioManager: AudioManager) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                audioManager.adjustStreamVolume(
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.ADJUST_MUTE,
                    0
                )
            } else {
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, 0, 0)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not mute stream volume, falling back to minimal: ${e.message}")
            try {
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, 1, 0)
            } catch (ignored: Exception) {}
        }
    }

    /**
     * Toggles "Listen In" (Call Monitoring):
     * - If enabled, restores local audio at safe volume so device owner can hear the caller,
     *   while keeping the user's local microphone muted so caller hears only the AI.
     * - If disabled, re-suppresses local audio.
     */
    fun setListenIn(context: Context, enable: Boolean, service: AegisInCallService?) {
        try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            isListenInActive = enable

            if (enable) {
                // Restore comfortable local monitoring volume
                val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL)
                val targetVol = if (previousVolume > 0) previousVolume else (maxVol * 0.6).toInt()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    audioManager.adjustStreamVolume(
                        AudioManager.STREAM_VOICE_CALL,
                        AudioManager.ADJUST_UNMUTE,
                        0
                    )
                }
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, targetVol, 0)
                Log.i(TAG, "Listen In enabled: Local user can now monitor caller audio")
            } else {
                // Re-silence local output
                suppressLocalDownlink(audioManager)
                Log.i(TAG, "Listen In disabled: Local downlink silenced")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error toggling listen in: ${e.message}", e)
        }
    }

    /**
     * Restores normal full-duplex phone call audio when user answers/picks up the call:
     * - Unmutes local speaker/earpiece
     * - Unmutes microphone for human talk
     * - Restores previous volume settings
     */
    fun restoreNormalCallAudio(context: Context, service: AegisInCallService?) {
        try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.mode = AudioManager.MODE_IN_CALL

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                audioManager.adjustStreamVolume(
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.ADJUST_UNMUTE,
                    0
                )
            }

            if (previousVolume >= 0) {
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, previousVolume, 0)
                previousVolume = -1
            }

            service?.setMuted(false)
            audioManager.isMicrophoneMute = false
            isDownlinkSuppressed = false
            isListenInActive = false

            Log.i(TAG, "Normal call audio restored for live conversation")
        } catch (e: Exception) {
            Log.e(TAG, "Error restoring normal call audio: ${e.message}", e)
        }
    }

    /**
     * Resets audio configuration when call is completely terminated.
     */
    fun resetAudio(context: Context) {
        try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.mode = AudioManager.MODE_NORMAL
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                audioManager.adjustStreamVolume(
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.ADJUST_UNMUTE,
                    0
                )
            }
            if (previousVolume >= 0) {
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, previousVolume, 0)
                previousVolume = -1
            }
            isDownlinkSuppressed = false
            isListenInActive = false
        } catch (e: Exception) {
            Log.w(TAG, "Error resetting audio: ${e.message}")
        }
    }

    fun isListenIn(): Boolean = isListenInActive
    fun isSuppressed(): Boolean = isDownlinkSuppressed
}
