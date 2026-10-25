package com.aegiscall.screener.telecom

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.util.Log
import java.util.concurrent.BlockingQueue
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * UplinkAudioPlayer
 * Directly streams synthesized AI voice audio frames and comfort noise into the Android
 * telecom telephony uplink pipe towards the remote caller.
 */
class UplinkAudioPlayer(
    private val sampleRate: Int = 8000
) {
    private val tag = "UplinkAudioPlayer"
    private var audioTrack: AudioTrack? = null
    private val isPlaying = AtomicBoolean(false)
    private val audioQueue: BlockingQueue<ByteArray> = LinkedBlockingQueue(100)
    private var playbackThread: Thread? = null

    /**
     * Initializes the telephony AudioTrack in streaming mode
     */
    @Synchronized
    fun initialize(): Boolean {
        try {
            if (audioTrack != null) return true

            val channelConfig = AudioFormat.CHANNEL_OUT_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val minBufferSize = AudioTrack.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            val bufferSize = Math.max(minBufferSize, 320 * 4) // At least 80ms buffer

            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .setLegacyStreamType(AudioManager.STREAM_VOICE_CALL)
                .build()

            val format = AudioFormat.Builder()
                .setEncoding(audioFormat)
                .setSampleRate(sampleRate)
                .setChannelMask(channelConfig)
                .build()

            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(format)
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            audioTrack?.play()
            isPlaying.set(true)
            startPlaybackWorker()

            Log.i(tag, "UplinkAudioPlayer initialized with sampleRate: $sampleRate, buffer: $bufferSize")
            return true
        } catch (e: Exception) {
            Log.e(tag, "Failed to initialize UplinkAudioPlayer", e)
            return false
        }
    }

    /**
     * Enqueues a PCM-16 audio frame to be played out down the telecom uplink to the caller
     */
    fun enqueueAudioFrame(pcmFrame: ByteArray): Boolean {
        if (!isPlaying.get()) {
            initialize()
        }
        return audioQueue.offer(pcmFrame)
    }

    private fun startPlaybackWorker() {
        playbackThread = Thread({
            Log.i(tag, "Uplink audio worker loop started")
            while (isPlaying.get()) {
                try {
                    val frame = audioQueue.poll(40, java.util.concurrent.TimeUnit.MILLISECONDS)
                    if (frame != null && audioTrack != null) {
                        audioTrack?.write(frame, 0, frame.size)
                    }
                } catch (e: InterruptedException) {
                    break
                } catch (e: Exception) {
                    Log.e(tag, "Error during uplink audio playback", e)
                }
            }
            Log.i(tag, "Uplink audio worker loop terminated")
        }, "AegisUplinkAudioWorker").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    /**
     * Stops playback and frees AudioTrack resources cleanly
     */
    @Synchronized
    fun release() {
        isPlaying.set(false)
        playbackThread?.interrupt()
        playbackThread = null
        audioQueue.clear()

        try {
            audioTrack?.pause()
            audioTrack?.flush()
            audioTrack?.stop()
            audioTrack?.release()
        } catch (e: Exception) {
            Log.e(tag, "Error releasing audioTrack", e)
        } finally {
            audioTrack = null
            Log.i(tag, "UplinkAudioPlayer released")
        }
    }

    fun isUplinkActive(): Boolean = isPlaying.get()
}
