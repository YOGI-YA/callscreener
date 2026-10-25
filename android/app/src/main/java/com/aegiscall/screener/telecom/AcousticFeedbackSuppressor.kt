package com.aegiscall.screener.telecom

import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.util.Log

/**
 * AcousticFeedbackSuppressor
 * Binds Android hardware-accelerated Acoustic Echo Cancellation (AEC)
 * and Noise Suppression (NS) to the active call screening audio session.
 * Prevents speaker audio feedback loops when the user engages 'Listen In' monitoring.
 */
class AcousticFeedbackSuppressor {
    private val tag = "FeedbackSuppressor"
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null

    /**
     * Attaches AEC and NS audio effects to the AudioRecord audioSessionId
     */
    @Synchronized
    fun attachToAudioSession(audioSessionId: Int): Boolean {
        try {
            release()

            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(audioSessionId)?.apply {
                    enabled = true
                    Log.i(tag, "Hardware AcousticEchoCanceler enabled on session: $audioSessionId")
                }
            } else {
                Log.w(tag, "Hardware AcousticEchoCanceler unavailable on this chipset")
            }

            if (NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(audioSessionId)?.apply {
                    enabled = true
                    Log.i(tag, "Hardware NoiseSuppressor enabled on session: $audioSessionId")
                }
            } else {
                Log.w(tag, "Hardware NoiseSuppressor unavailable on this chipset")
            }

            return echoCanceler?.enabled == true || noiseSuppressor?.enabled == true
        } catch (e: Exception) {
            Log.e(tag, "Failed to attach acoustic effects to session: $audioSessionId", e)
            return false
        }
    }

    /**
     * Releases audio effects cleanly when call terminates
     */
    @Synchronized
    fun release() {
        try {
            echoCanceler?.enabled = false
            echoCanceler?.release()
            echoCanceler = null

            noiseSuppressor?.enabled = false
            noiseSuppressor?.release()
            noiseSuppressor = null

            Log.i(tag, "Acoustic feedback suppressors released")
        } catch (e: Exception) {
            Log.e(tag, "Error releasing acoustic feedback suppressors", e)
        }
    }

    fun isEchoCancellationActive(): Boolean = echoCanceler?.enabled == true
}
