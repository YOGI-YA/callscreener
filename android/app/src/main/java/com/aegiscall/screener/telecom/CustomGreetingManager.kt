package com.aegiscall.screener.telecom

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.os.Build
import android.util.Base64
import android.util.Log
import java.io.File
import java.io.FileOutputStream

/**
 * CustomGreetingManager
 * ─────────────────────
 * Manages user's personal recorded voice greeting for the Live Answering Machine:
 * 1. Stores and retrieves user's custom recorded audio (m4a/wav/mp3).
 * 2. Plays the personal audio greeting into the in-call audio stream during call screening.
 * 3. Triggers call recorder and live STT listener once greeting completes.
 */
object CustomGreetingManager {

    private const val TAG = "CustomGreetingManager"
    private const val GREETING_FILENAME = "personal_voice_greeting.m4a"

    @Volatile
    var activeScreeningMode: String = "AI_ASSISTANT" // "AI_ASSISTANT" or "PERSONAL_VOICEMAIL"

    private var mediaPlayer: MediaPlayer? = null

    fun getGreetingFile(context: Context): File {
        return File(context.filesDir, GREETING_FILENAME)
    }

    fun hasCustomGreeting(context: Context): Boolean {
        val file = getGreetingFile(context)
        return file.exists() && file.length() > 512
    }

    fun saveGreetingFromBase64(context: Context, base64Audio: String): Boolean {
        return try {
            val audioBytes = Base64.decode(base64Audio, Base64.DEFAULT)
            val file = getGreetingFile(context)
            FileOutputStream(file).use { it.write(audioBytes) }
            Log.i(TAG, "Personal greeting saved successfully (${audioBytes.size} bytes)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save personal greeting", e)
            false
        }
    }

    fun getGreetingDurationSeconds(context: Context): Long {
        val file = getGreetingFile(context)
        if (!file.exists()) return 0L
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(file.absolutePath)
            val durStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
            val durSec = (durStr?.toLongOrNull() ?: 0L) / 1000L
            retriever.release()
            durSec
        } catch (e: Exception) {
            0L
        }
    }

    fun deleteGreeting(context: Context): Boolean {
        val file = getGreetingFile(context)
        return if (file.exists()) file.delete() else true
    }

    fun playGreetingToCall(context: Context, onComplete: () -> Unit) {
        val file = getGreetingFile(context)
        if (!file.exists()) {
            Log.w(TAG, "No greeting file found, invoking onComplete immediately")
            onComplete()
            return
        }

        try {
            stopPlayback()

            val player = MediaPlayer()
            mediaPlayer = player

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val attributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                player.setAudioAttributes(attributes)
            } else {
                @Suppress("DEPRECATION")
                player.setAudioStreamType(AudioManager.STREAM_VOICE_CALL)
            }

            player.setDataSource(file.absolutePath)
            player.setOnCompletionListener {
                Log.i(TAG, "Personal greeting finished playing to caller")
                stopPlayback()
                onComplete()
            }
            player.setOnErrorListener { _, what, extra ->
                Log.w(TAG, "MediaPlayer error playing greeting: what=$what extra=$extra")
                stopPlayback()
                onComplete()
                true
            }

            player.prepare()
            player.start()
            Log.i(TAG, "Started playing personal voice greeting to caller on voice stream")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play greeting to call", e)
            stopPlayback()
            onComplete()
        }
    }

    fun stopPlayback() {
        try {
            mediaPlayer?.apply {
                if (isPlaying) stop()
                release()
            }
        } catch (e: Exception) {
            // ignore
        } finally {
            mediaPlayer = null
        }
    }
}
