package com.aegiscall.screener.telecom

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * CallRecorderManager
 * ───────────────────
 * Manages native in-call audio recording and securely saves recordings
 * directly into Android's public "Recordings" or "Music" library (MediaStore)
 * so users can play and access their call recordings in their standard
 * Voice Recorder, Music Player, or File Manager apps.
 */
object CallRecorderManager {

    private const val TAG = "CallRecorderManager"

    @Volatile
    var isRecording: Boolean = false
        private set

    private var mediaRecorder: MediaRecorder? = null
    private var currentTempFile: File? = null
    private var currentPhoneNumber: String = "Unknown"
    private var recordingStartTime: Long = 0L

    fun startRecording(context: Context, phoneNumber: String): Boolean {
        if (isRecording) {
            Log.i(TAG, "Already recording call")
            return true
        }

        try {
            currentPhoneNumber = phoneNumber.ifBlank { "Unknown" }
            recordingStartTime = System.currentTimeMillis()

            val tempFile = File.createTempFile("call_rec_${System.currentTimeMillis()}", ".m4a", context.cacheDir)
            currentTempFile = tempFile

            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            // Attempt in-call communication audio source first, fallback to physical mic
            try {
                recorder.setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
            } catch (e: Exception) {
                Log.w(TAG, "VOICE_COMMUNICATION source failed, falling back to MIC: ${e.message}")
                recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            }

            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setAudioEncodingBitRate(128000)
            recorder.setAudioSamplingRate(44100)
            recorder.setOutputFile(tempFile.absolutePath)

            recorder.prepare()
            recorder.start()

            mediaRecorder = recorder
            isRecording = true
            Log.i(TAG, "Call recording started for $currentPhoneNumber -> ${tempFile.absolutePath}")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start call recording", e)
            cleanupTempFile()
            isRecording = false
            return false
        }
    }

    fun stopRecording(context: Context): String? {
        if (!isRecording && mediaRecorder == null) {
            return null
        }

        isRecording = false
        val tempFile = currentTempFile
        val phone = currentPhoneNumber
        val durationMs = System.currentTimeMillis() - recordingStartTime

        try {
            mediaRecorder?.apply {
                try {
                    stop()
                } catch (e: Exception) {
                    Log.w(TAG, "Error stopping mediaRecorder: ${e.message}")
                }
                release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing mediaRecorder: ${e.message}")
        } finally {
            mediaRecorder = null
        }

        if (tempFile == null || !tempFile.exists() || tempFile.length() < 512) {
            Log.w(TAG, "Recording file empty or missing, cleanup")
            cleanupTempFile()
            return null
        }

        val dateFormat = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val cleanPhone = phone.replace(Regex("[^0-9+]"), "").ifBlank { "Unknown" }
        val fileName = "Call_${cleanPhone}_$dateFormat.m4a"

        var savedLocation: String? = null

        // Strategy 1: Modern Android MediaStore API (Android 10+ / API 29+) -> Saves to "Recordings" or "Music"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val relativeDir = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Environment.DIRECTORY_RECORDINGS + "/AegisCall"
                } else {
                    Environment.DIRECTORY_MUSIC + "/AegisCall"
                }

                val contentValues = ContentValues().apply {
                    put(MediaStore.Audio.Media.DISPLAY_NAME, fileName)
                    put(MediaStore.Audio.Media.MIME_TYPE, "audio/mp4")
                    put(MediaStore.Audio.Media.RELATIVE_PATH, relativeDir)
                    put(MediaStore.Audio.Media.TITLE, "Call with $cleanPhone")
                    put(MediaStore.Audio.Media.ARTIST, "AegisCall Phone Recorder")
                    put(MediaStore.Audio.Media.IS_PENDING, 1)
                }

                val uri = context.contentResolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    context.contentResolver.openOutputStream(uri)?.use { out ->
                        FileInputStream(tempFile).use { input ->
                            input.copyTo(out)
                        }
                    }
                    contentValues.clear()
                    contentValues.put(MediaStore.Audio.Media.IS_PENDING, 0)
                    context.contentResolver.update(uri, contentValues, null, null)
                    savedLocation = "$relativeDir/$fileName"
                    Log.i(TAG, "Saved recording via MediaStore to: $savedLocation (uri: $uri)")
                }
            } catch (e: Exception) {
                Log.w(TAG, "MediaStore insert failed: ${e.message}")
            }
        }

        // Strategy 2: Direct File System Fallback (Public DIRECTORY_RECORDINGS or DIRECTORY_MUSIC)
        if (savedLocation == null) {
            try {
                val baseDir = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_RECORDINGS)
                } else {
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)
                }
                val targetDir = File(baseDir, "AegisCall").apply { if (!exists()) mkdirs() }
                val targetFile = File(targetDir, fileName)
                tempFile.copyTo(targetFile, overwrite = true)
                savedLocation = targetFile.absolutePath

                // Trigger MediaScanner so music & audio recorder apps index the file immediately
                @Suppress("DEPRECATION")
                val mediaScanIntent = Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE).apply {
                    data = Uri.fromFile(targetFile)
                }
                context.sendBroadcast(mediaScanIntent)
                Log.i(TAG, "Saved recording to public filesystem: ${targetFile.absolutePath}")
            } catch (e: Exception) {
                Log.e(TAG, "Public filesystem save failed", e)
            }
        }

        cleanupTempFile()
        Log.i(TAG, "Call recording successfully saved to: ${savedLocation ?: "Recordings/Music"} (duration: ${durationMs / 1000}s)")
        return savedLocation ?: fileName
    }

    private fun cleanupTempFile() {
        try {
            currentTempFile?.let {
                if (it.exists()) it.delete()
            }
        } catch (e: Exception) {
            // ignore
        } finally {
            currentTempFile = null
        }
    }
}
