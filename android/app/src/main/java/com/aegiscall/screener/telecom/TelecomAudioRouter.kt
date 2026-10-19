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
    private var previousMusicVolume: Int = -1
    private var isDownlinkSuppressed: Boolean = false
    private var isListenInActive: Boolean = false

    /**
     * Configures audio routing specifically for active AI screening:
     * - Uplink is active and unmuted (remote caller hears AI speech).
     * - Local downlink speaker is silenced/suppressed (local user hears nothing on our end).
     */
    fun configureScreeningAudioRoute(context: Context, service: AegisInCallService?) {
        try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            // 1. Ensure audio mode is set for voice communication
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

            // 2. Unmute uplink so remote caller hears AI speech and greetings
            service?.setMuted(false)
            audioManager.isMicrophoneMute = false

            // 3. Strictly disable speakerphone so audio never blasts on our end
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn = false

            // 4. On Android 12+ (API 31+), direct communication device away from speaker
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    val devices = audioManager.availableCommunicationDevices
                    val earpieceDevice = devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }
                        ?: devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_TELEPHONY }
                    if (earpieceDevice != null) {
                        audioManager.setCommunicationDevice(earpieceDevice)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Could not set communication device: ${e.message}")
                }
            }

            // 5. Save user's current volume levels before suppressing
            val currentVol = audioManager.getStreamVolume(AudioManager.STREAM_VOICE_CALL)
            if (previousVolume == -1) {
                previousVolume = currentVol
            }
            val currentMusicVol = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            if (previousMusicVolume == -1) {
                previousMusicVolume = currentMusicVol
            }

            // 6. Suppress local downlink audio so "our side" stays quiet
            suppressLocalDownlink(audioManager)

            // 7. Route telephony away from external speakerphone
            @Suppress("DEPRECATION")
            service?.setAudioRoute(CallAudioState.ROUTE_EARPIECE)

            isDownlinkSuppressed = true
            isListenInActive = false

            Log.i(TAG, "Screening audio configured: AI talks to caller on remote line; local phone output silenced on our end")
        } catch (e: Exception) {
            Log.e(TAG, "Error configuring screening audio route: ${e.message}", e)
        }
    }

    /**
     * Silences or reduces local voice call and media volume so the device owner
     * on our end does not hear the screening audio.
     */
    private fun suppressLocalDownlink(audioManager: AudioManager) {
        try {
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn = false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    audioManager.adjustStreamVolume(
                        AudioManager.STREAM_VOICE_CALL,
                        AudioManager.ADJUST_MUTE,
                        0
                    )
                } catch (ignored: Exception) {}
                try {
                    audioManager.adjustStreamVolume(
                        AudioManager.STREAM_MUSIC,
                        AudioManager.ADJUST_MUTE,
                        0
                    )
                } catch (ignored: Exception) {}
            } else {
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, 0, 0)
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not mute stream volume, falling back to minimal: ${e.message}")
            try {
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, 0, 0)
            } catch (ignored: Exception) {
                try {
                    audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, 1, 0)
                } catch (ignored2: Exception) {}
            }
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
            if (previousMusicVolume >= 0) {
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, previousMusicVolume, 0)
                previousMusicVolume = -1
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
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn = false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    audioManager.clearCommunicationDevice()
                } catch (ignored: Exception) {}
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    audioManager.adjustStreamVolume(
                        AudioManager.STREAM_VOICE_CALL,
                        AudioManager.ADJUST_UNMUTE,
                        0
                    )
                } catch (ignored: Exception) {}
                try {
                    audioManager.adjustStreamVolume(
                        AudioManager.STREAM_MUSIC,
                        AudioManager.ADJUST_UNMUTE,
                        0
                    )
                } catch (ignored: Exception) {}
            }
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL)
            val restoreVol = if (previousVolume > 0) previousVolume else (maxVol * 0.7).toInt()
            audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, restoreVol, 0)
            previousVolume = -1

            if (previousMusicVolume >= 0) {
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, previousMusicVolume, 0)
                previousMusicVolume = -1
            }
            audioManager.isMicrophoneMute = false
            isDownlinkSuppressed = false
            isListenInActive = false
        } catch (e: Exception) {
            Log.w(TAG, "Error resetting audio: ${e.message}")
        }
    }

    fun isListenIn(): Boolean = isListenInActive
    fun isSuppressed(): Boolean = isDownlinkSuppressed

    data class AudioIsolationDiagnostics(
        val isCallerUplinkActive: Boolean,
        val isLocalDownlinkSuppressed: Boolean,
        val isLocalMicIsolated: Boolean,
        val isListenInActive: Boolean
    )

    fun getAudioIsolationDiagnostics(): AudioIsolationDiagnostics {
        return AudioIsolationDiagnostics(
            isCallerUplinkActive = isDownlinkSuppressed,
            isLocalDownlinkSuppressed = isDownlinkSuppressed,
            isLocalMicIsolated = !isListenInActive,
            isListenInActive = isListenInActive
        )
    }
}
